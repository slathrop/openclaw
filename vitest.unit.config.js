import { defineConfig } from 'vitest/config';
import baseConfig from './vitest.config.js';

const baseTest = baseConfig?.test ?? {};
const include = baseTest.include ?? [
  'src/**/*.test.ts',
  'src/**/*.test.js',
  'extensions/**/*.test.ts',
  'test/format-error.test.ts'
];
const exclude = baseTest.exclude ?? [];

export default defineConfig({
  ...baseConfig,
  test: {
    ...baseTest,
    include,
    exclude: [...exclude, 'src/gateway/**', 'extensions/**']
  }
});
