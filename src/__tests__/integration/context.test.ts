import TTLCache from "@isaacs/ttlcache";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PerpCityContext } from "../../context";
import {
  type AnvilSetup,
  setupAnvil,
  setupMockPosition,
  setupMockQuoteResult,
} from "../helpers/anvil-setup";

describe("Context Integration Tests", () => {
  let setup: AnvilSetup;
  let context: PerpCityContext;
  const TEST_POSITION_ID = 100n;
  const TEST_POSITION_MARGIN = 500_000000n; // 500 USDC (6 decimals)

  beforeAll(async () => {
    setup = await setupAnvil();
    context = setup.context;

    // Set up a mock position for getPositionRawData tests
    await setupMockPosition(
      setup,
      TEST_POSITION_ID,
      setup.testPerpId,
      TEST_POSITION_MARGIN, // margin (raw, 6 decimals)
      1000_000000n, // entryPerpDelta (long 1000 units)
      -1000_000000n, // entryUsdDelta (paid 1000 USD)
      { min: 100000, max: 500000, liq: 50000 }
    );

    // Set up quote result for getOpenPositionData tests
    await setupMockQuoteResult(
      setup,
      TEST_POSITION_ID,
      50_000000n, // pnl: +50 USDC
      -5_000000n, // funding: -5 USDC
      545_000000n, // netMargin: 545 USDC
      false // not liquidated
    );
  }, 60000);

  afterAll(() => {
    setup?.cleanup();
  });

  describe("Context Initialization", () => {
    it("should create context with wallet client", () => {
      expect(context).toBeInstanceOf(PerpCityContext);
      expect(context.walletClient).toBeDefined();
    });

    it("should have correct deployment addresses", () => {
      const deployments = context.deployments();

      expect(deployments.perpManager).toBe(setup.addresses.perpManager);
      expect(deployments.usdc).toBe(setup.addresses.usdc);
    });

    it("should initialize with TTL config cache", () => {
      expect((context as any).configCache).toBeInstanceOf(TTLCache);
    });
  });

  describe("getPerpConfig", () => {
    it("should fetch perp config from contract", async () => {
      const perpConfig = await context.getPerpConfig(setup.testPerpId);

      expect(perpConfig).toBeDefined();
      expect(perpConfig.key).toBeDefined();
      expect(perpConfig.key.currency0).toBeDefined();
      expect(perpConfig.key.currency1).toBeDefined();
      expect(perpConfig.key.tickSpacing).toBeTypeOf("number");
      expect(perpConfig.beacon).toBeDefined();
      expect(perpConfig.fees).toBeTypeOf("string");
      expect(perpConfig.marginRatios).toBeTypeOf("string");
    });

    it("should cache perp config after first fetch", async () => {
      const config1 = await context.getPerpConfig(setup.testPerpId);
      const config2 = await context.getPerpConfig(setup.testPerpId);

      expect(config1).toEqual(config2);
      expect((context as any).configCache.has(setup.testPerpId)).toBe(true);
    });
  });

  describe("getPerpData", () => {
    it("should fetch perp market data from contract", async () => {
      const perpData = await context.getPerpData(setup.testPerpId);

      expect(perpData).toBeDefined();
      expect(perpData.id).toBe(setup.testPerpId);
      expect(perpData.mark).toBeTypeOf("number");
      expect(perpData.beacon).toBeTypeOf("string");
      expect(perpData.tickSpacing).toBeTypeOf("number");
      expect(perpData.mark).toBeGreaterThan(0);
    });

    it("should include bounds and fees from contract modules", async () => {
      const perpData = await context.getPerpData(setup.testPerpId);

      expect(perpData.bounds).toBeDefined();
      expect(perpData.bounds.minMargin).toBe(10);
      expect(perpData.bounds.minTakerLeverage).toBeTypeOf("number");
      expect(perpData.bounds.minTakerLeverage).toBeGreaterThan(0);
      expect(perpData.bounds.maxTakerLeverage).toBeTypeOf("number");
      expect(perpData.bounds.maxTakerLeverage).toBeGreaterThan(perpData.bounds.minTakerLeverage);

      expect(perpData.fees).toBeDefined();
      expect(perpData.fees.creatorFee).toBeTypeOf("number");
      expect(perpData.fees.creatorFee).toBeGreaterThan(0);
      expect(perpData.fees.insuranceFee).toBeTypeOf("number");
      expect(perpData.fees.insuranceFee).toBeGreaterThan(0);
      expect(perpData.fees.lpFee).toBeTypeOf("number");
      expect(perpData.fees.lpFee).toBeGreaterThan(0);
      expect(perpData.fees.liquidationFee).toBeTypeOf("number");
      expect(perpData.fees.liquidationFee).toBeGreaterThan(0);
    });
  });

  describe("getUserData", () => {
    it("should fetch user data with empty positions", async () => {
      const userData = await context.getUserData(setup.account, []);

      expect(userData).toBeDefined();
      expect(userData.walletAddress).toBe(setup.account);
      expect(userData.usdcBalance).toBeTypeOf("number");
      expect(userData.openPositions).toEqual([]);
    });

    it("should have non-negative USDC balance", async () => {
      const userData = await context.getUserData(setup.account, []);
      expect(userData.usdcBalance).toBeGreaterThanOrEqual(0);
    });
  });

  describe("getOpenPositionData", () => {
    it("should throw error for non-existent position", async () => {
      const nonExistentPositionId = 999999999n;

      await expect(async () => {
        await context.getOpenPositionData(setup.testPerpId, nonExistentPositionId, true, false);
      }).rejects.toThrow();
    });
  });

  describe("Error Handling", () => {
    it("should handle invalid perp ID gracefully", async () => {
      const invalidPerpId = `0x${"0".repeat(64)}` as `0x${string}`;

      await expect(async () => {
        await context.getPerpConfig(invalidPerpId);
      }).rejects.toThrow();
    });

    it("should handle invalid user address gracefully", async () => {
      const invalidAddress = "0x0000000000000000000000000000000000000000" as `0x${string}`;

      const userData = await context.getUserData(invalidAddress, []);

      expect(userData.walletAddress).toBe(invalidAddress);
      expect(userData.usdcBalance).toBe(0);
    });
  });

  describe("Cache Behavior", () => {
    it("should cache config for same perpId", async () => {
      (context as any).configCache.clear();

      const startTime1 = Date.now();
      await context.getPerpConfig(setup.testPerpId);
      const duration1 = Date.now() - startTime1;

      const startTime2 = Date.now();
      await context.getPerpConfig(setup.testPerpId);
      const duration2 = Date.now() - startTime2;

      expect(duration2).toBeLessThan(duration1 * 0.5);
    });

    it("should cache perp config with 5-minute TTL", async () => {
      await context.getPerpConfig(setup.testPerpId);
      expect((context as any).configCache.has(setup.testPerpId)).toBe(true);
    });
  });

  describe("getPositionRawData", () => {
    it("should throw error for non-existent position", async () => {
      const nonExistentPositionId = 999999999n;

      await expect(async () => {
        await context.getPositionRawData(nonExistentPositionId);
      }).rejects.toThrow();
    });

    it("should fetch raw position data for valid position", async () => {
      const rawData = await context.getPositionRawData(TEST_POSITION_ID);

      expect(rawData).toBeDefined();
      expect(rawData.perpId).toBeTypeOf("string");
      expect(rawData.positionId).toBe(TEST_POSITION_ID);
      expect(rawData.margin).toBeTypeOf("number");
      expect(rawData.entryPerpDelta).toBeTypeOf("bigint");
      expect(rawData.entryUsdDelta).toBeTypeOf("bigint");
      expect(rawData.marginRatios).toBeDefined();
      expect(rawData.marginRatios.min).toBeTypeOf("number");
      expect(rawData.marginRatios.max).toBeTypeOf("number");
      expect(rawData.marginRatios.liq).toBeTypeOf("number");
    });

    it("should have valid margin ratios", async () => {
      const rawData = await context.getPositionRawData(TEST_POSITION_ID);

      expect(rawData.marginRatios.min).toBeLessThan(rawData.marginRatios.max);
      expect(rawData.marginRatios.liq).toBeLessThanOrEqual(rawData.marginRatios.min);
      expect(rawData.marginRatios.min).toBeGreaterThan(0);
      expect(rawData.marginRatios.max).toBeGreaterThan(0);
      expect(rawData.marginRatios.liq).toBeGreaterThan(0);
      expect(rawData.marginRatios.min).toBeLessThanOrEqual(1000000);
      expect(rawData.marginRatios.max).toBeLessThanOrEqual(1000000);
      expect(rawData.marginRatios.liq).toBeLessThanOrEqual(1000000);
    });

    it("should have consistent entry deltas", async () => {
      const rawData = await context.getPositionRawData(TEST_POSITION_ID);

      const perpDeltaSign = rawData.entryPerpDelta > 0n ? 1 : rawData.entryPerpDelta < 0n ? -1 : 0;
      const usdDeltaSign = rawData.entryUsdDelta > 0n ? 1 : rawData.entryUsdDelta < 0n ? -1 : 0;

      if (perpDeltaSign !== 0 && usdDeltaSign !== 0) {
        expect(perpDeltaSign).not.toBe(usdDeltaSign);
      }
    });

    it("should have non-negative margin for open position", async () => {
      const rawData = await context.getPositionRawData(TEST_POSITION_ID);
      expect(rawData.margin).toBeGreaterThanOrEqual(0);
    });
  });
});
