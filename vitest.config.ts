import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/__tests__/setup.ts'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/e2e/**',
      '**/*.e2e.test.ts',
      '**/integration/**', // Exclude integration tests from unit tests
    ],
    coverage: {
        provider: 'v8',
        include: ['src/**'],
        exlude: ['src/__tests__/**', 'src/abis/**', 'index.ts'],
    },
  },
});
