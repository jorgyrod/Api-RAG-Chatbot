import { statSync } from "node:fs";
import { extractTextFromPDF } from "../ingest/pdf";

const file = process.argv[2] ?? "storage/contrato-fideicomiso.pdf";

const bytes = statSync(file);

console.log("IN (Binary file):", file);
console.log(`    ${file} (${bytes.size} bytes)`);
console.log("");

const text = await extractTextFromPDF(file);

console.log("OUT (string of plain text):");
console.log(`    ${text.length} characters`);
console.log(`   ${text.split(/\s+/).length} words`);
console.log("");

console.log("=== First 700 characters ===");
console.log(text.slice(0, 700));
console.log("");

console.log("=== Last 300 characters ===");
console.log(text.slice(-300));
console.log("");

// Survive the accents and special characters
const accents = (text.match(/[áéíóúñÁÉÍÓÚÑ]/g) ?? []).length;
console.log(`Number of accented characters: ${accents}`);

// Is the information our user is looking for there?
const searchTerm = [
  "desistimiento",
  "pena convencional",
  "tres por ciento",
  "cinco mil pesos",
];
console.log("");
console.log("=== DOES IT CONTAIN WHAT WE'RE INTERESTED IN? ===");
for (const term of searchTerm) {
  const found = text.toLowerCase().indexOf(term.toLowerCase());
  console.log(
    `    ${found >= 0 ? "Yes" : "No"}   "${term}"${found >= 0 ? ` (position: ${found})` : ""}`,
  );
}
