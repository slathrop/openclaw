import { defineConfig } from "vitest/config";
import baseConfig from "./vitest.config.js";

const baseTest = baseConfig?.test ?? {};
const exclude = baseTest.exclude ?? [];

export default defineConfig({
  ...baseConfig,
  test: {
    ...baseTest,
    include: ["extensions/**/*.test.ts"],
    exclude,
  },
});
