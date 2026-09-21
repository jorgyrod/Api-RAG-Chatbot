import { query } from "../db/postgres";

/**
 * Obtiene los documentos que puede acceder un usuario dado.
 */
export async function getUserDocuments(userId: string): Promise<string[]> {
  const rows = await query<{ document_id: string }>(
    "SELECT document_id FROM user_documents WHERE user_id = $1 ORDER BY document_id",
    [userId],
  );
  return rows.map((row) => row.document_id);
}
