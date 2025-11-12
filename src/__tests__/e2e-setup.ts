import { config } from 'dotenv';
import { beforeAll } from 'vitest';

// Load environment variables for e2e tests
config({ path: '.env.local' });

beforeAll(() => {
  // Validate required environment variables for e2e tests
  if (!process.env.RPC_URL) {
    throw new Error('RPC_URL is required for e2e tests. Please set it in .env.local');
  }
  if (!process.env.PRIVATE_KEY) {
    throw new Error('PRIVATE_KEY is required for e2e tests. Please set it in .env.local');
  }
  if (!process.env.PERP_MANAGER_ADDRESS) {
    throw new Error('PERP_MANAGER_ADDRESS is required for e2e tests. Please set it in .env.local');
  }
  if (!process.env.USDC_ADDRESS) {
    throw new Error('USDC_ADDRESS is required for e2e tests. Please set it in .env.local');
  }
});
