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

describe("simulateTakerSwap fee inclusion", () => {
  const BASE = {
    sqrtPriceX96: SQRT_PRICE_X96_AT_4,
    liquidity: 1_000_000_000n,
    markPrice: MARK_AT_4,
  };
  const FEE_RATE = 0.003; // 30 bps total taker fee

  it("defaults to no fee: effective fields equal the raw ones", () => {
    const result = simulateTakerSwap({ ...BASE, perpDelta: 1_000_000n });
    expect(result.feeRate).toBe(0);
    expect(result.effectiveFillPrice).toBe(result.fillPrice);
    expect(result.effectiveUsdDelta).toBe(result.usdDelta);
  });

  it("makes a long pay exactly feeRate more (worse fill by the fee bps)", () => {
    const raw = simulateTakerSwap({ ...BASE, perpDelta: 1_000_000n });
    const withFee = simulateTakerSwap({ ...BASE, perpDelta: 1_000_000n, feeRate: FEE_RATE });
    // Raw impact is unchanged.
    expect(withFee.fillPrice).toBe(raw.fillPrice);
    expect(withFee.usdDelta).toBe(raw.usdDelta);
    // Effective fill is worse (higher) by exactly the fee rate.
    expect(withFee.effectiveFillPrice).toBeCloseTo(raw.fillPrice * (1 + FEE_RATE), 12);
    // Long pays more USD: effective magnitude larger by the fee bps.
    const rawMag = -raw.usdDelta; // long usdDelta is negative
    const effMag = -withFee.effectiveUsdDelta;
    expect(effMag).toBe((rawMag * 1_003_000n) / 1_000_000n);
    expect(withFee.effectiveUsdDelta).toBeLessThan(raw.usdDelta); // more negative
  });

  it("makes a short receive exactly feeRate less (worse fill by the fee bps)", () => {
    const raw = simulateTakerSwap({ ...BASE, perpDelta: -1_000_000n });
    const withFee = simulateTakerSwap({ ...BASE, perpDelta: -1_000_000n, feeRate: FEE_RATE });
    expect(withFee.fillPrice).toBe(raw.fillPrice);
    expect(withFee.usdDelta).toBe(raw.usdDelta);
    // Effective fill is worse (lower) by exactly the fee rate.
    expect(withFee.effectiveFillPrice).toBeCloseTo(raw.fillPrice * (1 - FEE_RATE), 12);
    // Short receives less USD.
    expect(withFee.effectiveUsdDelta).toBe((raw.usdDelta * 997_000n) / 1_000_000n);
    expect(withFee.effectiveUsdDelta).toBeLessThan(raw.usdDelta);
  });

  it("folds the fee into the flat-mark fallback (no liquidity)", () => {
    const long = simulateTakerSwap({
      ...BASE,
      liquidity: 0n,
      perpDelta: 1_000_000n,
      feeRate: FEE_RATE,
    });
    expect(long.effectiveFillPrice).toBeCloseTo(MARK_AT_4 * (1 + FEE_RATE), 12);
    const short = simulateTakerSwap({
      ...BASE,
      liquidity: 0n,
      perpDelta: -1_000_000n,
      feeRate: FEE_RATE,
    });
    expect(short.effectiveFillPrice).toBeCloseTo(MARK_AT_4 * (1 - FEE_RATE), 12);
  });

  it("rejects a negative or non-finite feeRate", () => {
    expect(() => simulateTakerSwap({ ...BASE, perpDelta: 1_000_000n, feeRate: -0.01 })).toThrow(
      /feeRate/
    );
    expect(() =>
      simulateTakerSwap({ ...BASE, perpDelta: 1_000_000n, feeRate: Number.NaN })
    ).toThrow(/feeRate/);
  });
});

describe("simulateTakerSwap liquidityLimited flag", () => {
  it("is false for a small order well within the current region", () => {
    const result = simulateTakerSwap({
      sqrtPriceX96: SQRT_PRICE_X96_AT_4,
      liquidity: 1_000_000_000_000n,
      perpDelta: 1_000_000n,
      markPrice: MARK_AT_4,
    });
    expect(result.liquidityLimited).toBe(false);
  });

  it("is true for an order that moves the price a large fraction", () => {
    // Draining most of the region's token0 moves sqrtPrice far past the warn
    // threshold, so the single-region estimate is flagged as an underestimate.
    const result = simulateTakerSwap({
      sqrtPriceX96: SQRT_PRICE_X96_AT_4,
      liquidity: 1_000_000_000n,
      perpDelta: 400_000_000n, // capacity is 5e8; this is 80% of it
      markPrice: MARK_AT_4,
    });
    expect(result.exceedsLiquidity).toBe(false);
    expect(result.liquidityLimited).toBe(true);
  });

  it("is true when the order exceeds the region entirely", () => {
    const result = simulateTakerSwap({
      sqrtPriceX96: SQRT_PRICE_X96_AT_4,
      liquidity: 1_000_000_000n,
      perpDelta: 600_000_000n,
      markPrice: MARK_AT_4,
    });
    expect(result.exceedsLiquidity).toBe(true);
    expect(result.liquidityLimited).toBe(true);
  });
});
