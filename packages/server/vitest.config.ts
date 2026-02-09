import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    testTimeout: 30000,
    hookTimeout: 30000,
    teardownTimeout: 10000,
    envDir: path.resolve(__dirname, '.'),
    // Run tests sequentially to avoid database deadlocks and reduce RAM usage
    threads: 1,
    maxThreads: 1,
    fileParallelism: false,
    env: {
      // Ensure test database URL is set correctly for the weft-test-postgres container
      DATABASE_URL: 'postgres://weft_test:weft_test_password@localhost:5433/weft_test',
      TEST_DATABASE_URL: 'postgres://weft_test:weft_test_password@localhost:5433/weft_test',
    },
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
