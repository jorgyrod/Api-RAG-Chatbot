import { pool } from "../db/postgres";
import { getUserDocuments } from "../services/user.service";
import { getChunks } from "../services/rag.service";
import { getTrusts } from "../services/trusts.service";
import {
  buildPrompt,
  generateResponse,
  LLM_MODEL,
} from "../services/llm.service";

const userId = process.argv[2] ?? "USR001";
const pregunta =
  process.argv[3] ?? "¿Qué debo pagar si quiero desistir de mi fideicomiso?";

console.log(`Usuario : ${userId}`);
console.log(`Pregunta: ${pregunta}`);
console.log("");

// 1. Permisos
const documentIds = await getUserDocuments(userId);
console.log(
  `[1] PostgreSQL -> documentos permitidos: [${documentIds.join(", ") || "ninguno"}]`,
);

// 2. Chunks relevantes (ya filtrados)
const chunks = await getChunks(pregunta, documentIds);
console.log(
  `[2] ChromaDB   -> ${chunks.length} chunks: ${chunks.map((c) => `${c.documentId}#${c.chunkIndex}`).join(", ")}`,
);

// 3. Datos en vivo
const fideicomiso = await getTrusts(userId);
console.log(
  `[3] API mock   -> ${fideicomiso ? `${fideicomiso.trustId}, saldo ${fideicomiso.balance.toLocaleString("es-MX")} ${fideicomiso.currency}` : "sin datos"}`,
);

// 4. El prompt
const prompt = buildPrompt(pregunta, chunks, fideicomiso);
console.log(`[4] Prompt     -> ${prompt.length} caracteres`);

console.log("");
console.log("=".repeat(74));
console.log("ESTO ES EXACTAMENTE LO QUE SE LE ENVÍA AL MODELO");
console.log("=".repeat(74));
console.log(prompt);
console.log("=".repeat(74));

// 5. El LLM
if (!process.env.ANTHROPIC_API_KEY) {
  console.log("");
  console.log(
    "[5] LLM        -> ANTHROPIC_API_KEY no configurada: no se llama al modelo.",
  );
  console.log(
    "    Añade la clave a backend/.env y vuelve a ejecutar para ver la respuesta.",
  );
} else {
  console.log("");
  console.log(`[5] LLM        -> enviando a ${LLM_MODEL}...`);
  const inicio = Date.now();
  const respuesta = await generateResponse(prompt);
  console.log(`    (${Date.now() - inicio} ms)`);
  console.log("");
  console.log("=".repeat(74));
  console.log("RESPUESTA");
  console.log("=".repeat(74));
  console.log(respuesta);
  console.log("=".repeat(74));
}

await pool.end();
