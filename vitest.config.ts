import { defineConfig } from "vitest/config";

/**
 * Tres "projects" con propósitos distintos y coste distinto:
 *
 *   unit        → sin Docker, sin red, sin dinero. Debe correr en segundos.
 *   integration → exige `docker compose up -d` (PostgreSQL + ChromaDB reales).
 *   e2e         → flujo completo: fixtures → ingesta → login → chat.
 *
 * Separarlos importa: `npm test` tiene que ser lo bastante rápido como para
 * ejecutarlo en cada guardado. Si mezcláramos los tres, dejarías de usarlo.
 */
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "unit",
          root: import.meta.dirname,
          include: ["tests/unit/**/*.test.ts"],
          environment: "node",
        },
      },
      {
        test: {
          name: "integration",
          root: import.meta.dirname,
          include: ["tests/integration/**/*.test.ts"],
          environment: "node",
          // La infraestructura real es lenta de arrancar.
          testTimeout: 60_000,
          hookTimeout: 120_000,
          // Comparten PostgreSQL y ChromaDB: en paralelo se pisarían.
          fileParallelism: false,
        },
      },
      {
        test: {
          name: "e2e",
          root: import.meta.dirname,
          include: ["tests/e2e/**/*.test.ts"],
          environment: "node",
          testTimeout: 120_000,
          hookTimeout: 180_000,
          fileParallelism: false,
        },
      },
    ],
  },
});
