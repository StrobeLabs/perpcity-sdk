import { describe, expect, it } from "vitest";
import {
  isHealthy,
  makerPoolValue,
  maxOpenLeverage,
  meetsMinOpeningMargin,
  type TakerEconomicsInput,
  takerEconomics,
} from "../../math/economics";
import { getAmountsForLiquidity } from "../../math/liquidityAmounts";
import { makerLimits } from "../../math/makerLimits";
import { getSqrtPriceAtTick } from "../../utils/tickMath";

const Q96 = 1n << 96n;
const RATES = { lpFee: 10_000n, creatorFee: 100n, insuranceFee: 1_000n, protocolFee: 0n };
const price = (p: number) => BigInt(Math.round(p * 1e6)) * (Q96 / 1_000_000n);

// 10 perps long, entry 10 USD, 10 USD margin (10x), 5% liquidation ratio.
const LONG: TakerEconomicsInput = {
  build: "v0.2.2",
  perpDelta: 10_000_000n,
  usdDelta: -100_000_000n,
  margin: 10_000_000n,
  fundingOwed: 0n,
  utilOwed: 0n,
  fairX96: 10n * Q96,
  liqMarginRatioE6: 50_000,
  liqFeeE6: 10_000,
  closeFeeRates: RATES,
};

describe("isHealthy", () => {
  it("compares equity / (value + 1) to the ratio in 1e6 fixed point", () => {
    expect(isHealthy(5_000_000n, 99_999_999n, 50_000n)).toBe(true);
    expect(isHealthy(4_999_999n, 99_999_999n, 50_000n)).toBe(false);
    expect(isHealthy(-1n, 0n, 0n)).toBe(true);
    expect(isHealthy(0n, 100n, 1n)).toBe(false);
  });
});

describe("takerEconomics", () => {
  it("values a long at the fair mark", () => {
    const e = takerEconomics({ ...LONG, fairX96: 11n * Q96, realizedPnl: 1_000_000n });
    expect(e.value).toBe(110_000_000n);
    expect(e.pnl).toBe(9_000_000n);
    expect(e.equity).toBe(20_000_000n);
    expect(e.leverage).toBeCloseTo(5.5, 12);
    expect(e.isLiquidatable).toBe(false);
  });

  it("nets funding and util owed into equity", () => {
    const e = takerEconomics({ ...LONG, fundingOwed: 2_000_000n, utilOwed: 500_000n });
    expect(e.equity).toBe(7_500_000n);
  });

  it("has no leverage once equity is gone", () => {
    expect(takerEconomics({ ...LONG, fairX96: 9n * Q96 }).leverage).toBeNull();
  });

  it.each([
    ["v0.2.2", 90 / 9.5],
    ["58b42b7", 90 / (10 - (0.05 + 0.0111 + 0.01) * 10)],
  ] as const)("puts the %s liquidation price where the check flips", (build, expected) => {
    const e = takerEconomics({ ...LONG, build });
    expect(e.liquidationPrice).toBeCloseTo(expected, 9);
    const at = (p: number) => takerEconomics({ ...LONG, build, fairX96: price(p) }).isLiquidatable;
    expect(at(expected * 1.001)).toBe(false);
    expect(at(expected * 0.999)).toBe(true);
  });

  it("liquidates a 58b42b7 long earlier than v0.2.2 (fees first)", () => {
    const p = price(9.6);
    expect(takerEconomics({ ...LONG, fairX96: p }).isLiquidatable).toBe(false);
    expect(takerEconomics({ ...LONG, build: "58b42b7", fairX96: p }).isLiquidatable).toBe(true);
  });

  it("solves a short's liquidation price above the mark", () => {
    const short = { ...LONG, perpDelta: -10_000_000n, usdDelta: 100_000_000n };
    const e = takerEconomics(short);
    expect(e.liquidationPrice).toBeCloseTo(110 / 10.5, 9);
    expect(takerEconomics({ ...short, fairX96: price(10.5) }).isLiquidatable).toBe(true);
  });

  it("has no liquidation price without exposure", () => {
    expect(takerEconomics({ ...LONG, perpDelta: 0n }).liquidationPrice).toBeNull();
  });
});

describe("makerPoolValue", () => {
  // Expected values from the backend's position_equity_service port.
  it.each([
    [-6960, 6960, 10n ** 15n, 0, 587777676754614n],
    [23000, 24000, 5n * 10n ** 14n, 22000, 69677589246432n],
    [23000, 24000, 5n * 10n ** 14n, 25000, 80953202026449n],
    [23000, 24000, 5n * 10n ** 14n, 23500, 79941390286200n],
  ])("values [%i, %i] L=%s at tick %i", (tickLower, tickUpper, liquidity, tick, expected) => {
    const sqrtPriceX96 = getSqrtPriceAtTick(tick);
    const fairX96 = (sqrtPriceX96 * sqrtPriceX96) / Q96;
    expect(makerPoolValue({ liquidity, tickLower, tickUpper, sqrtPriceX96, fairX96 })).toBe(
      expected
    );
  });

  it("is zero without liquidity", () => {
    expect(
      makerPoolValue({
        liquidity: 0n,
        tickLower: 0,
        tickUpper: 60,
        sqrtPriceX96: Q96,
        fairX96: Q96,
      })
    ).toBe(0n);
  });
});

describe("maxOpenLeverage", () => {
  it("is 1 / (init + fee + impact), floored to 0.1", () => {
    expect(maxOpenLeverage({ initRatio: 0.1, feeRate: 0.0111, priceImpact: 0 })).toBe(9);
    expect(maxOpenLeverage({ initRatio: 0.1, feeRate: 0.0111, priceImpact: 0.01 })).toBe(8.2);
    expect(maxOpenLeverage({ initRatio: 0.1, feeRate: 0, priceImpact: -0.05 })).toBe(10);
    expect(maxOpenLeverage({ initRatio: 0, feeRate: 0, priceImpact: 0 })).toBe(0);
  });
});

describe("meetsMinOpeningMargin", () => {
  it("checks before fees on 58b42b7 and also after fees on v0.2.2", () => {
    const at = { margin: 5_050_000n, fees: 100_000n };
    expect(meetsMinOpeningMargin({ build: "58b42b7", ...at })).toBe(true);
    expect(meetsMinOpeningMargin({ build: "v0.2.2", ...at })).toBe(false);
    expect(meetsMinOpeningMargin({ build: "58b42b7", margin: 4_999_999n, fees: 0n })).toBe(false);
  });
});

describe("makerLimits", () => {
  const range = { tickLower: 23000, tickUpper: 24000, sqrtPriceX96: getSqrtPriceAtTick(23500) };
  const exact = getAmountsForLiquidity(
    range.sqrtPriceX96,
    getSqrtPriceAtTick(range.tickLower),
    getSqrtPriceAtTick(range.tickUpper),
    5n * 10n ** 14n
  );

  it("caps an add at the rounded-up amounts plus slippage", () => {
    const add = makerLimits({ ...range, liquidityDelta: 5n * 10n ** 14n, slippage: 0 });
    expect(add.amt0Limit - exact.amount0).toBeGreaterThanOrEqual(0n);
    expect(add.amt0Limit - exact.amount0).toBeLessThanOrEqual(1n);
    const slipped = makerLimits({ ...range, liquidityDelta: 5n * 10n ** 14n, slippage: 0.01 });
    expect(slipped.amt1Limit).toBeGreaterThan(add.amt1Limit);
  });

  it("floors a remove's minimums, never above the amounts returned", () => {
    const remove = makerLimits({ ...range, liquidityDelta: -5n * 10n ** 14n, slippage: 0 });
    expect(remove).toEqual({ amt0Limit: exact.amount0, amt1Limit: exact.amount1 });
    const slipped = makerLimits({ ...range, liquidityDelta: -5n * 10n ** 14n, slippage: 0.01 });
    expect(slipped.amt0Limit).toBeLessThan(exact.amount0);
  });

  it("has no limits for a zero delta", () => {
    expect(makerLimits({ ...range, liquidityDelta: 0n, slippage: 0.01 })).toEqual({
      amt0Limit: 0n,
      amt1Limit: 0n,
    });
  });
});
