import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Run only project tests (not transpiled artifacts or dependency tests).
    include: ["src/**/*.test.{js,ts}", "functions/src/**/*.test.{js,ts}"],
    exclude: ["node_modules/**", "functions/lib/**", "dist/**", ".git/**"],
  },
});
