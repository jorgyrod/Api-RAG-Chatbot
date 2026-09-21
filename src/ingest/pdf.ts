import { readFile } from "node:fs/promises";
import { PDFParse } from "pdf-parse";

/**
 * Convert a file PDF to text content.
 */
export async function extractTextFromPDF(file: string): Promise<string> {
  const bytes = await readFile(file);

  const parser = new PDFParse({ data: bytes });

  try {
    // getText() extracts the text content from the PDF file.
    const result = await parser.getText();
    return cleanText(result.text);
  } finally {
    // destroy() releases any resources held by the parser.
    await parser.destroy();
  }
}

/**
 * Remove the noise introduced by the extraction that is NOT part of the content.
 */
function cleanText(text: string): string {
  return (
    text
      // pdf-parse inserta '-- 1 of 2 --' entre página y página. Eso no está en
      // el documento y además parte frases por la mitad. Nos comemos también
      // los saltos de línea de alrededor para volver a unir la frase.
      .replace(/\s*--\s*\d+\s+of\s+\d+\s*--\s*/g, " ")
      // Espacios repetidos -> uno solo (sin tocar los saltos de línea).
      .replace(/[ \t]+/g, " ")
      // Tres o más saltos de línea -> dos (un párrafo en blanco como máximo).
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}
