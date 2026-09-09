import { config as loadDotenv } from "dotenv";
import { z } from "zod";

/**
 * Configuracion de variables de entorno
 *
 * Aqui se definen y cargan las variables de entorno, si falta alguna fallara
 * asi nos aseguramos de que no arranque si faltan variables
 */

const booleanFromString = z
  .enum(["true", "false", "1", "0"])
  .transform((val) => val === "true" || val === "1");

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace"])
    .default("info"),
  LOG_PRETTY: booleanFromString.default(false),

  // PostgreSQL
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),

  // ---- ChromaDB ----
  CHROMA_URL: z.url(),
  CHROMA_COLLECTION: z.string().min(1).default("document_chunks"),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Valida un objeto de entorno arbitrario
 *
 * Es utilizada para poder testearla sin acceder directamente a 'process.env'
 */
export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(source);

  if (!result.success) {
    const details = result.error.issues
      .map(
        (issue) => `  - ${issue.path.join(".") || "(raíz)"}: ${issue.message}`,
      )
      .join("\n");
    throw new Error(`Configuración de entorno inválida:\n${details}`);
  }

  return result.data;
}

let cached: Env | undefined;

/**
 * Carga y valida el entorno del proceso una sola vez.
 *
 * Se llama explícitamente desde el composition root (`src/app.ts`) y desde los
 * jobs. El resultado se pasa hacia abajo por inyección de dependencias: ningún
 * módulo de dominio importa este archivo.
 */
export function loadEnv(): Env {
  if (cached === undefined) {
    loadDotenv();
    cached = parseEnv(process.env);
  }
  return cached;
}

/** Limpia la caché. Solo para tests que necesitan recargar con otro entorno. */
export function resetEnvCache(): void {
  cached = undefined;
}
