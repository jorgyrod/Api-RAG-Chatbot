/**
 * Espera a que postgreSQL y ChromaDB acepten conexiones
 */
import { loadEnv } from "../config/env.js";
import {
  createPool,
  checkDatabazeConnection,
} from "../infraestructure/db/pool.js";
import {
  createChromaClient,
  checkChromaConnection,
} from "../infraestructure/vector/chroma-client.js";

const TIMEOUT_MS = 90_000;
const RETRY_DELAY_MS = 1_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Reintento de check hasta que deje de lanzar o se agote el tiempo */
async function waitFor(
  name: string,
  check: () => Promise<void>,
): Promise<void> {
  const deadline = Date.now() + TIMEOUT_MS;
  let lastError: unknown;
  let attempt = 0;

  while (Date.now() < deadline) {
    attempt += 1;
    try {
      await check();
      console.log(`  ✓ ${name} listo (intento ${String(attempt)})`);
      return;
    } catch (error) {
      lastError = error;
      await sleep(RETRY_DELAY_MS);
    }
  }

  const reason =
    lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(
    `${name} no respondio en ${String(TIMEOUT_MS / 1000)}s. Ultimo error: ${reason}`,
  );
}

async function main(): Promise<void> {
  const env = loadEnv();
  console.log("Esperando dependencias...");

  const pool = createPool(env);
  const chroma = createChromaClient(env);

  try {
    await waitFor(
      `PostgreSQL (${env.DATABASE_URL.replace(/:[^:@]*@/, ":***@")})`,
      () => checkDatabazeConnection(pool),
    );
    await waitFor(`ChromaDB (${env.CHROMA_URL})`, () =>
      checkChromaConnection(chroma),
    );
    console.log("Todo listo.");
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(`\n${error instanceof Error ? error.message : String(error)}`);
  console.error(
    `\nAsegurarse que las imagenes de los contenedores esten arriba`,
  );
  process.exit(1);
});
