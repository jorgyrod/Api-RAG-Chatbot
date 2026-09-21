import { pool } from "../db/postgres";
import { getCollection, type ChunkMetadata } from "../chroma/chroma";
import { generateEmbedding } from "../ingest/embeddings";
import { getUserDocuments } from "../services/user.service";
import { getChunks } from "../services/rag.service";

const PREGUNTA = "¿Qué debo pagar si quiero desistir de mi fideicomiso?";

console.log("PREGUNTA:", PREGUNTA);
console.log("");

// ===========================================================================
// 1. USR001: el flujo correcto, paso a paso.
// ===========================================================================
console.log("=".repeat(70));
console.log("USR001  (el flujo real del sistema)");
console.log("=".repeat(70));

const permitidosUsr001 = await getUserDocuments("USR001");
console.log("");
console.log("PASO 1 - PostgreSQL");
console.log(`   "USR001"  ->  [${permitidosUsr001.join(", ")}]`);

const chunksUsr001 = await getChunks(PREGUNTA, permitidosUsr001);
console.log("");
console.log("PASO 2 - ChromaDB (buscando SOLO en esos documentos)");
for (const c of chunksUsr001) {
  console.log(
    `   ${c.documentId} chunk ${c.chunkIndex}  distancia ${c.distance.toFixed(4)}  (${c.documentName})`,
  );
}

console.log("");
console.log(
  "   ¿algún chunk de DOC003?",
  chunksUsr001.some((c) => c.documentId === "DOC003")
    ? "*** SÍ - FUGA DE DATOS ***"
    : "NO",
);

console.log("");
console.log("   Mejor chunk recuperado:");
console.log(
  `   "${chunksUsr001[0].text.replace(/\n/g, " ").slice(0, 330)}..."`,
);

// ===========================================================================
// 2. LA MISMA BÚSQUEDA SIN EL FILTRO.
//    Es decir: qué pasaría si nos olvidáramos de los permisos.
// ===========================================================================
console.log("");
console.log("=".repeat(70));
console.log("LA MISMA PREGUNTA, SIN FILTRO DE PERMISOS  (el bug que evitamos)");
console.log("=".repeat(70));

const coleccion = await getCollection();
const vector = await generateEmbedding(PREGUNTA);
const sinFiltro = await coleccion.query({
  queryEmbeddings: [vector],
  nResults: 4,
  include: ["documents", "metadatas", "distances"],
});

console.log("");
for (let i = 0; i < sinFiltro.ids[0].length; i++) {
  const meta = sinFiltro.metadatas[0][i] as ChunkMetadata;
  const distancia = sinFiltro.distances?.[0][i] ?? 0;
  const prohibido =
    meta.documentId === "DOC003" ? "   <-- PROHIBIDO para USR001" : "";
  console.log(
    `   ${meta.documentId} chunk ${meta.chunkIndex}  distancia ${distancia.toFixed(4)}${prohibido}`,
  );
}

const fugado = sinFiltro.metadatas[0].findIndex(
  (m) => (m as ChunkMetadata).documentId === "DOC003",
);
if (fugado >= 0) {
  console.log("");
  console.log("   Contenido que se habría filtrado:");
  console.log(
    `   "${String(sinFiltro.documents[0][fugado]).replace(/\n/g, " ").slice(0, 300)}..."`,
  );
}

// ===========================================================================
// 3. USR002: la misma pregunta, otra respuesta legítima.
// ===========================================================================
console.log("");
console.log("=".repeat(70));
console.log("USR002  (misma pregunta, sus propios documentos)");
console.log("=".repeat(70));

const permitidosUsr002 = await getUserDocuments("USR002");
const chunksUsr002 = await getChunks(PREGUNTA, permitidosUsr002);

console.log("");
console.log(
  `PASO 1 - PostgreSQL:  "USR002"  ->  [${permitidosUsr002.join(", ")}]`,
);
console.log("PASO 2 - ChromaDB:");
for (const c of chunksUsr002) {
  console.log(
    `   ${c.documentId} chunk ${c.chunkIndex}  distancia ${c.distance.toFixed(4)}`,
  );
}
console.log("");
console.log("   Mejor chunk recuperado:");
console.log(
  `   "${chunksUsr002[0].text.replace(/\n/g, " ").slice(0, 330)}..."`,
);

// ===========================================================================
// 4. Un usuario sin permisos.
// ===========================================================================
console.log("");
console.log("=".repeat(70));
console.log("USR999  (no existe / sin permisos)");
console.log("=".repeat(70));

const permitidosUsr999 = await getUserDocuments("USR999");
const chunksUsr999 = await getChunks(PREGUNTA, permitidosUsr999);

console.log("");
console.log(
  `   PostgreSQL:  "USR999"  ->  [${permitidosUsr999.join(", ")}]  (vacío)`,
);
console.log(`   ChromaDB  :  ni siquiera se consulta`);
console.log(`   chunks    :  ${chunksUsr999.length}`);

// ===========================================================================
// RESUMEN
// ===========================================================================
console.log("");
console.log("=".repeat(70));
console.log("RESUMEN");
console.log("=".repeat(70));
console.table([
  {
    usuario: "USR001",
    permitidos: permitidosUsr001.join(", ") || "(ninguno)",
    chunks: chunksUsr001.length,
    documentos:
      [...new Set(chunksUsr001.map((c) => c.documentId))].join(", ") || "-",
  },
  {
    usuario: "USR002",
    permitidos: permitidosUsr002.join(", ") || "(ninguno)",
    chunks: chunksUsr002.length,
    documentos:
      [...new Set(chunksUsr002.map((c) => c.documentId))].join(", ") || "-",
  },
  {
    usuario: "USR999",
    permitidos: permitidosUsr999.join(", ") || "(ninguno)",
    chunks: chunksUsr999.length,
    documentos: "-",
  },
]);

await pool.end();
