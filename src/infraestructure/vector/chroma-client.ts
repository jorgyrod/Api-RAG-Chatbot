import { ChromaClient } from "chromadb";
import type { Env } from "../../config/env.js";

/**
 * Cliente de ChromaDB
 */
export function createChromaClient(env: Env): ChromaClient {
  const url = new URL(env.CHROMA_URL);

  return new ChromaClient({
    host: url.hostname,
    port:
      url.port == ""
        ? url.protocol === "https:"
          ? 443
          : 80
        : Number(url.port),
    ssl: url.protocol === "https:",
  });
}

/**
 * Comprueba que el servidor responde.
 *
 * `heartbeat()` devuelve una marca de tiempo en nanosegundos. Solo nos
 * interesa que la llamada no lance: es el chequeo de conectividad más barato
 * que expone la API.
 */
export async function checkChromaConnection(
  client: ChromaClient,
): Promise<void> {
  await client.heartbeat();
}
