import { describe, expect, it } from "vitest";
import { Q96 } from "../../utils/constants";
import {
  marginRatioToLeverage,
  priceToSqrtPriceX96,
  priceToTick,
  scale6Decimals,
  scaleFrom6Decimals,
  scaleFromX96,
  scaleToX96,
  sqrtPriceX96ToPrice,
} from "../../utils/conversions";

describe("Conversion Functions", () => {
  describe("priceToSqrtPriceX96", () => {
    it("should convert normal prices correctly", () => {
      const price = 100;
      const result = priceToSqrtPriceX96(price);

      // sqrt(100) = 10, scaled to X96
      // 10 * 1e6 * 2^96 / 1e6 = 10 * 2^96
      expect(result).toBeTypeOf("bigint");
      expect(result).toBeGreaterThan(0n);
    });

    it("should handle price of 1", () => {
      const price = 1;
      const result = priceToSqrtPriceX96(price);

      // sqrt(1) = 1, scaled to X96
      expect(result).toBe(Q96);
    });

    it("should handle decimal prices", () => {
      const price = 0.5;
      const result = priceToSqrtPriceX96(price);

      expect(result).toBeGreaterThan(0n);
      expect(result).toBeLessThan(Q96);
    });

    it("should throw on very large prices", () => {
      const price = Number.MAX_SAFE_INTEGER + 1;
      expect(() => priceToSqrtPriceX96(price)).toThrow("Price too large");
    });

    it("should validate negative prices", () => {
      const price = -10;

      // Should throw a proper validation error for negative prices
      expect(() => priceToSqrtPriceX96(price)).toThrow("Price must be positive");
    });

    it("should validate zero price", () => {
      const price = 0;

      // Zero price should be rejected
      expect(() => priceToSqrtPriceX96(price)).toThrow("Price must be positive");
    });

    it("BUG: should handle very large prices that overflow after sqrt but does not", () => {
      // Price close to MAX_SAFE_INTEGER
      const price = Number.MAX_SAFE_INTEGER;

      // sqrt(MAX_SAFE_INTEGER) * 1e6 could overflow
      // This documents a potential precision loss issue
      const result = priceToSqrtPriceX96(price);
      expect(result).toBeGreaterThan(0n);
    });
  });

  describe("scale6Decimals", () => {
    it("should scale normal amounts correctly", () => {
      const amount = 100;
      const result = scale6Decimals(amount);

      expect(result).toBe(100_000_000n);
    });

    it("should handle decimal amounts", () => {
      const amount = 100.5;
      const result = scale6Decimals(amount);

      // 100.5 * 1e6 = 100,500,000
      expect(result).toBe(100_500_000n);
    });

    it("should handle zero", () => {
      const amount = 0;
      const result = scale6Decimals(amount);

      expect(result).toBe(0n);
    });

    it("should handle very small amounts", () => {
      const amount = 0.000001;
      const result = scale6Decimals(amount);

      // 0.000001 * 1e6 = 1
      expect(result).toBe(1n);
    });

    it("should floor fractional scaled values", () => {
      const amount = 100.5555555;
      const result = scale6Decimals(amount);

      // 100.5555555 * 1e6 = 100,555,555.5, floored to 100,555,555
      expect(result).toBe(100_555_555n);
    });

    it("should throw on amounts too large", () => {
      const amount = Number.MAX_SAFE_INTEGER;

      expect(() => scale6Decimals(amount)).toThrow("Amount too large");
    });

    it("BUG: should handle negative amounts but does not", () => {
      const amount = -100;
      const result = scale6Decimals(amount);

      // Documents bug: negative amounts are allowed and result in negative bigint
      // This might be intentional for some use cases, but should be documented
      expect(result).toBe(-100_000_000n);
    });
  });

  describe("scaleToX96", () => {
    it("should scale normal amounts to X96 correctly", () => {
      const amount = 100;
      const result = scaleToX96(amount);

      // 100 * 1e6 * 2^96 / 1e6 = 100 * 2^96
      const expected = 100n * Q96;
      expect(result).toBe(expected);
    });

    it("should handle amount of 1", () => {
      const amount = 1;
      const result = scaleToX96(amount);

      expect(result).toBe(Q96);
    });

    it("should handle decimal amounts", () => {
      const amount = 0.5;
      const result = scaleToX96(amount);

      expect(result).toBeLessThan(Q96);
      expect(result).toBeGreaterThan(0n);
    });

    it("should throw on very large amounts", () => {
      const amount = Number.MAX_SAFE_INTEGER;

      expect(() => scaleToX96(amount)).toThrow("Amount too large");
    });
  });

  describe("scaleFromX96", () => {
    it("should scale from X96 correctly", () => {
      const valueX96 = 100n * Q96;
      const result = scaleFromX96(valueX96);

      expect(result).toBe(100);
    });

    it("should handle Q96 value", () => {
      const valueX96 = Q96;
      const result = scaleFromX96(valueX96);

      expect(result).toBe(1);
    });

    it("should handle fractional values", () => {
      const valueX96 = Q96 / 2n;
      const result = scaleFromX96(valueX96);

      expect(result).toBeCloseTo(0.5, 5);
    });

    it("should handle zero", () => {
      const valueX96 = 0n;
      const result = scaleFromX96(valueX96);

      expect(result).toBe(0);
    });

    it("should throw on very large values", () => {
      // Create a value that will overflow after division AND conversion to Number
      // The check is: valueScaled6Decimals > Number.MAX_SAFE_INTEGER
      // where valueScaled6Decimals = valueX96 * 1e6 / Q96
      // So we need valueX96 * 1e6 / Q96 > MAX_SAFE_INTEGER
      // valueX96 > MAX_SAFE_INTEGER * Q96 / 1e6
      const largeValue = BigInt(Number.MAX_SAFE_INTEGER) * Q96;

      expect(() => scaleFromX96(largeValue)).toThrow("Value too large");
    });

    it("BUG: overflow check happens AFTER multiplication", () => {
      // This test documents that the overflow check happens after valueX96 * BIGINT_1E6
      // If valueX96 is very large, the multiplication could overflow before the check
      // However, bigint arithmetic doesn't overflow in JavaScript, so this is more
      // about exceeding Number.MAX_SAFE_INTEGER after conversion

      const largeValueX96 = BigInt(Number.MAX_SAFE_INTEGER) * Q96;

      // This should throw because the scaled value exceeds MAX_SAFE_INTEGER
      expect(() => scaleFromX96(largeValueX96)).toThrow("Value too large");
    });
  });

  describe("priceToTick", () => {
    it("should convert price to tick with rounding down", () => {
      const price = 1.0001 ** 100; // Approximately tick 100
      const result = priceToTick(price, true);

      // Due to floating point precision, this might be 99 or 100
      expect(result).toBeGreaterThanOrEqual(99);
      expect(result).toBeLessThanOrEqual(100);
    });

    it("should convert price to tick with rounding up", () => {
      const price = 1.0001 ** 100.5; // Between tick 100 and 101
      const result = priceToTick(price, false);

      expect(result).toBe(101);
    });

    it("should handle price of 1 (tick 0)", () => {
      const price = 1;
      const resultDown = priceToTick(price, true);
      const resultUp = priceToTick(price, false);

      expect(resultDown).toBe(0);
      expect(resultUp).toBe(0);
    });

    it("should handle prices less than 1 (negative ticks)", () => {
      const price = 0.9999; // Should be negative tick
      const result = priceToTick(price, true);

      expect(result).toBeLessThan(0);
    });

    it("should handle very high prices", () => {
      const price = 1.0001 ** 100000; // Very high tick
      const result = priceToTick(price, true);

      expect(result).toBe(100000);
    });

    it("should handle very low prices", () => {
      const price = 1.0001 ** -100000; // Very low tick
      const result = priceToTick(price, true);

      // Due to floating point precision with extreme values, allow some tolerance
      expect(result).toBeGreaterThanOrEqual(-100001);
      expect(result).toBeLessThanOrEqual(-99999);
    });

    it("should validate zero and negative prices", () => {
      // Should throw validation errors for zero and negative prices

      const zeroPrice = 0;
      expect(() => priceToTick(zeroPrice, true)).toThrow("Price must be positive");

      const negativePrice = -1;
      expect(() => priceToTick(negativePrice, true)).toThrow("Price must be positive");
    });
  });

  describe("sqrtPriceX96ToPrice", () => {
    it("should convert sqrt price X96 to price correctly", () => {
      const sqrtPriceX96 = 10n * Q96; // sqrt(price) = 10, so price = 100
      const result = sqrtPriceX96ToPrice(sqrtPriceX96);

      expect(result).toBe(100);
    });

    it("should handle sqrt price of 1", () => {
      const sqrtPriceX96 = Q96; // sqrt(price) = 1, so price = 1
      const result = sqrtPriceX96ToPrice(sqrtPriceX96);

      expect(result).toBe(1);
    });

    it("should handle fractional sqrt prices", () => {
      const sqrtPriceX96 = Q96 / 2n; // sqrt(price) = 0.5, so price = 0.25
      const result = sqrtPriceX96ToPrice(sqrtPriceX96);

      expect(result).toBeCloseTo(0.25, 5);
    });

    it("should handle zero sqrt price", () => {
      const sqrtPriceX96 = 0n;
      const result = sqrtPriceX96ToPrice(sqrtPriceX96);

      expect(result).toBe(0);
    });

    it("should throw on very large sqrt prices", () => {
      // sqrtPrice^2 could overflow
      const largeSqrtPrice = BigInt(Number.MAX_SAFE_INTEGER) * Q96;

      expect(() => sqrtPriceX96ToPrice(largeSqrtPrice)).toThrow();
    });

    it("should round-trip with priceToSqrtPriceX96", () => {
      const originalPrice = 100;
      const sqrtPriceX96 = priceToSqrtPriceX96(originalPrice);
      const resultPrice = sqrtPriceX96ToPrice(sqrtPriceX96);

      // Should be close due to rounding
      expect(resultPrice).toBeCloseTo(originalPrice, 5);
    });
  });

  describe("marginRatioToLeverage", () => {
    it("should convert margin ratio to leverage correctly", () => {
      const marginRatio = 100000; // 0.1 or 10% margin = 10x leverage
      const result = marginRatioToLeverage(marginRatio);

      // 1e6 / 100000 = 10
      expect(result).toBe(10);
    });

    it("should handle margin ratio of 1e6 (1x leverage)", () => {
      const marginRatio = 1000000; // 100% margin = 1x leverage
      const result = marginRatioToLeverage(marginRatio);

      expect(result).toBe(1);
    });

    it("should handle small margin ratio (high leverage)", () => {
      const marginRatio = 50000; // 5% margin = 20x leverage
      const result = marginRatioToLeverage(marginRatio);

      expect(result).toBe(20);
    });

    it("should validate zero margin ratio", () => {
      const marginRatio = 0;

      // Should throw an error for zero margin ratio
      expect(() => marginRatioToLeverage(marginRatio)).toThrow(
        "Margin ratio must be greater than 0"
      );
    });

    it("should validate negative margin ratios", () => {
      const marginRatio = -100000;

      // Should throw an error for negative margin ratio
      expect(() => marginRatioToLeverage(marginRatio)).toThrow(
        "Margin ratio must be greater than 0"
      );
    });
  });

  describe("scaleFrom6Decimals", () => {
    it("should scale from 6 decimals correctly", () => {
      const value = 100_000_000;
      const result = scaleFrom6Decimals(value);

      expect(result).toBe(100);
    });

    it("should handle value of 1e6", () => {
      const value = 1_000_000;
      const result = scaleFrom6Decimals(value);

      expect(result).toBe(1);
    });

    it("should handle zero", () => {
      const value = 0;
      const result = scaleFrom6Decimals(value);

      expect(result).toBe(0);
    });

    it("should handle fractional values", () => {
      const value = 500_000; // 0.5
      const result = scaleFrom6Decimals(value);

      expect(result).toBe(0.5);
    });

    it("should handle very small values", () => {
      const value = 1;
      const result = scaleFrom6Decimals(value);

      expect(result).toBe(0.000001);
    });

    it("should round-trip with scale6Decimals for integers", () => {
      const original = 100;
      const scaled = scale6Decimals(original);
      const result = scaleFrom6Decimals(Number(scaled));

      expect(result).toBe(original);
    });

    it("should handle precision loss for very precise decimals", () => {
      const original = 100.123456789;
      const scaled = scale6Decimals(original);
      const result = scaleFrom6Decimals(Number(scaled));

      // Documents precision loss: only 6 decimal places preserved
      expect(result).toBeCloseTo(100.123456, 6);
      expect(result).not.toBe(original);
    });

    it("should handle negative values", () => {
      const value = -100_000_000;
      const result = scaleFrom6Decimals(value);

      expect(result).toBe(-100);
    });
  });

  describe("Integration: round-trip conversions", () => {
    it("should round-trip price conversions accurately", () => {
      const prices = [0.1, 1, 10, 100];

      prices.forEach((price) => {
        const sqrtPriceX96 = priceToSqrtPriceX96(price);
        const resultPrice = sqrtPriceX96ToPrice(sqrtPriceX96);

        // Allow more tolerance for larger prices due to precision loss
        const tolerance = price > 100 ? 3 : 5;
        expect(resultPrice).toBeCloseTo(price, tolerance);
      });
    });

    it("should round-trip tick conversions accurately", () => {
      const ticks = [-1000, -100, 0, 10, 100, 1000];

      ticks.forEach((tick) => {
        const price = 1.0001 ** tick;
        const resultTick = priceToTick(price, true);

        // Allow 1 tick tolerance due to floating point precision
        expect(Math.abs(resultTick - tick)).toBeLessThanOrEqual(1);
      });
    });
  });
});
