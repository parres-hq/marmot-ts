import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier"
import { defineConfig } from "eslint/config";

export default defineConfig([
  {
    files: ["**/*.{js,mjs,cjs,ts,mts,cts}"],
    plugins: { js },
    extends: ["js/recommended"],
    languageOptions: {
      globals: {...globals.browser, ...globals.node}
    }
  },
  tseslint.configs.recommended,
  prettier,
  {
    ignores: ["build/", ".svelte-kit/", "dist/"],
  },
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {args: "none", destructuredArrayIgnorePattern: "^_d?$", caughtErrors: "none"},
      ],
    }
  }
]);
