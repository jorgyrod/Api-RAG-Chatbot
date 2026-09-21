import { generateEmbedding } from "../ingest/embeddings";
import { getCollection, type ChunkMetadata } from "../chroma/chroma";

export type ChunkRelevance = {
  documentId: string;
  documentName: string;
  chunkIndex: number;
  text: string;
  distance: number;
};

/**
 * Busca los chunks mas parecidos a la pregunta dada, pero solo dentro de los documentos permitidos para el usuario.
 */
export async function getChunks(
  question: string,
  documentIds: string[],
  nResults = 4,
): Promise<ChunkRelevance[]> {
  if (documentIds.length === 0) {
    return [];
  }

  const embeddingQuestion = await generateEmbedding(question);

  const result = await getCollection().then((collection) =>
    collection.query({
      queryEmbeddings: [embeddingQuestion],
      nResults,
      where: { documentId: { $in: documentIds } },
      include: ["documents", "metadatas", "distances"],
    }),
  );

  const finalResult = result.ids[0].map((_id, index) => {
    const meta = result.metadatas[0][index] as ChunkMetadata;
    return {
      documentId: meta.documentId,
      documentName: meta.documentName,
      chunkIndex: meta.chunkIndex,
      text: String(result.documents[0][index]),
      distance: result.distances?.[0][index] ?? 0,
    };
  });

  return finalResult;
}
