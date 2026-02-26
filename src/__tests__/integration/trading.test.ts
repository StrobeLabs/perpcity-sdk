import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PerpCityContext } from "../../context";
import { openMakerPosition, openTakerPosition } from "../../functions/perp-manager";
import { closePosition } from "../../functions/position";
import { type AnvilSetup, setupAnvil } from "../helpers/anvil-setup";

describe("Trading Operations Integration Tests", () => {
  let setup: AnvilSetup;
  let context: PerpCityContext;

  beforeAll(async () => {
    setup = await setupAnvil();
    context = setup.context;
  }, 30000);

  afterAll(() => {
    setup?.cleanup();
  });

  describe("openTakerPosition", () => {
    it("should open a long taker position", async () => {
      const position = await openTakerPosition(context, setup.testPerpId, {
        isLong: true,
        margin: 10,
        leverage: 2,
        unspecifiedAmountLimit: 0,
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
        isLong: false,
        margin: 10,
        leverage: 2,
        unspecifiedAmountLimit: 2n ** 128n - 1n,
      });

      expect(position.positionId).toBeTypeOf("bigint");
      expect(position.positionId).toBeGreaterThan(0n);
      expect(position.isLong).toBe(false);
    });

    it("should open position with high leverage", async () => {
      const position = await openTakerPosition(context, setup.testPerpId, {
        isLong: true,
        margin: 10,
        leverage: 5,
        unspecifiedAmountLimit: 0,
      });

      expect(position.positionId).toBeGreaterThan(0n);
    });

    it("should validate zero margin", async () => {
      await expect(async () => {
        await openTakerPosition(context, setup.testPerpId, {
          isLong: true,
          margin: 0,
          leverage: 2,
          unspecifiedAmountLimit: 0,
        });
      }).rejects.toThrow("Margin must be greater than 0");
    });

    it("should validate zero leverage", async () => {
      await expect(async () => {
        await openTakerPosition(context, setup.testPerpId, {
          isLong: true,
          margin: 10,
          leverage: 0,
          unspecifiedAmountLimit: 0,
        });
      }).rejects.toThrow("Leverage must be greater than 0");
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
        isLong: true,
        margin: 100,
        leverage: 2,
        unspecifiedAmountLimit: 0,
      });

      const closeResult = await closePosition(context, setup.testPerpId, position.positionId, {
        minAmt0Out: 0,
        minAmt1Out: 0,
        maxAmt1In: 1000,
      });

      // Full close returns null position with txHash
      expect(closeResult.position).toBeNull();
      expect(closeResult.txHash).toBeDefined();
      expect(closeResult.txHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
    });

    it("should close a taker position using OpenPosition method", async () => {
      const position = await openTakerPosition(context, setup.testPerpId, {
        isLong: true,
        margin: 200,
        leverage: 2,
        unspecifiedAmountLimit: 0,
      });

      const closeResult = await position.closePosition({
        minAmt0Out: 0,
        minAmt1Out: 0,
        maxAmt1In: 1000,
      });

      expect(closeResult.position).toBeNull();
      expect(closeResult.txHash).toBeDefined();
      expect(closeResult.txHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
    });

    it("should fail to close non-existent position", async () => {
      const nonExistentId = 999999999n;

      await expect(async () => {
        await closePosition(context, setup.testPerpId, nonExistentId, {
          minAmt0Out: 0,
          minAmt1Out: 0,
          maxAmt1In: 1000,
        });
      }).rejects.toThrow();
    });
  });

  describe("Transaction Hash Access", () => {
    it("should expose transaction hash on OpenPosition for gas measurement", async () => {
      const position = await openTakerPosition(context, setup.testPerpId, {
        isLong: true,
        margin: 100,
        leverage: 2,
        unspecifiedAmountLimit: 0,
      });

      expect(position.txHash).toBeDefined();
      expect(position.txHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
    });
  });
});
