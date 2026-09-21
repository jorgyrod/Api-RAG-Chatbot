import Exceljs from "exceljs";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { EXCEL_PATH } from "../ingest/excel";
/**
 * Rows to be written to the Excel file
 */
const rows = [
  {
    user_id: "USR001",
    document_id: "DOC001",
    document_name: "Contrato fideicomiso",
    path: "storage/contrato-fideicomiso.pdf",
  },
  {
    user_id: "USR001",
    document_id: "DOC002",
    document_name: "Reglamento",
    path: "storage/reglamento.pdf",
  },
  {
    user_id: "USR002",
    document_id: "DOC003",
    document_name: "Otro contrato",
    path: "storage/otro-contrato.pdf",
  },
];

const workbook = new Exceljs.Workbook();
const sheet = workbook.addWorksheet("documents");

sheet.columns = [
  { header: "user_id", key: "user_id", width: 12 },
  { header: "document_id", key: "document_id", width: 14 },
  { header: "document_name", key: "document_name", width: 26 },
  { header: "path", key: "path", width: 40 },
];

sheet.addRows(rows);

mkdirSync(dirname(EXCEL_PATH), { recursive: true });
await workbook.xlsx.writeFile(EXCEL_PATH);

console.log(`Excel file has been generated at: ${EXCEL_PATH}`);
console.log(`Rows have been added: ${rows.length}`);
