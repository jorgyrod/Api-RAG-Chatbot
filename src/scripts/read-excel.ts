import { EXCEL_PATH, readExcel } from "../ingest/excel";

console.log(`Reading Excel file...`);
console.log("     ", EXCEL_PATH);
console.log(`Done reading Excel file.`);

const rows = await readExcel(EXCEL_PATH);

console.log("SALE (Array of objects js):", rows);
console.log("Number of rows read:", rows.length);

console.log("=== EXCEL DATA ===");
console.table(rows);

const uniqueDocumentIds = new Set(rows.map((row) => row.documentId));
console.log(`Rows in the Excel: ${rows.length}`);
console.log(`Unique document IDs: ${uniqueDocumentIds.size} ->`, [
  ...uniqueDocumentIds,
]);
