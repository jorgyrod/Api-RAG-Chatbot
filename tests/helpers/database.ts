import pg from "pg";
import { testEnv } from "./test-env.js";

/**
 * Infraestructura de base de datos para los test de integracion
 *
 * Se trabaja sobre una base de datos separada a la de desarrollo para que no borre data
 */
/* const MIGRATIONS_DIR = path.resolve(
  import.meta.dirname,
  "..",
  "..",
  "migrations",
); */

/**
 * Se crea la base de datos de test si no existe
 */
export async function ensureTestDatabase(): Promise<void> {
  const env = testEnv();
  const target = new URL(env.DATABASE_URL);
  const dataBaseName = target.pathname.replace(/^\//, "");

  const adminUrl = new URL(env.DATABASE_URL);
  adminUrl.pathname = "/postgres";

  const admin = new pg.Client({ connectionString: adminUrl.toString() });
  await admin.connect();

  try {
    const existing = await admin.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [dataBaseName],
    );

    if (existing.rowCount === 0) {
      await admin.query(`CREATE DATABASE ${pg.escapeIdentifier(dataBaseName)}`);
    }
  } finally {
    await admin.end();
  }
}
