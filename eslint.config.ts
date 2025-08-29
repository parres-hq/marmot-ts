import js from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier"
import { defineConfig } from "eslint/config";

export default defineConfig([
  {ignores: ["dist/"]},
  js.configs.recommended,
  tseslint.configs.recommended,
  prettier,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {args: "none", destructuredArrayIgnorePattern: "^_d?$", caughtErrors: "none"},
      ],
    }
  }
]);
