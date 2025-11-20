import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/__tests__/e2e-setup.ts'],
    include: ['src/__tests__/integration/**/*.test.ts'],
    testTimeout: 30000, // 30 seconds for integration tests
    fileParallelism: false, // Run test files sequentially to avoid state conflicts
    pool: 'forks', // Use forked processes for better isolation
    sequence: {
      concurrent: false, // Disable concurrent execution
      shuffle: false, // Disable shuffling to maintain consistent order
    },
    maxConcurrency: 1, // Only run 1 test file at a time
  },
});
