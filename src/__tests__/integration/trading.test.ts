import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PerpCityContext } from "../../context";
import { openMakerPosition, openTakerPosition } from "../../functions/perp-actions";
import { closePosition } from "../../functions/position";
import { type AnvilSetup, setupAnvil } from "../helpers/anvil-setup";

describe("Trading Operations Integration Tests", () => {
  let setup: AnvilSetup;
  let context: PerpCityContext;

  beforeAll(async () => {
    setup = await setupAnvil();
    context = setup.context;
  }, 60000);

  afterAll(() => {
    setup?.cleanup();
  });

  describe("openTakerPosition", () => {
    it("should open a long taker position", async () => {
      const position = await openTakerPosition(context, setup.testPerpId, {
        margin: 10,
        perpDelta: 20_000000n,
        amt1Limit: 0n,
      });

      expect(position).toBeDefined();
      expect(position.positionId).toBeTypeOf("bigint");
      expect(position.positionId).toBeGreaterThan(0n);
      expect(position.perpId).toBe(setup.testPerpId);
      expect(position.isLong).toBe(true);
      expect(position.isMaker).toBe(false);
    });

    it("should open a short taker position", async () => {
      const position = await openTakerPosition(context, setup.testPerpId, {
        margin: 10,
        perpDelta: -20_000000n,
        amt1Limit: 2n ** 128n - 1n,
      });

      expect(position.positionId).toBeTypeOf("bigint");
      expect(position.positionId).toBeGreaterThan(0n);
      expect(position.isLong).toBe(false);
    });

    it("should open position with larger perp delta", async () => {
      const position = await openTakerPosition(context, setup.testPerpId, {
        margin: 10,
        perpDelta: 50_000000n,
        amt1Limit: 0n,
      });

      expect(position.positionId).toBeGreaterThan(0n);
    });

    it("should validate zero margin", async () => {
      await expect(async () => {
        await openTakerPosition(context, setup.testPerpId, {
          margin: 0,
          perpDelta: 20_000000n,
          amt1Limit: 0n,
        });
      }).rejects.toThrow("Margin must be greater than 0");
    });

    it("should validate zero perp delta", async () => {
      await expect(async () => {
        await openTakerPosition(context, setup.testPerpId, {
          margin: 10,
          perpDelta: 0n,
          amt1Limit: 0n,
        });
      }).rejects.toThrow("perpDelta must be non-zero");
    });
  });

  describe("openMakerPosition", () => {
    it("should open a maker (LP) position", async () => {
      const position = await openMakerPosition(context, setup.testPerpId, {
        margin: 50,
        priceLower: 0.5,
        priceUpper: 2.0,
        liquidity: 1000000n,
        maxAmt0In: 200000000000000000n,
        maxAmt1In: 500000000000000000n,
      });

      expect(position.positionId).toBeGreaterThan(0n);
      expect(position.perpId).toBe(setup.testPerpId);
      expect(position.isMaker).toBe(true);
    });

    it("should validate priceLower < priceUpper", async () => {
      await expect(async () => {
        await openMakerPosition(context, setup.testPerpId, {
          margin: 50,
          priceLower: 2000,
          priceUpper: 1000,
          liquidity: 1000000n,
          maxAmt0In: 1000,
          maxAmt1In: 100,
        });
      }).rejects.toThrow("priceLower must be less than priceUpper");
    });
  });

  describe("closePosition", () => {
    it("should close a taker position", async () => {
      const position = await openTakerPosition(context, setup.testPerpId, {
        margin: 100,
        perpDelta: 200_000000n,
        amt1Limit: 0n,
      });

      const closeResult = await closePosition(context, setup.testPerpId, position.positionId, {
        amt1Limit: 1000_000000n,
      });

      // Full close returns null position with txHash
      expect(closeResult.position).toBeNull();
      expect(closeResult.txHash).toBeDefined();
      expect(closeResult.txHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
    });

    it("should close a taker position using OpenPosition method", async () => {
      const position = await openTakerPosition(context, setup.testPerpId, {
        margin: 200,
        perpDelta: 400_000000n,
        amt1Limit: 0n,
      });

      const closeResult = await position.closePosition({
        amt1Limit: 1000_000000n,
      });

      expect(closeResult.position).toBeNull();
      expect(closeResult.txHash).toBeDefined();
      expect(closeResult.txHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
    });

    it("should fail to close non-existent position", async () => {
      const nonExistentId = 999999999n;

      await expect(async () => {
        await closePosition(context, setup.testPerpId, nonExistentId, {
          amt1Limit: 1000_000000n,
        });
      }).rejects.toThrow();
    });
  });

  describe("Transaction Hash Access", () => {
    it("should expose transaction hash on OpenPosition for gas measurement", async () => {
      const position = await openTakerPosition(context, setup.testPerpId, {
        margin: 100,
        perpDelta: 200_000000n,
        amt1Limit: 0n,
      });

      expect(position.txHash).toBeDefined();
      expect(position.txHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
    });
  });
});
