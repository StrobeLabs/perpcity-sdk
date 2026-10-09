import { describe, expect, it } from "vitest";
import {
  calculateEntryPrice,
  calculateLeverage,
  calculateLiquidationPrice,
  calculatePnlPercentage,
  calculatePositionSize,
  calculatePositionValue,
} from "../../functions/position";
import type { PositionRawData } from "../../types/entity-data";

describe("Position Calculation Functions", () => {
  describe("calculateEntryPrice", () => {
    it("should calculate entry price for a long position", () => {
      const rawData: PositionRawData = {
        perpId: "0x123" as any,
        positionId: 1n,
        margin: 100,
        entryPerpDelta: 1000000n, // 1 perp token (1e6)
        entryUsdDelta: 50000000n, // $50 (1e6 scaled)
        marginRatios: { liq: 50000, backstop: 25000 },
        makerDetails: null,
      };

      const entryPrice = calculateEntryPrice(rawData);

      // abs(50000000 / 1000000) = 50
      expect(entryPrice).toBe(50);
    });

    it("should calculate entry price for a short position", () => {
      const rawData: PositionRawData = {
        perpId: "0x123" as any,
        positionId: 1n,
        margin: 100,
        entryPerpDelta: -2000000n, // -2 perp tokens (1e6)
        entryUsdDelta: -100000000n, // -$100 (1e6 scaled)
        marginRatios: { liq: 50000, backstop: 25000 },
        makerDetails: null,
      };

      const entryPrice = calculateEntryPrice(rawData);

      // abs(-100000000 / -2000000) = 50
      expect(entryPrice).toBe(50);
    });

    it("should handle zero position size", () => {
      const rawData: PositionRawData = {
        perpId: "0x123" as any,
        positionId: 1n,
        margin: 100,
        entryPerpDelta: 0n,
        entryUsdDelta: 0n,
        marginRatios: { liq: 50000, backstop: 25000 },
        makerDetails: null,
      };

      const entryPrice = calculateEntryPrice(rawData);

      expect(entryPrice).toBe(0);
    });

    it("should handle large position values", () => {
      const rawData: PositionRawData = {
        perpId: "0x123" as any,
        positionId: 1n,
        margin: 10000,
        entryPerpDelta: 100000000n, // 100 perp tokens (1e6)
        entryUsdDelta: 5000000000n, // $5000 (1e6 scaled)
        marginRatios: { liq: 50000, backstop: 25000 },
        makerDetails: null,
      };

      const entryPrice = calculateEntryPrice(rawData);

      // abs(5000000000 / 100000000) = 50
      expect(entryPrice).toBe(50);
    });

    it("should handle fractional entry prices", () => {
      const rawData: PositionRawData = {
        perpId: "0x123" as any,
        positionId: 1n,
        margin: 100,
        entryPerpDelta: 10000000n, // 10 perp tokens (1e6)
        entryUsdDelta: 123450000n, // $123.45 (1e6 scaled)
        marginRatios: { liq: 50000, backstop: 25000 },
        makerDetails: null,
      };

      const entryPrice = calculateEntryPrice(rawData);

      // abs(123450000 / 10000000) = 12.345
      expect(entryPrice).toBeCloseTo(12.345, 3);
    });
  });

  describe("calculatePositionSize", () => {
    it("should calculate positive size for long position", () => {
      const rawData: PositionRawData = {
        perpId: "0x123" as any,
        positionId: 1n,
        margin: 100,
        entryPerpDelta: 1000000n, // 1 perp token (1e6)
        entryUsdDelta: 50000000n,
        marginRatios: { liq: 50000, backstop: 25000 },
        makerDetails: null,
      };

      const size = calculatePositionSize(rawData);

      expect(size).toBe(1);
    });

    it("should calculate negative size for short position", () => {
      const rawData: PositionRawData = {
        perpId: "0x123" as any,
        positionId: 1n,
        margin: 100,
        entryPerpDelta: -2000000n, // -2 perp tokens (1e6)
        entryUsdDelta: -100000000n,
        marginRatios: { liq: 50000, backstop: 25000 },
        makerDetails: null,
      };

      const size = calculatePositionSize(rawData);

      expect(size).toBe(-2);
    });

    it("should handle zero size", () => {
      const rawData: PositionRawData = {
        perpId: "0x123" as any,
        positionId: 1n,
        margin: 100,
        entryPerpDelta: 0n,
        entryUsdDelta: 0n,
        marginRatios: { liq: 50000, backstop: 25000 },
        makerDetails: null,
      };

      const size = calculatePositionSize(rawData);

      expect(size).toBe(0);
    });

    it("should handle fractional sizes", () => {
      const rawData: PositionRawData = {
        perpId: "0x123" as any,
        positionId: 1n,
        margin: 100,
        entryPerpDelta: 500000n, // 0.5 perp tokens (1e6)
        entryUsdDelta: 25000000n,
        marginRatios: { liq: 50000, backstop: 25000 },
        makerDetails: null,
      };

      const size = calculatePositionSize(rawData);

      expect(size).toBe(0.5);
    });

    it("should handle large position sizes", () => {
      const rawData: PositionRawData = {
        perpId: "0x123" as any,
        positionId: 1n,
        margin: 10000,
        entryPerpDelta: 100000000n, // 100 perp tokens (1e6)
        entryUsdDelta: 5000000000n,
        marginRatios: { liq: 50000, backstop: 25000 },
        makerDetails: null,
      };

      const size = calculatePositionSize(rawData);

      expect(size).toBe(100);
    });
  });

  describe("calculatePositionValue", () => {
    it("should calculate position value for long position", () => {
      const rawData: PositionRawData = {
        perpId: "0x123" as any,
        positionId: 1n,
        margin: 100,
        entryPerpDelta: 1000000n, // 1 perp token (1e6)
        entryUsdDelta: 50000000n,
        marginRatios: { liq: 50000, backstop: 25000 },
        makerDetails: null,
      };

      const markPrice = 60;
      const value = calculatePositionValue(rawData, markPrice);

      // abs(1) * 60 = 60
      expect(value).toBe(60);
    });

    it("should calculate position value for short position", () => {
      const rawData: PositionRawData = {
        perpId: "0x123" as any,
        positionId: 1n,
        margin: 100,
        entryPerpDelta: -2000000n, // -2 perp tokens (1e6)
        entryUsdDelta: -100000000n,
        marginRatios: { liq: 50000, backstop: 25000 },
        makerDetails: null,
      };

      const markPrice = 55;
      const value = calculatePositionValue(rawData, markPrice);

      // abs(-2) * 55 = 110
      expect(value).toBe(110);
    });

    it("should return zero for zero size", () => {
      const rawData: PositionRawData = {
        perpId: "0x123" as any,
        positionId: 1n,
        margin: 100,
        entryPerpDelta: 0n,
        entryUsdDelta: 0n,
        marginRatios: { liq: 50000, backstop: 25000 },
        makerDetails: null,
      };

      const markPrice = 50;
      const value = calculatePositionValue(rawData, markPrice);

      expect(value).toBe(0);
    });

    it("should handle fractional sizes and prices", () => {
      const rawData: PositionRawData = {
        perpId: "0x123" as any,
        positionId: 1n,
        margin: 100,
        entryPerpDelta: 1500000n, // 1.5 perp tokens (1e6)
        entryUsdDelta: 75000000n,
        marginRatios: { liq: 50000, backstop: 25000 },
        makerDetails: null,
      };

      const markPrice = 52.75;
      const value = calculatePositionValue(rawData, markPrice);

      // abs(1.5) * 52.75 = 79.125
      expect(value).toBeCloseTo(79.125, 3);
    });

    it("should always return positive value regardless of position direction", () => {
      const longData: PositionRawData = {
        perpId: "0x123" as any,
        positionId: 1n,
        margin: 100,
        entryPerpDelta: 1000000n, // 1 perp token (1e6)
        entryUsdDelta: 50000000n,
        marginRatios: { liq: 50000, backstop: 25000 },
        makerDetails: null,
      };

      const shortData: PositionRawData = {
        perpId: "0x123" as any,
        positionId: 2n,
        margin: 100,
        entryPerpDelta: -1000000n, // -1 perp token (1e6)
        entryUsdDelta: -50000000n,
        marginRatios: { liq: 50000, backstop: 25000 },
        makerDetails: null,
      };

      const markPrice = 60;
      const longValue = calculatePositionValue(longData, markPrice);
      const shortValue = calculatePositionValue(shortData, markPrice);

      expect(longValue).toBe(60);
      expect(shortValue).toBe(60);
      expect(longValue).toBeGreaterThan(0);
      expect(shortValue).toBeGreaterThan(0);
    });
  });

  describe("calculateLeverage", () => {
    it("should calculate leverage correctly", () => {
      const positionValue = 1000;
      const effectiveMargin = 100;

      const leverage = calculateLeverage(positionValue, effectiveMargin);

      expect(leverage).toBe(10);
    });

    it("should handle 1x leverage", () => {
      const positionValue = 100;
      const effectiveMargin = 100;

      const leverage = calculateLeverage(positionValue, effectiveMargin);

      expect(leverage).toBe(1);
    });

    it("should handle fractional leverage", () => {
      const positionValue = 150;
      const effectiveMargin = 100;

      const leverage = calculateLeverage(positionValue, effectiveMargin);

      expect(leverage).toBe(1.5);
    });

    it("should return Infinity for zero margin", () => {
      const positionValue = 1000;
      const effectiveMargin = 0;

      const leverage = calculateLeverage(positionValue, effectiveMargin);

      expect(leverage).toBe(Infinity);
    });

    it("should return Infinity for negative margin", () => {
      const positionValue = 1000;
      const effectiveMargin = -50;

      const leverage = calculateLeverage(positionValue, effectiveMargin);

      expect(leverage).toBe(Infinity);
    });

    it("should handle very high leverage", () => {
      const positionValue = 10000;
      const effectiveMargin = 50;

      const leverage = calculateLeverage(positionValue, effectiveMargin);

      expect(leverage).toBe(200);
    });

    it("should handle zero position value", () => {
      const positionValue = 0;
      const effectiveMargin = 100;

      const leverage = calculateLeverage(positionValue, effectiveMargin);

      expect(leverage).toBe(0);
    });
  });

  describe("calculateLiquidationPrice", () => {
    it("should calculate liquidation price for long position", () => {
      const rawData: PositionRawData = {
        perpId: "0x123" as any,
        positionId: 1n,
        margin: 100,
        entryPerpDelta: 1000000n, // 1 perp token (1e6)
        entryUsdDelta: 50000000n, // $50 entry price (1e6)
        marginRatios: { liq: 50000, backstop: 25000 }, // min ratio = 0.1 (10%)
        makerDetails: null,
      };

      const liqPrice = calculateLiquidationPrice(rawData, true);

      // long: (entry - margin/size) / (1 - liqRatio)
      // = (50 - 100/1) / (1 - 0.05) = -50/0.95 < 0 -> clamped to 0
      expect(liqPrice).not.toBeNull();
      expect(liqPrice).toBe(0);
    });

    it("should calculate liquidation price for short position", () => {
      const rawData: PositionRawData = {
        perpId: "0x123" as any,
        positionId: 1n,
        margin: 100,
        entryPerpDelta: -1000000n, // -1 perp token (1e6)
        entryUsdDelta: -50000000n, // $50 entry price (1e6)
        marginRatios: { liq: 50000, backstop: 25000 },
        makerDetails: null,
      };

      const liqPrice = calculateLiquidationPrice(rawData, false);

      // short: (entry + margin/size) / (1 + liqRatio)
      // = (50 + 100/1) / (1 + 0.05) = 150/1.05 = 142.857
      expect(liqPrice).not.toBeNull();
      expect(liqPrice).toBeCloseTo(142.857, 2);
    });

    it("should return null for zero position size", () => {
      const rawData: PositionRawData = {
        perpId: "0x123" as any,
        positionId: 1n,
        margin: 100,
        entryPerpDelta: 0n,
        entryUsdDelta: 0n,
        marginRatios: { liq: 50000, backstop: 25000 },
        makerDetails: null,
      };

      const liqPrice = calculateLiquidationPrice(rawData, true);

      expect(liqPrice).toBeNull();
    });

    it("should return null for zero margin", () => {
      const rawData: PositionRawData = {
        perpId: "0x123" as any,
        positionId: 1n,
        margin: 0,
        entryPerpDelta: 1000000000000000000n,
        entryUsdDelta: 50000000n,
        marginRatios: { liq: 50000, backstop: 25000 },
        makerDetails: null,
      };

      const liqPrice = calculateLiquidationPrice(rawData, true);

      expect(liqPrice).toBeNull();
    });

    it("should handle high leverage position (low margin)", () => {
      const rawData: PositionRawData = {
        perpId: "0x123" as any,
        positionId: 1n,
        margin: 10,
        entryPerpDelta: 1000000n, // 1 perp token (1e6)
        entryUsdDelta: 50000000n, // $50 (1e6)
        marginRatios: { liq: 50000, backstop: 25000 }, // liq ratio = 0.05
        makerDetails: null,
      };

      const liqPrice = calculateLiquidationPrice(rawData, true);

      // long: (50 - 10/1) / (1 - 0.05) = 40/0.95 = 42.105
      expect(liqPrice).not.toBeNull();
      expect(liqPrice).toBeCloseTo(42.105, 2);
      expect(liqPrice).toBeLessThan(50);
    });

    it("should handle low leverage position (high margin)", () => {
      const rawData: PositionRawData = {
        perpId: "0x123" as any,
        positionId: 1n,
        margin: 500,
        entryPerpDelta: 10000000n, // 10 perp tokens (1e6)
        entryUsdDelta: 500000000n, // $50 each (1e6)
        marginRatios: { liq: 50000, backstop: 25000 },
        makerDetails: null,
      };

      const liqPrice = calculateLiquidationPrice(rawData, true);

      // For low leverage longs, liquidation price should be well below entry
      expect(liqPrice).not.toBeNull();
      expect(liqPrice).toBeGreaterThanOrEqual(0);
    });

    it("should ensure long liquidation price is non-negative", () => {
      const rawData: PositionRawData = {
        perpId: "0x123" as any,
        positionId: 1n,
        margin: 1000,
        entryPerpDelta: 1000000n, // 1 perp token (1e6)
        entryUsdDelta: 10000000n, // $10 entry (1e6)
        marginRatios: { liq: 50000, backstop: 25000 },
        makerDetails: null,
      };

      const liqPrice = calculateLiquidationPrice(rawData, true);

      // Calculated liq price might be negative, but should return 0
      expect(liqPrice).not.toBeNull();
      expect(liqPrice).toBeGreaterThanOrEqual(0);
    });

    it("should handle different margin ratios", () => {
      const baseData: PositionRawData = {
        perpId: "0x123" as any,
        positionId: 1n,
        margin: 100,
        entryPerpDelta: 1000000n, // 1 perp token (1e6)
        entryUsdDelta: 100000000n, // $100 entry (1e6)
        marginRatios: { liq: 100000, backstop: 50000 }, // liq ratio = 0.1 (10%)
        makerDetails: null,
      };

      const liqPrice = calculateLiquidationPrice(baseData, true);

      // Higher liq ratio means closer liquidation price to entry
      expect(liqPrice).not.toBeNull();
      expect(liqPrice).toBeGreaterThanOrEqual(0);
    });

    it("should return null for long when liq margin ratio is >= 100%", () => {
      const rawData: PositionRawData = {
        perpId: "0x123" as any,
        positionId: 1n,
        margin: 100,
        entryPerpDelta: 1000000n, // 1 perp token (1e6)
        entryUsdDelta: 50000000n, // $50 entry (1e6)
        marginRatios: { liq: 1000000, backstop: 500000 }, // liq ratio = 1.0 (100%)
        makerDetails: null,
      };

      const liqPrice = calculateLiquidationPrice(rawData, true);

      // long denom = 1 - liqRatio = 0 -> no positive liquidation price
      expect(liqPrice).toBeNull();
    });
  });

  describe("Integration: Position metrics", () => {
    it("should calculate all metrics for a profitable long position", () => {
      const rawData: PositionRawData = {
        perpId: "0x123" as any,
        positionId: 1n,
        margin: 100,
        entryPerpDelta: 1000000n, // 1 perp token (1e6)
        entryUsdDelta: 50000000n, // $50 entry (1e6)
        marginRatios: { liq: 50000, backstop: 25000 },
        makerDetails: null,
      };

      const markPrice = 60;
      const effectiveMargin = 110; // margin + pnl

      const entryPrice = calculateEntryPrice(rawData);
      const size = calculatePositionSize(rawData);
      const value = calculatePositionValue(rawData, markPrice);
      const leverage = calculateLeverage(value, effectiveMargin);
      const liqPrice = calculateLiquidationPrice(rawData, true);

      expect(entryPrice).toBe(50);
      expect(size).toBe(1);
      expect(value).toBe(60);
      expect(leverage).toBeCloseTo(0.545, 2); // 60 / 110
      expect(liqPrice).not.toBeNull();
    });

    it("should calculate all metrics for a losing short position", () => {
      const rawData: PositionRawData = {
        perpId: "0x123" as any,
        positionId: 1n,
        margin: 100,
        entryPerpDelta: -2000000n, // -2 perp tokens (1e6)
        entryUsdDelta: -100000000n, // $50 entry (1e6)
        marginRatios: { liq: 50000, backstop: 25000 },
        makerDetails: null,
      };

      const markPrice = 60; // Price went up, short is losing
      const effectiveMargin = 80; // margin - pnl

      const entryPrice = calculateEntryPrice(rawData);
      const size = calculatePositionSize(rawData);
      const value = calculatePositionValue(rawData, markPrice);
      const leverage = calculateLeverage(value, effectiveMargin);
      const liqPrice = calculateLiquidationPrice(rawData, false);

      expect(entryPrice).toBe(50);
      expect(size).toBe(-2);
      expect(value).toBe(120); // abs(-2) * 60
      expect(leverage).toBe(1.5); // 120 / 80
      expect(liqPrice).not.toBeNull();
      if (liqPrice !== null) {
        expect(liqPrice).toBeGreaterThan(60); // Short liquidates when price goes up
      }
    });
  });

  describe("calculatePnlPercentage", () => {
    it("should compute percentage from pnl, funding, and current margin", () => {
      // margin=110, pnl=8, funding=2 -> totalPnl=10, initialMargin=100, pct=10%
      expect(calculatePnlPercentage(8, 2, 110)).toBeCloseTo(10, 4);
    });

    it("should handle negative PnL", () => {
      // margin=90, pnl=-8, funding=-2 -> totalPnl=-10, initialMargin=100, pct=-10%
      expect(calculatePnlPercentage(-8, -2, 90)).toBeCloseTo(-10, 4);
    });

    it("should return 0 when initialMargin <= 0", () => {
      expect(calculatePnlPercentage(100, 0, 50)).toBe(0);
    });
  });
});
