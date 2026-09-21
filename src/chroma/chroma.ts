import "dotenv/config";
import { ChromaClient } from "chromadb";

export const NAME_COLLECTION = "documents";

export const chroma = new ChromaClient({
  host: process.env.CHROMA_HOST ?? "localhost",
  port: Number(process.env.CHROMA_PORT ?? 8000),
  ssl: false,
});

/**
 * Devuelve la colección donde viven todos los chunks, creándola si no existe.
 *
 * - space: 'cosine' -> que la distancia se calcule como 1 - similitud coseno,
 *   la misma medida que calculamos a mano en la Parte 7.
 * - embeddingFunction: null -> nosotros le pasamos los vectores ya calculados,
 *   así que Chroma no debe generar ninguno por su cuenta.
 */
export const getCollection = async () => {
  return chroma.getOrCreateCollection({
    name: NAME_COLLECTION,
    configuration: { hnsw: { space: "cosine" } },
    embeddingFunction: null,
  });
};

//Metadata que almacenaremos con cada chunk
export type ChunkMetadata = {
  documentId: string;
  documentName: string;
  chunkIndex: number;
};
