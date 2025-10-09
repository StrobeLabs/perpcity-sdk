import { config } from 'dotenv';
import { beforeAll } from 'vitest';

// Load environment variables for e2e tests
config({ path: '.env.local' });

beforeAll(() => {
  // Validate required environment variables for e2e tests
  if (!process.env.GOLDSKY_BEARER_TOKEN) {
    throw new Error('GOLDSKY_BEARER_TOKEN is required for e2e tests. Please set it in .env.local');
  }
});
