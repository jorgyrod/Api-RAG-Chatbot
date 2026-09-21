import { extractTextFromPDF } from "../ingest/pdf";
import { SIZE_CHUNK, SOLAPAMIENTO, createChunks } from "../ingest/chunking";

const file = process.argv[2] ?? "storage/contrato-fideicomiso.pdf";

const text = await extractTextFromPDF(file);

console.log("IN (a long string):");
console.log(`    ${file}`);
console.log(`    ${text.length} characters`);
console.log("");
console.log(`Params: size = ${SIZE_CHUNK}, overlap = ${SOLAPAMIENTO}`);
console.log("");

const chunks = createChunks(text);

console.log("OUT (an array of chunks):");
console.log(`    ${chunks.length} chunks`);
const sizeAverage = Math.round(
  chunks.reduce((suma, c) => suma + c.text.length, 0) / chunks.length,
);
console.log(`    average size = ${sizeAverage} characters`);
console.log("");

//-----------------------------
// All chunks
//-----------------------------
console.log("=== All chunks ===");
for (const chunk of chunks) {
  const start = chunk.text.slice(0, 75).replace(/\n/g, " ");
  const end = chunk.text.slice(-45).replace(/\n/g, " ");
  console.log("");
  console.log(`--- chunk ${chunk.index} (${chunk.text.length} characters) ---`);
  console.log(`    start: ${start}...`);
  console.log(`    end: ...${end}`);
}

// -----------------------------
// OVERLAP DEMONSTRATION
// -----------------------------
console.log("");
console.log("=== OVERLAP DEMONSTRATION ===");
const endOf10 = chunks[0].text.slice(-SOLAPAMIENTO).replace(/\n/g, " ");
const startOf11 = chunks[1].text.slice(0, SOLAPAMIENTO).replace(/\n/g, " ");
console.log(`LAST ${SOLAPAMIENTO} CHARACTERS OF CHUNK 0:`);
console.log(`    "${endOf10}"`);
console.log(`START ${SOLAPAMIENTO} CHARACTERS OF CHUNK 1:`);
console.log(`    "${startOf11}"`);
console.log("");
console.log(
  `Is the same text? ${endOf10.trim() === startOf11.trim() ? "YES" : "ALMOST (The count might differ due to whitespace)"}`,
);

// ---------------------------------------------------------------------------
// ¿Dónde acabó la respuesta que buscará nuestro usuario?
// ---------------------------------------------------------------------------
console.log("");
console.log("=== ¿QUÉ CHUNKS CONTIENEN LA RESPUESTA? ===");
for (const termino of [
  "tres por ciento",
  "cinco mil pesos",
  "treinta días naturales",
]) {
  const encontrados = chunks
    .filter((c) => c.text.toLowerCase().includes(termino))
    .map((c) => c.index);
  console.log(
    `   "${termino}"  ->  chunk(s) ${encontrados.join(", ") || "NINGUNO"}`,
  );
}

// ---------------------------------------------------------------------------
// Comparación: los mismos chunks SIN overlap.
// ---------------------------------------------------------------------------
console.log("");
console.log("=== LO MISMO SIN OVERLAP (overlap = 0) ===");
const sinOverlap = createChunks(text, SIZE_CHUNK, 0);
console.log(
  `   ${sinOverlap.length} chunks (frente a ${chunks.length} con overlap)`,
);
for (const termino of [
  "tres por ciento",
  "cinco mil pesos",
  "treinta días naturales",
]) {
  const encontrados = sinOverlap
    .filter((c) => c.text.toLowerCase().includes(termino))
    .map((c) => c.index);
  console.log(
    `   "${termino}"  ->  chunk(s) ${encontrados.join(", ") || "NINGUNO"}`,
  );
}

// ---------------------------------------------------------------------------
// Un chunk completo, tal cual se guardará y tal cual verá el LLM.
// ---------------------------------------------------------------------------
const chunkClave = chunks.find((c) =>
  c.text.toLowerCase().includes("tres por ciento"),
);
if (chunkClave) {
  console.log("");
  console.log(
    `=== CHUNK ${chunkClave.index} COMPLETO (el que responde la pregunta) ===`,
  );
  console.log(chunkClave.text);
}
