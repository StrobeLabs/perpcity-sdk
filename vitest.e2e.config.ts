import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/__tests__/integration/**/*.test.ts'],
    testTimeout: 30000, // 30 seconds for Anvil-based integration tests
    hookTimeout: 60000, // 60 seconds for beforeAll/afterAll hooks (contract deployment)
    fileParallelism: false, // Run test files sequentially to avoid state conflicts
    pool: 'forks', // Use forked processes for better isolation
    sequence: {
      concurrent: false, // Disable concurrent execution
      shuffle: false, // Disable shuffling to maintain consistent order
    },
    maxConcurrency: 1, // Only run 1 test file at a time
  },
});
