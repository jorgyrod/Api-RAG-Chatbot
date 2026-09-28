import Anthropic from "@anthropic-ai/sdk";
import { ChunkRelevance } from "./rag.service";
import { TrustInfo } from "./trusts.service";

export const LLM_MODEL = "claude-haiku-4-5";

export type Turn = { role: "user" | "assistant"; content: string };

const REWRITING_INSTRUCTIONS = `Rewrite the user's last question so that it makes sense on its own, without needing to read the previous conversation. The rewritten question will be used to search documents.

Rules:
- Replace pronouns and implicit references (“that,” “there,” “how much,” “the above”) with what they refer to.
- Use ONLY the concepts that appear in the conversation. Never add figures, deadlines, or totals that were calculated or inferred in previous responses: they may be incorrect and could skew the search results.
- If the reference is ambiguous, choose the most reasonable interpretation based on the question. For example, “Does that include VAT?” refers to amounts or charges, not deadlines.
- Keep the question short and focused on a single topic.
- DO NOT answer the question: just rephrase it.
- If the question is already clear on its own, return it as is.
- Respond ONLY with the rephrased question, without quotation marks or explanations.`;

const INSTRUCTIONS = `You are a very helpful assistant who provides accurate and concise information about a client's documents at a trust institution.

    RULES:
    - Answer only based on the information of context provided from the client's documents.
    - If the context does not provide enough information to answer the question, respond with "No encuentro esa información en tus documentos".
    - Never make up numbers, deadlines, or conditions; stick strictly to the given context.
    - Cite the document from which you are drawing each piece of information in parentheses. Example: (Trust Agreement).
    - If the TRUST INFORMATION allows you to calculate a specific amount, calculate it and show the calculation.
    - Do not combine different types of time periods (calendar days and business days) or add up totals that are not listed in the documents: list each time period with its unit exactly as it appears.
    - Answer in Spanish, briefly and clearly, in no more than 6 lines.
    - Write in plain text: no Markdown, no asterisks, and no hash tags. You can use simple numbered lists (“1. ...”) and line breaks.`;

/**
 * Convierte una pregunta que depende del contexto de la conversación en una pregunta independiente y autocontenida.
 *
 * Esta pregunta reescrita es la que se vectoriza para buscar en ChromaDB
 */
export async function rewriteQuestion(
  history: Turn[],
  question: string,
): Promise<string> {
  if (history.length === 0) return question;

  const anthropic = new Anthropic({ maxRetries: 5 });

  const conversation = history
    .map(
      (turn) =>
        `${turn.role === "user" ? "Usuario" : "Asistente"}: ${turn.content}`,
    )
    .join("\n");

  const response = await anthropic.messages.create({
    model: LLM_MODEL,
    max_tokens: 200,
    temperature: 0,
    system: REWRITING_INSTRUCTIONS,
    messages: [
      {
        role: "user",
        content: `CONVERSACIÓN PREVIA:\n${conversation}\n\nUltima pregunta:\n${question}`,
      },
    ],
  });

  const rewritted = response.content
    .filter((bloque) => bloque.type === "text")
    .map((bloque) => bloque.text)
    .join("")
    .trim();

  const use = response.usage;
  console.log(
    `[llm] reescritura: ${use.input_tokens} + ${use.output_tokens} tokens ` +
      `-> "${rewritted.slice(0, 80)}"`,
  );

  return rewritted.length > 0 ? rewritted : question;
}

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
 *
 * Se agrega historial de la conversación previa al prompt. Sin chunks de documentos.
 */
export async function generateResponse(
  prompt: string,
  history: Turn[] = [],
): Promise<string> {
  const anthropic = new Anthropic({ maxRetries: 5 });

  const response = await anthropic.messages.create({
    model: LLM_MODEL,
    max_tokens: 4000,
    system: INSTRUCTIONS,
    messages: [...history, { role: "user", content: prompt }],
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
