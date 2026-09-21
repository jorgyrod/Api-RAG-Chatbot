import { extractTextFromPDF } from "../ingest/pdf";
import { createChunks } from "../ingest/chunking";
import {
  DIMENSIONS,
  EMBEDDINGS_MODEL,
  generateEmbedding,
  generateEmbeddings,
} from "../ingest/embeddings";

// ---------------------------------------------------------------------------
// Similitud coseno: cuánto se parecen dos vectores.
//   1.0  = idénticos
//   0.0  = no tienen nada que ver
//  -1.0  = opuestos
// Es la misma medida que usará ChromaDB por dentro.
// ---------------------------------------------------------------------------
function similitudCoseno(a: number[], b: number[]): number {
  let productoPunto = 0;
  let normaA = 0;
  let normaB = 0;

  for (let i = 0; i < a.length; i++) {
    productoPunto += a[i] * b[i];
    normaA += a[i] * a[i];
    normaB += b[i] * b[i];
  }

  return productoPunto / (Math.sqrt(normaA) * Math.sqrt(normaB));
}

console.log(`Sean 3 caracteres o 3.000, SIEMPRE salen ${DIMENSIONS} números.`);
console.log(
  "(la primera ejecución descarga el modelo, ~118 MB; después es instantáneo)",
);
console.log("");

// ---------------------------------------------------------------------------
// 1. Un texto -> un vector. Qué pinta tiene.
// ---------------------------------------------------------------------------
const frase =
  "El Fideicomitente deberá cubrir una pena convencional del tres por ciento.";

console.log("ENTRA (texto):");
console.log(`   "${frase}"`);
console.log("");

const inicio = Date.now();
const vector = await generateEmbedding(frase);
const ms = Date.now() - inicio;

console.log("SALE (un vector):");
console.log(`   ${vector.length} números (dimensiones)`);
console.log(
  `   primeros 8: [${vector
    .slice(0, 8)
    .map((n) => n.toFixed(4))
    .join(", ")}, ...]`,
);
console.log(
  `   mínimo: ${Math.min(...vector).toFixed(4)}   máximo: ${Math.max(...vector).toFixed(4)}`,
);
const longitud = Math.sqrt(vector.reduce((s, n) => s + n * n, 0));
console.log(
  `   longitud del vector: ${longitud.toFixed(4)}  (el modelo lo normaliza a 1)`,
);
console.log(`   tiempo: ${ms} ms`);
console.log("");
console.log(`Sean 3 caracteres o 3.000, SIEMPRE salen ${DIMENSIONS} números.`);
console.log("");

// ---------------------------------------------------------------------------
// 2. Lo que de verdad importa: comparar significados.
// ---------------------------------------------------------------------------
const pregunta = "¿Qué debo pagar si quiero desistir de mi fideicomiso?";

const candidatos = [
  "En caso de desistimiento anticipado, el Fideicomitente deberá cubrir una pena convencional equivalente al tres por ciento del saldo del patrimonio fideicomitido.",
  "El Fideicomitente que desee desistirse deberá presentar el formato FD-01 de solicitud de terminación anticipada.",
  "El comité técnico se integrará por tres miembros designados por el Fideicomitente y sesionará cada trimestre.",
  "Para la interpretación del presente contrato, las partes se someten a los tribunales de la Ciudad de México.",
  "Los tacos al pastor se preparan con carne de cerdo adobada en achiote y se sirven con piña.",
];

const [vectorPregunta, ...vectoresCandidatos] = await generateEmbeddings([
  pregunta,
  ...candidatos,
]);

const resultados = candidatos
  .map((texto, i) => ({
    texto,
    similitud: similitudCoseno(vectorPregunta, vectoresCandidatos[i]),
  }))
  .sort((a, b) => b.similitud - a.similitud);

console.log("=== ¿QUÉ SE PARECE MÁS A LA PREGUNTA? ===");
console.log(`Pregunta: "${pregunta}"`);
console.log("");

for (const r of resultados) {
  const barra = "█".repeat(Math.max(0, Math.round(r.similitud * 40)));
  console.log(`${r.similitud.toFixed(4)}  ${barra}`);
  console.log(`          "${r.texto.slice(0, 95)}..."`);
  console.log("");
}

// ---------------------------------------------------------------------------
// 3. La prueba de que NO busca palabras iguales.
// ---------------------------------------------------------------------------
console.log("=== BUSCA SIGNIFICADO, NO PALABRAS ===");

const parejas: Array<[string, string]> = [
  ["desistir del fideicomiso", "terminación anticipada del contrato"],
  ["desistir del fideicomiso", "desistir del desayuno"],
  ["¿cuánto cuesta cancelar?", "pena convencional por cancelación"],
];

for (const [a, b] of parejas) {
  const [va, vb] = await generateEmbeddings([a, b]);
  const sim = similitudCoseno(va, vb);
  const palabrasComunes = a
    .toLowerCase()
    .split(/\s+/)
    .filter((p) => p.length > 3 && b.toLowerCase().includes(p));
  console.log("");
  console.log(`   "${a}"`);
  console.log(`   "${b}"`);
  console.log(
    `   similitud: ${sim.toFixed(4)}   palabras en común: ${palabrasComunes.length ? palabrasComunes.join(", ") : "ninguna"}`,
  );
}

// ---------------------------------------------------------------------------
// 4. Los chunks reales del contrato, listos para guardarse.
// ---------------------------------------------------------------------------
console.log("");
console.log("=== LOS 10 CHUNKS DEL CONTRATO, VECTORIZADOS ===");

const texto = await extractTextFromPDF("storage/contrato-fideicomiso.pdf");
const chunks = createChunks(texto);

const inicioLote = Date.now();
const vectores = await generateEmbeddings(chunks.map((c) => c.text));
const msLote = Date.now() - inicioLote;

console.log(
  `   ${chunks.length} chunks -> ${vectores.length} vectores de ${vectores[0].length} números`,
);
console.log(
  `   tiempo total: ${msLote} ms  (${Math.round(msLote / chunks.length)} ms por chunk)`,
);
console.log("");

// ¿Cuál de nuestros chunks responde mejor a la pregunta?
const ranking = chunks
  .map((c, i) => ({
    indice: c.index,
    similitud: similitudCoseno(vectorPregunta, vectores[i]),
  }))
  .sort((a, b) => b.similitud - a.similitud);

console.log("Ranking de chunks frente a la pregunta del usuario:");
for (const r of ranking) {
  const marca = r === ranking[0] ? "  <-- el más parecido" : "";
  console.log(
    `   chunk ${String(r.indice).padStart(2)}   similitud ${r.similitud.toFixed(4)}${marca}`,
  );
}
