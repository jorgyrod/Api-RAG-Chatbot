import Exceljs from "exceljs";

export const EXCEL_PATH = "data/documents.xlsx";

export type DocumentRow = {
  userId: string;
  documentId: string;
  documentName: string;
  path: string;
};

export async function readExcel(
  file: string = EXCEL_PATH,
): Promise<DocumentRow[]> {
  const workbook = new Exceljs.Workbook();
  await workbook.xlsx.readFile(file);

  const sheet = workbook.worksheets[0];

  const headers: Record<number, string> = {};
  sheet.getRow(1).eachCell((cell, colNumber) => {
    headers[colNumber] = cell.text.trim();
  });

  const rows: DocumentRow[] = [];

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // Skip header

    const rowData: Record<string, string> = {};
    row.eachCell((cell, colNumber) => {
      const column = headers[colNumber];
      if (column) {
        rowData[column] = cell.text.trim();
      }
    });
    if (Object.keys(rowData).length > 0) {
      rows.push({
        userId: rowData.user_id ?? "",
        documentId: rowData.document_id ?? "",
        documentName: rowData.document_name ?? "",
        path: rowData.path ?? "",
      });
    }
  });

  return rows;
}
