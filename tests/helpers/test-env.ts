import { parseEnv, type Env } from "../../src/config/env.js";

/**
 * Entorno para los tests de integración.
 */
export function testEnv(overrides: Record<string, string> = {}): Env {
  return parseEnv({
    NODE_ENV: "test",
    // Base SEPARADA de la de desarrollo: los tests la vacían entre casos y no
    // deben destruir los datos con los que estés probando el chat a mano.
    DATABASE_URL:
      process.env.TEST_DATABASE_URL ??
      "postgresql://rag:rag@localhost:5433/ragchat_test",
    CHROMA_URL: process.env.TEST_CHROMA_URL ?? "http://localhost:8000",
    JWT_SECRET: "test-secret-de-al-menos-32-caracteres-para-hmac",
    LOG_LEVEL: "error",

    // Proveedores deterministas: sin red, sin coste, resultados reproducibles.
    EMBEDDING_PROVIDER: "hashing",
    LLM_PROVIDER: "scripted",

    ...overrides,
  });
}
