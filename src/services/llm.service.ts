import Anthropic from "@anthropic-ai/sdk";
import { ChunkRelevance } from "./rag.service";
import { TrustInfo } from "./trusts.service";

export const LLM_MODEL = "claude-haiku-4-5";

const INSTRUCTIONS = `You are a very helpful assistant who provides accurate and concise information about a client's documents at a trust institution.

    RULES:
    - Answer only based on the information of context provided from the client's documents.
    - If the context does not provide enough information to answer the question, respond with "No encuentro esa información en tus documentos".
    - Never make up numbers, deadlines, or conditions; stick strictly to the given context.
    - Cite the document from which you are drawing each piece of information in parentheses. Example: (Trust Agreement).
    - If the TRUST INFORMATION allows you to calculate a specific amount, calculate it and show the calculation.
    - Answer in Spanish, briefly and clearly, in no more than 6 lines.`;

/**
 * Arma el texto que se le manda al modelo. Esta separado de la llamada a la API
 * a proposito.
 */
export function buildPrompt(
  question: string,
  chunks: ChunkRelevance[],
  trust: TrustInfo | null,
): string {
  const parts: string[] = [];

  // --- Bloque 1: lo que dicen los documentos (RAG) ---
  parts.push("CONTEXT (excerpts from the user's documents):");

  if (chunks.length === 0) {
    parts.push("Not found some excerpts relevant");
  } else {
    for (const chunk of chunks) {
      parts.push("");
      parts.push(
        `[Document: ${chunk.documentName} | excerpt: ${chunk.chunkIndex}]`,
      );
      parts.push(chunk.text);
    }
  }

  // --- Bloque 2: lo que dice el sistema en vivo (API) ---
  parts.push("");
  parts.push("TRUST DATA:");

  if (trust) {
    parts.push(`- Trust: ${trust.trustId}`);
    parts.push(`- State: ${trust.status}`);
    parts.push(`- Actual Balance: ${trust.balance}`);
    parts.push(`- Opened At: ${trust.openedAt}`);
  } else {
    parts.push("No trust information available.");
  }

  // --- Bloque 3: la pregunta del usuario ---
  parts.push("");
  parts.push("USER QUESTION:");
  parts.push(question);

  return parts.join("\n");
}

/**
 * Manda el prompt construido al modelo LLM y devuelve la respuesta.
 */
export async function generateResponse(prompt: string): Promise<string> {
  const anthropic = new Anthropic();

  const response = await anthropic.messages.create({
    model: LLM_MODEL,
    max_tokens: 4000,
    system: INSTRUCTIONS,
    messages: [{ role: "user", content: prompt }],
  });

  const { input_tokens: inputTokens, output_tokens: outputTokens } =
    response.usage;
  const costUSD = inputTokens * 1_000_000 + outputTokens * 1_000_000 * 5;
  console.log(
    `[llm] tokens: ${inputTokens} entrada + ${outputTokens} salida = $${costUSD.toFixed(6)} USD`,
  );

  if (response.stop_reason === "refusal") {
    return "No puedo responder esa solicitud en este momento.";
  }

  return response.content
    .filter((bloque) => bloque.type === "text")
    .map((bloque) => bloque.text)
    .join("")
    .trim();
}
