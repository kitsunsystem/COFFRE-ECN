import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: { environment: "node", exclude: ["**/node_modules/**", "out/**", "android/**", "ios/**", "supabase/functions/**", "tests/e2e/**"] },
});
