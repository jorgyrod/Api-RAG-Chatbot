import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type pg from "pg";

const MIGRATION_LOCK_KEY = 4_815_162_342;

export interface MigrationFile {
  version: string;
  name: string;
  sql: string;
  checksum: string;
}

export interface MigrationResult {
  applied: string[];
  skipped: string[];
}

function sha256(content: string): string {
  return createHash("sha256").update(content, "utf-8").digest("hex");
}

/** Lee y ordena los archivos .sql del directorio de migraciones */
export async function loadMigrations(
  directory: string,
): Promise<MigrationFile[]> {
  const entries = await readdir(directory);

  const sqlFiles = entries
    .filter((entry) => entry.endsWith(".sql"))
    .sort((a, b) => a.localeCompare(b));

  const migrations: MigrationFile[] = [];

  for (const name of sqlFiles) {
    const version = name.split("_")[0];

    if (version === undefined || !/^\d+$/.test(version)) {
      throw new Error(
        `Migración con nombre inválido: "${name}". Se espera el formato 001_descripcion.sql`,
      );
    }

    const raw = await readFile(path.join(directory, name), "utf-8");
    const sql = raw.replace(/\r\n/g, "\n");

    migrations.push({
      version,
      name,
      sql,
      checksum: sha256(sql),
    });
  }

  const versions = migrations.map((migration) => migration.version);
  const duplicates = versions.filter(
    (version, index) => versions.indexOf(version) !== index,
  );

  if (duplicates.length > 0) {
    throw new Error(
      `Se encontraron versiones duplicadas en las migraciones: ${duplicates.join(", ")}`,
    );
  }

  return migrations;
}

async function ensureMigrationsTable(client: pg.PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version    text        PRIMARY KEY,
      name       text        NOT NULL,
      checksum   text        NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);
}

/**
 * Aplica las migraciones pendientes
 *
 * `onLog` se inyecta en vez de llamar a console.log directamente para que los
 * tests puedan capturar la salida y el servidor pueda enviarla a pino.
 */
export async function runMigrations(
  pool: pg.Pool,
  directory: string,
  onLog: (message: string) => void,
): Promise<MigrationResult> {
  const migrations = await loadMigrations(directory);
  const result: MigrationResult = { applied: [], skipped: [] };

  const client = await pool.connect();

  try {
    await client.query("SELECT pg_advisory_lock($1)", [MIGRATION_LOCK_KEY]);
    await ensureMigrationsTable(client);

    const { rows: alreadyApplied } = await client.query<{
      version: string;
      name: string;
      checksum: string;
    }>(`SELECT version, name, checksum FROM schema_migrations`);
    const appliedByVersion = new Map(alreadyApplied.map((m) => [m.version, m]));

    for (const migration of migrations) {
      const previous = appliedByVersion.get(migration.version);

      if (previous !== undefined) {
        if (previous.checksum !== migration.checksum) {
          throw new Error(
            `La migración ${migration.name} fue modificada después de aplicarse.\n` +
              `  checksum aplicado: ${previous.checksum}\n` +
              `  checksum actual:   ${migration.checksum}\n` +
              "Crea una migración nueva en lugar de editar una existente.",
          );
        }
        result.skipped.push(migration.name);
        continue;
      }

      await client.query("BEGIN");
      try {
        await client.query(migration.sql);
        await client.query(
          "INSERT INTO schema_migrations (version, name, checksum) VALUES ($1, $2, $3)",
          [migration.version, migration.name, migration.checksum],
        );
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        const reason = error instanceof Error ? error.message : String(error);
        throw new Error(`Falló la migración ${migration.name}: ${reason}`, {
          cause: error,
        });
      }

      onLog(`Aplicada la migración ${migration.name}`);
      result.applied.push(migration.name);
    }
    return result;
  } finally {
    await client.query("SELECT pg_advisory_unlock($1)", [MIGRATION_LOCK_KEY]);
    client.release();
  }
}
