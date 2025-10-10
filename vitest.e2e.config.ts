import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/__tests__/e2e-setup.ts'],
    include: ['src/__tests__/e2e/**/*.test.ts'],
    testTimeout: 30000, // 30 seconds for e2e tests
  },
});
