export type Chunk = {
  index: number; // 0, 1, 2, su posicion dentro del documento
  text: string;
};

export const SIZE_CHUNK = 800;
export const SOLAPAMIENTO = 150; // cantidad de caracteres que se solapan entre chunks consecutivos

/**
 * Parte un texto largo en trozos de tamaño `SIZE_CHUNK` con un solapamiento de `SOLAPAMIENTO` caracteres entre ellos.
 * repitiendo los últimos `SOLAPAMIENTO` caracteres del chunk anterior al inicio del siguiente.
 * @param text El texto a dividir en chunks.
 * @returns Un array de objetos `Chunk` con los trozos del texto.
 *
 * @example
 *  texto de 6.226 caracteres -> [ {index: 0, text: "..."}, {index: 1, text: "..."}, ...]
 */
export function createChunks(
  text: string,
  sizeChunk: number = SIZE_CHUNK,
  solapamiento: number = SOLAPAMIENTO,
): Chunk[] {
  const chunks: Chunk[] = [];
  let start = 0;

  while (start < text.length) {
    // Dónde terminaría el chunk si cortáramos a lo bruto.
    let end = Math.min(start + sizeChunk, text.length);

    // Si no es el último trozo, retrocedemos hasta el espacio más cercano
    // para no partir una palabra por la mitad.
    if (end < text.length) {
      const lastSpace = text.lastIndexOf(" ", end);
      // Solo aceptamos ese corte si no nos deja un chunk ridículamente corto.
      if (lastSpace > start + sizeChunk / 2) {
        end = lastSpace;
      }
    }

    const chunk = text.slice(start, end).trim();
    if (chunk.length > 0) {
      chunks.push({ index: chunks.length, text: chunk });
    }

    if (end >= text.length) break;

    // El siguiente chunk empieza ANTES de donde terminó este: ese retroceso
    // es el overlap.
    start = end - solapamiento;
  }
  return chunks;
}
