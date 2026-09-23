import { getUserDocuments } from "./user.service";
import { getChunks } from "./rag.service";
import { getTrusts } from "./trusts.service";
import { buildPrompt, generateResponse } from "./llm.service";

export type Source = {
  documentId: string;
  documentName: string;
  chunkIndex: number;
  distance: number;
};

export type ChatResponse = {
  answer: string;
  sources: Source[];
};

export async function chat(
  userId: string,
  question: string,
): Promise<ChatResponse> {
  const documentIds = await getUserDocuments(userId);

  const chunks = await getChunks(question, documentIds);

  const trusts = await getTrusts(userId);

  if (chunks.length === 0 && !trusts) {
    return {
      answer: "No relevant documents or trusted sources found.",
      sources: [],
    };
  }

  const prompt = buildPrompt(question, chunks, trusts);
  const answer = await generateResponse(prompt);

  const sources: Source[] = chunks.map((chunk) => ({
    documentId: chunk.documentId,
    documentName: chunk.documentName,
    chunkIndex: chunk.chunkIndex,
    distance: chunk.distance,
  }));

  return {
    answer,
    sources,
  };
}
