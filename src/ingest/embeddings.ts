import { DefaultEmbeddingFunction } from "@chroma-core/default-embed";

// Modelo multilingüe ejecutándose DENTRO de Node: no hay API key ni llamadas
// a internet (salvo la primera descarga, que queda cacheada en
// node_modules/@huggingface/transformers/.cache).
//
// NOTA: el modelo por defecto del paquete (all-MiniLM-L6-v2) está entrenado en
// inglés y con español no distingue bien.
export const EMBEDDINGS_MODEL = "Xenova/paraphrase-multilingual-MiniLM-L12-v2";
export const DIMENSIONS = 384;

//Una sola instancia de la función de embeddings se creará y se reutilizará.
// dtype 'q8' = versión cuantizada (118 MB en vez de ~470 MB), suficiente aquí.
const embeddingModel = new DefaultEmbeddingFunction({
  modelName: EMBEDDINGS_MODEL,
  dtype: "q8",
});

/**
 * Convierte varios textos en sus embeddings correspondientes.
 *
 *  ['texto1', 'texto2', ...] -> [[0.1, ...384 numeros], ...]
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  return embeddingModel.generate(texts);
}

/**
 * Lo mismo, pero para un solo texto
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const [embeddings] = await embeddingModel.generate([text]);
  return embeddings;
}
