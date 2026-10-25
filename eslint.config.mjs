import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Native projects and server functions (Deno) are checked by their own tools.
    "android/**",
    "ios/**",
    "supabase/functions/**",
  ]),
  {
    rules: {
      // French copy is full of apostrophes: JSX renders them fine.
      "react/no-unescaped-entities": "off",
      "@typescript-eslint/no-unused-vars": ["warn", { varsIgnorePattern: "^_", argsIgnorePattern: "^_" }],
    },
  },
]);

export default eslintConfig;
