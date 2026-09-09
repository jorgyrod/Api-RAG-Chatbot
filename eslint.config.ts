// @ts-check
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

export default tseslint.config(
  {
    ignores: ["dist/**", "node_modules/**", "coverage/**", "storage/**"],
  },

  js.configs.recommended,

  // detectan promesas sin await,
  ...tseslint.configs.recommendedTypeChecked,

  {
    languageOptions: {
      globals: { ...globals.node },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Una promesa sin await en el pipeline de ingesta significa
      // "el job termina antes de indexar". Error, no warning.
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",

      // Permitimos `_algo` para parámetros deliberadamente no usados
      // (firmas de interfaz que una implementación concreta ignora).
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],

      // Fuerza `import type` cuando solo se importan tipos: necesario
      // porque tsconfig usa verbatimModuleSyntax.
      "@typescript-eslint/consistent-type-imports": "error",
    },
  },

  {
    files: ["eslint.config.js"],
    extends: [tseslint.configs.disableTypeChecked],
  },
);
