import { describe, it, expect, beforeAll } from 'vitest';
import { createTestContext, createTestWalletClient, getTestnetConfig } from '../helpers/testnet-config';
import { PerpCityContext } from '../../context';
import TTLCache from '@isaacs/ttlcache';

describe('Context Integration Tests', () => {
  let context: PerpCityContext;
  let config: ReturnType<typeof getTestnetConfig>;

  beforeAll(() => {
    config = getTestnetConfig();
    context = createTestContext();
  });

  describe('Context Initialization', () => {
    it('should create context with wallet client', () => {
      expect(context).toBeInstanceOf(PerpCityContext);
      expect(context.walletClient).toBeDefined();
    });

    it('should have correct deployment addresses', () => {
      const deployments = context.deployments();

      expect(deployments.perpManager).toBe(config.perpManagerAddress);
      expect(deployments.usdc).toBe(config.usdcAddress);
    });

    it('should initialize with TTL config cache', () => {
      // Config cache should use TTLCache with 5-minute expiration
      expect(context['configCache']).toBeInstanceOf(TTLCache);
    });
  });

  describe('getPerpConfig', () => {
    it('should fetch perp config from contract', async () => {
      // Skip if no test perp ID configured
      if (!config.testPerpId) {
        console.log('Skipping: TEST_PERP_ID not configured in .env.local');
        return;
      }

      const perpConfig = await context.getPerpConfig(config.testPerpId as `0x${string}`);

      expect(perpConfig).toBeDefined();
      expect(perpConfig.key).toBeDefined();
      expect(perpConfig.key.currency0).toBeDefined();
      expect(perpConfig.key.currency1).toBeDefined();
      expect(perpConfig.key.tickSpacing).toBeTypeOf('number');
      expect(perpConfig.beacon).toBeDefined();

      // These are module addresses, not objects
      expect(perpConfig.fees).toBeTypeOf('string');
      expect(perpConfig.marginRatios).toBeTypeOf('string');
    }, 30000); // 30 second timeout for network call

    it('should cache perp config after first fetch', async () => {
      if (!config.testPerpId) {
        console.log('Skipping: TEST_PERP_ID not configured in .env.local');
        return;
      }

      const perpId = config.testPerpId as `0x${string}`;

      // First call
      const config1 = await context.getPerpConfig(perpId);

      // Second call should return cached version
      const config2 = await context.getPerpConfig(perpId);

      expect(config1).toEqual(config2);
      expect(context['configCache'].has(perpId)).toBe(true);
    }, 30000);
  });

  describe('getPerpData', () => {
    it('should fetch perp market data from contract', async () => {
      if (!config.testPerpId) {
        console.log('Skipping: TEST_PERP_ID not configured in .env.local');
        return;
      }

      const perpData = await context.getPerpData(config.testPerpId as `0x${string}`);

      expect(perpData).toBeDefined();
      expect(perpData.id).toBe(config.testPerpId); // Note: 'id' not 'perpId'
      expect(perpData.mark).toBeTypeOf('number');
      expect(perpData.beacon).toBeTypeOf('string');
      expect(perpData.tickSpacing).toBeTypeOf('number');

      // Check that mark is a reasonable value (> 0)
      expect(perpData.mark).toBeGreaterThan(0);
    }, 30000);

    it('should include bounds and fees from contract modules', async () => {
      if (!config.testPerpId) {
        console.log('Skipping: TEST_PERP_ID not configured in .env.local');
        return;
      }

      const perpData = await context.getPerpData(config.testPerpId as `0x${string}`);

      // Bounds are now fetched from margin ratio module
      expect(perpData.bounds).toBeDefined();
      expect(perpData.bounds.minMargin).toBe(10); // Still hardcoded in context
      expect(perpData.bounds.minTakerLeverage).toBeTypeOf('number');
      expect(perpData.bounds.minTakerLeverage).toBeGreaterThan(0);
      expect(perpData.bounds.maxTakerLeverage).toBeTypeOf('number');
      expect(perpData.bounds.maxTakerLeverage).toBeGreaterThan(perpData.bounds.minTakerLeverage);

      // Fees are now fetched from fees module
      expect(perpData.fees).toBeDefined();
      expect(perpData.fees.creatorFee).toBeTypeOf('number');
      expect(perpData.fees.creatorFee).toBeGreaterThan(0);
      expect(perpData.fees.insuranceFee).toBeTypeOf('number');
      expect(perpData.fees.insuranceFee).toBeGreaterThan(0);
      expect(perpData.fees.lpFee).toBeTypeOf('number');
      expect(perpData.fees.lpFee).toBeGreaterThan(0);
      expect(perpData.fees.liquidationFee).toBeTypeOf('number');
      expect(perpData.fees.liquidationFee).toBeGreaterThan(0);
    }, 30000);
  });

  describe('getUserData', () => {
    it('should fetch user data with empty positions', async () => {
      const walletClient = createTestWalletClient();
      const userAddress = walletClient.account!.address;

      const userData = await context.getUserData(userAddress, []);

      expect(userData).toBeDefined();
      expect(userData.walletAddress).toBe(userAddress); // Note: 'walletAddress' not 'address'
      expect(userData.usdcBalance).toBeTypeOf('number'); // Note: number, not bigint
      expect(userData.openPositions).toEqual([]);
    }, 30000);

    it('should have non-negative USDC balance', async () => {
      const walletClient = createTestWalletClient();
      const userAddress = walletClient.account!.address;

      const userData = await context.getUserData(userAddress, []);

      expect(userData.usdcBalance).toBeGreaterThanOrEqual(0);
    }, 30000);
  });

  describe('getOpenPositionData', () => {
    it('should throw error for non-existent position', async () => {
      if (!config.testPerpId) {
        console.log('Skipping: TEST_PERP_ID not configured in .env.local');
        return;
      }

      const nonExistentPositionId = 999999999n;

      await expect(async () => {
        await context.getOpenPositionData(
          config.testPerpId as `0x${string}`,
          nonExistentPositionId,
          true,
          false
        );
      }).rejects.toThrow();
    }, 30000);
  });

  describe('Error Handling', () => {
    it('should handle invalid perp ID gracefully', async () => {
      const invalidPerpId = '0x' + '0'.repeat(64) as `0x${string}`;

      await expect(async () => {
        await context.getPerpConfig(invalidPerpId);
      }).rejects.toThrow();
    }, 30000);

    it('should handle invalid user address gracefully', async () => {
      const invalidAddress = '0x0000000000000000000000000000000000000000' as `0x${string}`;

      // Should not throw, just return zero balance
      const userData = await context.getUserData(invalidAddress, []);

      expect(userData.walletAddress).toBe(invalidAddress);
      expect(userData.usdcBalance).toBe(0);
    }, 30000);
  });

  describe('Cache Behavior', () => {
    it('should cache config for same perpId', async () => {
      if (!config.testPerpId) {
        console.log('Skipping: TEST_PERP_ID not configured in .env.local');
        return;
      }

      const perpId = config.testPerpId as `0x${string}`;

      // Clear cache first
      context['configCache'].clear();

      // First call should hit network
      const startTime1 = Date.now();
      await context.getPerpConfig(perpId);
      const duration1 = Date.now() - startTime1;

      // Second call should be cached (much faster)
      const startTime2 = Date.now();
      await context.getPerpConfig(perpId);
      const duration2 = Date.now() - startTime2;

      // Cached call should be significantly faster
      expect(duration2).toBeLessThan(duration1);
      expect(duration2).toBeLessThan(100); // Should be nearly instant
    }, 30000);

    it('should cache perp config with 5-minute TTL', async () => {
      if (!config.testPerpId) {
        console.log('Skipping: TEST_PERP_ID not configured in .env.local');
        return;
      }

      const perpId = config.testPerpId as `0x${string}`;

      // Fetch config - should be cached
      await context.getPerpConfig(perpId);

      // Cache should contain the entry (expires after 5 minutes per context.ts:20)
      expect(context['configCache'].has(perpId)).toBe(true);

      // Note: Cache entries expire after 5 minutes (TTL: 5 * 60 * 1000 ms)
      // To invalidate cache immediately, create a new context instance
    }, 30000);
  });
});
