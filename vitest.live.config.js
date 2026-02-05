import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    pool: 'forks',
    maxWorkers: 1,
    include: ['src/**/*.live.test.js'],
    setupFiles: ['test/setup.js'],
    exclude: [
      'dist/**',
      'apps/macos/**',
      'apps/macos/.build/**',
      '**/vendor/**',
      'dist/OpenClaw.app/**'
    ]
  }
});
