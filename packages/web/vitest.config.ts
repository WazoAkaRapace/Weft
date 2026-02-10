import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    conditions: ['default', 'types'],
  },
  optimizeDeps: {
    // Force pre-bundling of packages with broken type definition imports
    include: [
      'better-auth/react',
      'react-router',
      'react-router-dom',
      '@testing-library/user-event',
    ],
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{ts,tsx}', 'test/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', 'dist'],
    setupFiles: ['./vitest.setup.ts'],
    // Run tests sequentially to avoid filling RAM with multiple jsdom instances
    threads: 1,
    maxThreads: 1,
    fileParallelism: false,
  },
});
