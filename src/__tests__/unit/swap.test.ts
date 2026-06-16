import { describe, expect, it } from "vitest";
import { Q96 } from "../../utils/constants";
import { simulateTakerSwap } from "../../utils/swap";

// price = 4 -> sqrtPrice = 2 -> sqrtPriceX96 = 2 * Q96.
const SQRT_PRICE_X96_AT_4 = 2n * Q96;
const MARK_AT_4 = 4;

describe("simulateTakerSwap", () => {
  it("returns the mark price when there is no active liquidity", () => {
    const result = simulateTakerSwap({
      sqrtPriceX96: SQRT_PRICE_X96_AT_4,
      liquidity: 0n,
      perpDelta: 1_000_000n,
      markPrice: MARK_AT_4,
    });
    expect(result.fillPrice).toBe(MARK_AT_4);
    expect(result.exceedsLiquidity).toBe(true);
  });

  it("fills a long above the mark (price impact pushes the fill up)", () => {
    // L = 1e9 (6-dp), buy 1.0 perp (amount0 = 1e6). Hand-derived:
    //   nextSqrt ~= 2.004008 * Q96, amount1 ~= 4.008016 USD, fillPrice ~= 4.008.
    const result = simulateTakerSwap({
      sqrtPriceX96: SQRT_PRICE_X96_AT_4,
      liquidity: 1_000_000_000n,
      perpDelta: 1_000_000n,
      markPrice: MARK_AT_4,
    });
    expect(result.exceedsLiquidity).toBe(false);
    expect(result.usdDelta).toBeLessThan(0n); // long pays USD
    expect(result.fillPrice).toBeGreaterThan(MARK_AT_4);
    expect(result.fillPrice).toBeCloseTo(4.008, 2);
  });

  it("fills a short below the mark (price impact pushes the fill down)", () => {
    const result = simulateTakerSwap({
      sqrtPriceX96: SQRT_PRICE_X96_AT_4,
      liquidity: 1_000_000_000n,
      perpDelta: -1_000_000n,
      markPrice: MARK_AT_4,
    });
    expect(result.exceedsLiquidity).toBe(false);
    expect(result.usdDelta).toBeGreaterThan(0n); // short receives USD
    expect(result.fillPrice).toBeLessThan(MARK_AT_4);
    expect(result.fillPrice).toBeCloseTo(3.992, 2);
  });

  it("approaches the mark as liquidity grows (impact -> 0)", () => {
    const deep = simulateTakerSwap({
      sqrtPriceX96: SQRT_PRICE_X96_AT_4,
      liquidity: 1_000_000_000_000n,
      perpDelta: 1_000_000n,
      markPrice: MARK_AT_4,
    });
    expect(deep.fillPrice).toBeCloseTo(MARK_AT_4, 3);
  });

  it("shows worse fills as the order grows relative to liquidity", () => {
    const small = simulateTakerSwap({
      sqrtPriceX96: SQRT_PRICE_X96_AT_4,
      liquidity: 1_000_000_000n,
      perpDelta: 1_000_000n,
      markPrice: MARK_AT_4,
    });
    const large = simulateTakerSwap({
      sqrtPriceX96: SQRT_PRICE_X96_AT_4,
      liquidity: 1_000_000_000n,
      perpDelta: 100_000_000n,
      markPrice: MARK_AT_4,
    });
    expect(large.fillPrice).toBeGreaterThan(small.fillPrice);
  });

  it("flags an order larger than the constant-liquidity region (long)", () => {
    // Max buyable token0 in-region = L * Q96 / sqrtPriceX96 = L / sqrtPrice
    // = 1e9 / 2 = 5e8. Request more than that.
    const result = simulateTakerSwap({
      sqrtPriceX96: SQRT_PRICE_X96_AT_4,
      liquidity: 1_000_000_000n,
      perpDelta: 600_000_000n,
      markPrice: MARK_AT_4,
    });
    expect(result.exceedsLiquidity).toBe(true);
    expect(result.fillPrice).toBe(Number.POSITIVE_INFINITY);
  });

  it("returns mark for a zero-size order", () => {
    const result = simulateTakerSwap({
      sqrtPriceX96: SQRT_PRICE_X96_AT_4,
      liquidity: 1_000_000_000n,
      perpDelta: 0n,
      markPrice: MARK_AT_4,
    });
    expect(result.usdDelta).toBe(0n);
    expect(result.fillPrice).toBe(MARK_AT_4);
    expect(result.exceedsLiquidity).toBe(false);
  });
});
