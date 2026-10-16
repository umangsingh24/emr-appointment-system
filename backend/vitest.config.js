import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globalSetup: ['./tests/globalSetup.js'],
    setupFiles: ['./tests/setupEnv.js'],
    // Test files share one in-memory replica set; run them sequentially to keep data isolated.
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 120_000, // first run downloads the MongoDB binary
  },
});
