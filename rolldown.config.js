// rolldown.config.js
// Bundles source into dist/ for production.
// Replaces the previous tsdown configuration.
// Entry points reference .ts files (rolldown strips types natively, no tsc needed).
// These will be updated to .js when source files convert in Phase 2+.
import { defineConfig } from "rolldown";

export default defineConfig([
  {
    input: "src/index.ts",
    output: {
      dir: "dist",
      format: "esm",
    },
    platform: "node",
    define: {
      "process.env.NODE_ENV": JSON.stringify("production"),
    },
  },
  {
    input: "src/entry.ts",
    output: {
      dir: "dist",
      format: "esm",
    },
    platform: "node",
    define: {
      "process.env.NODE_ENV": JSON.stringify("production"),
    },
  },
  {
    input: "src/plugin-sdk/index.ts",
    output: {
      dir: "dist/plugin-sdk",
      format: "esm",
    },
    platform: "node",
    define: {
      "process.env.NODE_ENV": JSON.stringify("production"),
    },
  },
  {
    input: "src/extensionAPI.ts",
    output: {
      dir: "dist",
      format: "esm",
    },
    platform: "node",
    define: {
      "process.env.NODE_ENV": JSON.stringify("production"),
    },
  },
]);
