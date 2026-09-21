import {
  chroma,
  ChunkMetadata,
  getCollection,
  NAME_COLLECTION,
} from "../chroma/chroma";
import { pool, query } from "../db/postgres";
import { createChunks } from "./chunking";
import { generateEmbeddings } from "./embeddings";
import { readExcel } from "./excel";
import { extractTextFromPDF } from "./pdf";

const RESET = process.argv.includes("--reset");

const totalStart = Date.now();

// Si se pasa el argumento --reset, se reinicia la base de datos
if (RESET) {
  console.log("Reiniciando la base de datos...");
  try {
    await chroma.deleteCollection({ name: NAME_COLLECTION });
    console.log(`  Colección "${NAME_COLLECTION}" eliminada correctamente.`);
  } catch (error) {
    console.log(
      `  Error al eliminar la colección "${NAME_COLLECTION}":`,
      error,
    );
  }
  await query("UPDATE documents SET indexed_at = NULL");
  console.log("  Todos los documentos marcados como no indexados.");
  console.log("");
}
//-------------------------------------------
console.log("=== LECTURA DE EXCEL ===");

const rows = await readExcel();
const excelUsers = [...new Set(rows.map((row) => row.userId))];
const excelDocuments = [
  ...new Map(rows.map((row) => [row.documentId, row])).values(),
];

console.log(`   archivo    : data/documents.xlsx`);
console.log(`   filas      : ${rows.length}`);
console.log(`   usuarios   : ${excelUsers.length} -> ${excelUsers.join(", ")}`);
console.log(
  `   documentos : ${excelDocuments.length} -> ${excelDocuments.map((doc) => doc.documentId).join(", ")}`,
);
console.log("");

console.log("=== FIN DE LECTURA DE EXCEL ===");
//-------------------------------------------
console.log("=== ALMACENAMIENTO POSTGRESQL ===");
let newUsers = 0;
for (const userId of excelUsers) {
  const insertUserResult = await query(
    "INSERT INTO users (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING RETURNING id",
    [userId, userId],
  );

  newUsers += insertUserResult.length;
}

let newDocuments = 0;
for (const document of excelDocuments) {
  const insertDocumentResult = await query(
    "INSERT INTO documents (id, name, path) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING RETURNING id",
    [document.documentId, document.documentName, document.path],
  );

  newDocuments += insertDocumentResult.length;
}

let newPermissions = 0;
for (const row of rows) {
  const insertPermissionResult = await query(
    "INSERT INTO user_documents (user_id, document_id) VALUES ($1, $2) ON CONFLICT (user_id, document_id) DO NOTHING RETURNING user_id",
    [row.userId, row.documentId],
  );

  newPermissions += insertPermissionResult.length;
}

console.log(`   nuevos usuarios     : ${newUsers}`);
console.log(`   nuevos documentos  : ${newDocuments}`);
console.log(`   nuevos permisos    : ${newPermissions}`);
console.log("");

console.log("=== FIN DE ALMACENAMIENTO POSTGRESQL ===");

//-------------------------------------------
console.log("=== INICIO PIPELINE INGESTA (PROCESAMIENTO DOCUMENTOS) ===");
type RowDocumentDb = {
  id: string;
  name: string;
  path: string;
  indexed_at: Date | null;
};

const documents = await query<RowDocumentDb>(
  "SELECT id, name, path, indexed_at FROM documents ORDER BY id",
);

const collection = await getCollection();
let chunksTotals = 0;
let indexed = 0;
let skiped = 0;

for (const [position, document] of documents.entries()) {
  console.log("");
  console.log(
    `[${position + 1}/${documents.length}] Procesando documento: ${document.id} -> ${document.name}`,
  );

  if (document.indexed_at) {
    console.log(
      `   documento ya indexado en: ${document.indexed_at.toISOString()}`,
    );
    skiped++;
    continue;
  }

  const start = Date.now();

  //PDF -> texto
  const text = await extractTextFromPDF(document.path);
  console.log(
    `   pdf                 : ${document.path} -> ${text.length} caracteres`,
  );
  //Texto -> chunks
  const chunks = createChunks(text);
  console.log(`   chunks generados    : ${chunks.length}`);
  //Chunks -> embeddings
  const embeddings = await generateEmbeddings(
    chunks.map((chunk) => chunk.text),
  );
  console.log(
    `   embeddings generados: ${embeddings.length} vectores de ${embeddings[0].length} dimensiones`,
  );
  //Embeddings -> ChromaDB
  const ids = chunks.map((chunk) => `${document.id}_${chunk.index}`);
  const metadatas: ChunkMetadata[] = chunks.map((chunk) => ({
    documentId: document.id,
    documentName: document.name,
    chunkIndex: chunk.index,
  }));

  // upsert (no add): si el chunk ya existía, lo sobrescribe en vez de duplicarlo.
  await collection.upsert({
    ids,
    documents: chunks.map((chunk) => chunk.text),
    embeddings,
    metadatas,
  });
  console.log(
    `   chroma      : ${ids.length} chunks guardados (${ids[0]} ... ${ids[ids.length - 1]})`,
  );

  await query("UPDATE documents SET indexed_at = NOW() WHERE id = $1", [
    document.id,
  ]);
  console.log(`   postgres           : indexed_at (${Date.now() - start} ms)`);

  chunksTotals += chunks.length;
  indexed++;
}
console.log("");
console.log("=== FIN PIPELINE INGESTA (PROCESAMIENTO DOCUMENTOS) ===");

// Resumen final del proceso de ingestión
console.log("=== RESUMEN FINAL ===");
console.log(`   documentos indexados      : ${indexed}`);
console.log(`   documentos saltados       : ${skiped}`);
console.log(`   chunks totales            : ${chunksTotals}`);
console.log(`   chunks totales en Chroma  : ${await collection.count()}`);
console.log(`   tiempo total              : ${Date.now() - totalStart} ms`);
console.log("");

const permissions = await query<{ user_id: string; documents: string }>(`
  SELECT u.id AS user_id, STRING_AGG(d.id, ', ' ORDER BY d.id) AS documents
  FROM users u
  JOIN user_documents ud ON ud.user_id = u.id
  JOIN documents d       ON d.id = ud.document_id
  GROUP BY u.id
  ORDER BY u.id
`);

console.log("    Permisos finales:");
for (const permission of permissions) {
  console.log(
    `      usuario: ${permission.user_id} -> documentos: ${permission.documents}`,
  );
}
console.log("");

await pool.end();
