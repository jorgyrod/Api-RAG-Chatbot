import "dotenv/config";
import { readFileSync } from "node:fs";
import pg from "pg";
import { pool, query } from "./postgres";

/**
 * Creates the database 'ragchatbot' if it does not already exist.
 */
async function createDatabaseIfMissing() {
  const admin = new pg.Client({
    connectionString: process.env.ADMIN_DATABASE_URL,
  });
  await admin.connect();

  const { rows } = await admin.query(
    "SELECT 1 FROM pg_database WHERE datname = 'ragchatbot'",
  );

  if (rows.length === 0) {
    await admin.query("CREATE DATABASE ragchatbot");
    console.log("[1/3] Database 'ragchatbot' created");
  } else {
    console.log("[1/3] Database 'ragchatbot' already exists");
  }
  await admin.end();
}

/**
 * Creates the necessary tables in the 'ragchatbot' database.
 */
async function createTables() {
  const schemaPath = new URL("./schema.sql", import.meta.url);
  const schemaSql = readFileSync(schemaPath, "utf-8");

  await pool.query(schemaSql);
  console.log("[2/3] Tables created successfully");
}

/**
 * Inserts the initial seed data into the 'ragchatbot' database tables.
 */
async function insertSeedData() {
  await query(`
        INSERT INTO users (id, name) VALUES
            ('USR001', 'Mithranthir'),
            ('USR002', 'Eldarion Aragorn')
        ON CONFLICT (id) DO NOTHING;
    `);

  await query(`
        INSERT into documents (id, name, path) VALUES
            ('DOC001', 'Contrato fideicomiso', 'storage/contrato-fideicomiso.pdf'),
            ('DOC002', 'Reglamento', 'storage/reglamento.pdf'),
            ('DOC003', 'Otro contrato', 'storage/otro-contrato.pdf')
        ON CONFLICT (id) DO NOTHING;
    `);

  await query(`
        INSERT INTO user_documents (user_id, document_id) VALUES
            ('USR001', 'DOC001'),
            ('USR001', 'DOC002'),
            ('USR002', 'DOC003')
        ON CONFLICT (user_id, document_id) DO NOTHING;
    `);

  console.log("[3/3] Seed data inserted successfully");
}

// ----------------------------------------
// Visual verification: What see each user has access to which documents
type PermissionRow = {
  user_id: string;
  user_name: string;
  document_id: string;
  document_name: string;
};

async function getUserPermissions() {
  const rows = await query<PermissionRow>(`
    SELECT u.id   AS user_id,
           u.name AS user_name,
           d.id   AS document_id,
           d.name AS document_name
    FROM users u
    JOIN user_documents ud ON ud.user_id = u.id
    JOIN documents d       ON d.id = ud.document_id
    ORDER BY u.id, d.id
  `);

  console.log("");
  console.log("=== User Permissions ===");

  let actualUser = "";
  for (const row of rows) {
    if (row.user_id !== actualUser) {
      actualUser = row.user_id;
      console.log(
        `User: ${row.user_name} (ID: ${row.user_id}) has access to following documents:`,
      );
    }
    console.log(`  Document: ${row.document_name} (ID: ${row.document_id})`);
  }
  console.log("");
}

async function main() {
  await createDatabaseIfMissing();
  await createTables();
  await insertSeedData();
  await getUserPermissions();
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
