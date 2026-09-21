// Indexamos DOS documentos: el de USR001 y el de USR002.

import {
  chroma,
  NAME_COLLECTION,
  getCollection,
  ChunkMetadata,
} from "../chroma/chroma";
import { extractTextFromPDF } from "../ingest/pdf";
import { createChunks } from "../ingest/chunking";
import { generateEmbedding, generateEmbeddings } from "../ingest/embeddings";

// Los dos hablan de desistimiento, con cifras DISTINTAS.
const documentos = [
  {
    id: "DOC001",
    nombre: "Contrato fideicomiso",
    archivo: "storage/contrato-fideicomiso.pdf",
  },
  {
    id: "DOC003",
    nombre: "Otro contrato",
    archivo: "storage/otro-contrato.pdf",
  },
];

// ---------------------------------------------------------------------------
// 1. Empezar de cero para que el experimento sea reproducible.
// ---------------------------------------------------------------------------
try {
  await chroma.deleteCollection({ name: NAME_COLLECTION });
  console.log(`Colección "${NAME_COLLECTION}" borrada (empezamos limpio)`);
} catch {
  console.log(`Colección "${NAME_COLLECTION}" no existía todavía`);
}

const coleccion = await getCollection();
console.log("");

// ---------------------------------------------------------------------------
// 2. Guardar los chunks: texto + vector + metadata.
// ---------------------------------------------------------------------------
for (const doc of documentos) {
  const texto = await extractTextFromPDF(doc.archivo);
  const chunks = createChunks(texto);
  const vectores = await generateEmbeddings(chunks.map((c) => c.text));

  const ids = chunks.map((c) => `${doc.id}::${c.index}`);
  const metadatas: ChunkMetadata[] = chunks.map((c) => ({
    documentId: doc.id,
    documentName: doc.nombre,
    chunkIndex: c.index,
  }));

  await coleccion.add({
    ids,
    documents: chunks.map((c) => c.text),
    embeddings: vectores,
    metadatas,
  });

  console.log(
    `${doc.id}: ${chunks.length} chunks guardados  (ids ${ids[0]} ... ${ids[ids.length - 1]})`,
  );
}

console.log("");
console.log("Total de chunks en la colección:", await coleccion.count());
console.log("");

// ---------------------------------------------------------------------------
// 3. ¿QUÉ guardó exactamente? Sacamos UN registro y lo miramos entero.
// ---------------------------------------------------------------------------
console.log("=== UN REGISTRO, TAL CUAL ESTÁ GUARDADO ===");
const registro = await coleccion.get({
  ids: ["DOC001::7"],
  include: ["documents", "metadatas", "embeddings"],
});

console.log("id       :", registro.ids[0]);
console.log("metadata :", registro.metadatas[0]);
console.log(
  "document :",
  `"${String(registro.documents[0]).slice(0, 120)}..."`,
);
const emb = registro.embeddings?.[0] ?? [];
console.log(
  "embedding:",
  `[${[...emb]
    .slice(0, 6)
    .map((n) => n.toFixed(4))
    .join(", ")}, ...] (${emb.length} números)`,
);
console.log("");

// ---------------------------------------------------------------------------
// 4. LA BÚSQUEDA SEMÁNTICA.
// ---------------------------------------------------------------------------
const pregunta = "desistir del fideicomiso";
const vectorPregunta = await generateEmbedding(pregunta);

console.log("=".repeat(72));
console.log(`BÚSQUEDA: "${pregunta}"   (sin filtro de permisos todavía)`);
console.log("=".repeat(72));

const resultado = await coleccion.query({
  queryEmbeddings: [vectorPregunta],
  nResults: 4,
  include: ["documents", "metadatas", "distances"],
});

// Así viene la respuesta cruda de Chroma: arrays de arrays.
console.log("");
console.log("Forma de la respuesta:");
console.log("   ids       ->", JSON.stringify(resultado.ids));
console.log(
  "   distances ->",
  JSON.stringify(
    resultado.distances?.[0].map((d) => Number((d ?? 0).toFixed(4))),
  ),
);
console.log(
  "   (cada campo es un array POR PREGUNTA; nosotros mandamos 1 pregunta)",
);
console.log("");

for (let i = 0; i < resultado.ids[0].length; i++) {
  const meta = resultado.metadatas[0][i] as ChunkMetadata;
  const distancia = resultado.distances?.[0][i] ?? 0;
  const texto = String(resultado.documents[0][i]).replace(/\n/g, " ");

  console.log(
    `${i + 1}. ${meta.documentId} - chunk ${meta.chunkIndex}   (${meta.documentName})`,
  );
  console.log(
    `   distancia: ${distancia.toFixed(4)}   similitud: ${(1 - distancia).toFixed(4)}`,
  );
  console.log(`   "${texto.slice(0, 150)}..."`);
  console.log("");
}

// ---------------------------------------------------------------------------
// 5. LA MISMA BÚSQUEDA, FILTRADA POR DOCUMENTO.
//    Esto es exactamente lo que hará el sistema de permisos en la Parte 10.
// ---------------------------------------------------------------------------
console.log("=".repeat(72));
console.log(
  `MISMA BÚSQUEDA, pero SOLO en DOC001   (where documentId $in ["DOC001"])`,
);
console.log("=".repeat(72));

const filtrado = await coleccion.query({
  queryEmbeddings: [vectorPregunta],
  nResults: 4,
  where: { documentId: { $in: ["DOC001"] } },
  include: ["documents", "metadatas", "distances"],
});

console.log("");
for (let i = 0; i < filtrado.ids[0].length; i++) {
  const meta = filtrado.metadatas[0][i] as ChunkMetadata;
  const distancia = filtrado.distances?.[0][i] ?? 0;
  console.log(
    `${i + 1}. ${meta.documentId} - chunk ${meta.chunkIndex}   distancia ${distancia.toFixed(4)}`,
  );
}

console.log("");
console.log(
  "¿Aparece algún chunk de DOC003?",
  filtrado.metadatas[0].some(
    (m) => (m as ChunkMetadata).documentId === "DOC003",
  )
    ? "SÍ (MAL)"
    : "NO (BIEN)",
);

// ---------------------------------------------------------------------------
// 6. LA FORMULACIÓN DE LA CONSULTA IMPORTA.
//    La misma idea, escrita de dos maneras, da rankings distintos.
// ---------------------------------------------------------------------------
console.log("");
console.log("=".repeat(72));
console.log("LA MISMA IDEA, PREGUNTADA DE DOS FORMAS");
console.log("=".repeat(72));

const formulaciones = [
  "desistir del fideicomiso",
  "¿Qué debo pagar si quiero desistir de mi fideicomiso?",
  "¿cuánto es la penalización por terminar mi contrato antes de tiempo?",
];

for (const formulacion of formulaciones) {
  const vector = await generateEmbedding(formulacion);
  const r = await coleccion.query({
    queryEmbeddings: [vector],
    nResults: 3,
    where: { documentId: { $in: ["DOC001"] } },
    include: ["metadatas", "distances"],
  });

  const top = r.metadatas[0].map((m, i) => {
    const meta = m as ChunkMetadata;
    return `chunk ${meta.chunkIndex} (${(r.distances?.[0][i] ?? 0).toFixed(3)})`;
  });

  console.log("");
  console.log(`   "${formulacion}"`);
  console.log(`   -> ${top.join("   ")}`);
}

console.log("");
console.log("(el chunk 7 es el que contiene la pena del 3% y los $5.000)");
