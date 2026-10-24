import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    // Date tests must not depend on the machine time zone.
    env: { TZ: "UTC" },
    include: ["src/**/*.test.ts"],
    exclude: ["src/tests/e2e/**", "node_modules/**"],
  },
});
