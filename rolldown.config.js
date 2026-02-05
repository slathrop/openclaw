// rolldown.config.js
// Bundles source into dist/ for production.
// Replaces the previous tsdown configuration.
// Entry points reference .ts files (rolldown strips types natively, no tsc needed).
// These will be updated to .js when source files convert in Phase 2+.
import { defineConfig } from 'rolldown';

// Externalize all bare imports (node_modules).
// tsdown did this automatically; rolldown requires explicit config.
const external = (id) => !id.startsWith('.') && !id.startsWith('/');

const shared = {
  platform: 'node',
  external,
  define: {
    'process.env.NODE_ENV': JSON.stringify('production')
  }
};

export default defineConfig([
  {
    input: 'src/index.js',
    output: {
      dir: 'dist',
      format: 'esm'
    },
    ...shared
  },
  {
    input: 'src/entry.js',
    output: {
      dir: 'dist',
      format: 'esm'
    },
    ...shared
  },
  {
    input: 'src/plugin-sdk/index.js',
    output: {
      dir: 'dist/plugin-sdk',
      format: 'esm'
    },
    ...shared
  },
  {
    input: 'src/extensionAPI.js',
    output: {
      dir: 'dist',
      format: 'esm'
    },
    ...shared
  }
]);
