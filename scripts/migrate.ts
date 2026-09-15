import path from "node:path";
import { loadEnv } from "../src/config/env.js";
import { createPool } from "../src/infraestructure/db/pool.js";
import { runMigrations } from "../src/infraestructure/db/migrator.js";

const MIGRATIONS_DIR = path.resolve(import.meta.dirname, "..", "migrations");

async function main(): Promise<void> {
  const env = loadEnv();
  const pool = createPool(env);

  try {
    console.log("Aplicando migraciones...");
    const result = await runMigrations(pool, MIGRATIONS_DIR, (message) => {
      console.log(message);
    });

    if (result.applied.length === 0) {
      console.log(
        `Sin cambios. ${String(result.skipped.length)} migraciones ya aplicadas.`,
      );
    } else {
      console.log(
        `${String(result.applied.length)} migraciones aplicadas, ` +
          `${String(result.skipped.length)} omitidas.`,
      );
    }
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(`\n${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
