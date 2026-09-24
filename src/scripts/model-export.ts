import { cpSync, existsSync, mkdirSync } from "node:fs";
import { EMBEDDINGS_MODEL } from "../ingest/embeddings";

const ORIGIN = `node_modules/@huggingface/transformers/.cache/${EMBEDDINGS_MODEL}`;
const DESTINATION = `models/${EMBEDDINGS_MODEL}`;

if (!existsSync(ORIGIN)) {
  console.log(`No se encontro el modelo en ${ORIGIN}`);
  console.log(
    'Ejecutar primero "npm run embeddings" para que se descargue el modelo',
  );
  process.exit(1);
}

mkdirSync(DESTINATION, { recursive: true });
cpSync(ORIGIN, DESTINATION, { recursive: true });

console.log(`Modelo exportado a ${DESTINATION}`);
