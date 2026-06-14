import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    environment: "jsdom",
    include: ["tests/**/*.test.{ts,tsx}"],
    exclude: ["tests/e2e/**", "node_modules/**"],
    setupFiles: ["./tests/setup.ts"],
    coverage: {
      provider: "v8",
      include: ["src/lib/**", "src/services/**"],
      exclude: ["src/db/**", "**/*.d.ts"],
    },
  },
});
