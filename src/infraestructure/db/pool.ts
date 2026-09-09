import pg from "pg";
import type { Env } from "../../config/env.js";

/**
 * Acceso a PostgreSQL
 */

export interface Queryable {
  query<R extends pg.QueryResultRow = pg.QueryResultRow>(
    queryTextOrConfig: string,
    values?: readonly unknown[],
  ): Promise<pg.QueryResult<R>>;
}

export function createPool(env: Env): pg.Pool {
  const pool = new pg.Pool({
    connectionString: env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });

  //Agregamos este listener para majenar los errores
  pool.on("error", (error) => {
    process.emitWarning(
      `Error en conexion ociosa de PostgreSQL: ${error.message}`,
    );
  });

  return pool;
}

/** Comprueba que la base de datos respone. Se usa en el arranque y en `/health` */
export async function checkDatabazeConnection(pool: Queryable): Promise<void> {
  await pool.query("SELECT 1");
}

/**
 * Ejecuta una funcion dentro de una transaccion, con COMMIT o ROLLBACK
 */
export async function withTransaction<T>(
  pool: pg.Pool,
  fn: (client: Queryable) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
