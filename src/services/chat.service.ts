import { getUserDocuments } from "./user.service";
import { getChunks } from "./rag.service";
import { getTrusts } from "./trusts.service";
import {
  buildPrompt,
  generateResponse,
  rewriteQuestion,
  Turn,
} from "./llm.service";

export type Source = {
  documentId: string;
  documentName: string;
  chunkIndex: number;
  distance: number;
};

export type ChatResponse = {
  answer: string;
  sources: Source[];
  searchedFor: string;
};

const TURNS_MAX = 6;

export async function chat(
  userId: string,
  question: string,
  history: Turn[] = [],
): Promise<ChatResponse> {
  const context = history.slice(-TURNS_MAX);

  const questionSearchedFor = await rewriteQuestion(context, question);

  const documentIds = await getUserDocuments(userId);

  const chunks = await getChunks(questionSearchedFor, documentIds);

  const trusts = await getTrusts(userId);

  if (chunks.length === 0 && !trusts) {
    return {
      answer: "No relevant documents or trusted sources found.",
      sources: [],
      searchedFor: questionSearchedFor,
    };
  }

  const prompt = buildPrompt(question, chunks, trusts);
  const answer = await generateResponse(prompt, context);

  const sources: Source[] = chunks.map((chunk) => ({
    documentId: chunk.documentId,
    documentName: chunk.documentName,
    chunkIndex: chunk.chunkIndex,
    distance: chunk.distance,
  }));

  return {
    answer,
    sources,
    searchedFor: questionSearchedFor,
  };
}
