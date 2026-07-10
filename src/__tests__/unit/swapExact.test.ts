import { describe, expect, it } from "vitest";
import { simulateTakerSwap } from "../../utils/swap";
import {
  activeLiquidityAt,
  maxFillablePerpDelta,
  type PoolTickMap,
  StaleTickMapError,
  simulateTakerSwapExact,
} from "../../utils/swapExact";
import { getSqrtPriceAtTick } from "../../utils/tickMath";

/**
 * State of the live mainnet perp 0x8ac0179073a9eb5aaee58e5ebe9882066b9e7b6c,
 * read from the Uniswap v4 PoolManager (0x360E68fa...) at poolId 0x23ed4a6f...
 *
 * The expected USD legs below are not hand-derived: every one was produced by
 * `eth_call`ing Uniswap's own V4Quoter (0x3972c00f...) against this pool. The
 * walker has to reproduce them to the wei, because the same PoolManager settles
 * the perp's real fill. `src/__tests__/integration/swapQuoter.test.ts` re-derives
 * them against the live chain.
 *
 * Liquidity here sits in a band *above* spot (tick 40050 adds 3.6x the active
 * liquidity) that ends at tick 44460 — the shape that breaks the single-region
 * approximation in both directions at once.
 */
const SQRT_PRICE_X96 = 539_635_589_510_744_202_256_725_218_321n;
const LIQUIDITY = 167_610_582n;
const MARK = 46.3919;

const TICK_MAP: PoolTickMap = {
  tickSpacing: 30,
  ticks: [
    { tick: 32400, liquidityNet: 100_000n },
    { tick: 33990, liquidityNet: 102_899_920n },
    { tick: 36000, liquidityNet: 5_000_000n },
    { tick: 38040, liquidityNet: 59_610_662n },
    { tick: 40050, liquidityNet: 605_043_985n },
    { tick: 40080, liquidityNet: -102_899_920n },
    { tick: 40920, liquidityNet: 31_245_379n },
    { tick: 41250, liquidityNet: 30_764_892n },
    { tick: 41430, liquidityNet: 19_689_168n },
    { tick: 41760, liquidityNet: -605_043_985n },
    { tick: 42060, liquidityNet: -50_454_060n },
    { tick: 42510, liquidityNet: -90_856_041n },
    { tick: 44460, liquidityNet: -5_100_000n },
  ],
};

const base = {
  sqrtPriceX96: SQRT_PRICE_X96,
  liquidity: LIQUIDITY,
  markPrice: MARK,
  tickMap: TICK_MAP,
};

/** perp leg (6-dp) -> USD leg, from V4Quoter.quoteExactOutputSingle. */
const LONG_QUOTES: readonly [bigint, bigint][] = [
  [100_000n, 4_658_118n],
  [1_000_000n, 48_356_956n],
  [2_000_000n, 100_990_910n],
  [5_000_000n, 271_223_391n],
  [8_000_000n, 453_389_739n],
  [10_000_000n, 581_851_768n],
  [10_300_000n, 602_915_471n],
];

/** perp leg (6-dp) -> USD leg, from V4Quoter.quoteExactInputSingle. */
const SHORT_QUOTES: readonly [bigint, bigint][] = [
  [100_000n, 4_620_412n],
  [1_000_000n, 44_259_103n],
];

/** Largest perp leg the pool can settle; one unit more reverts on-chain. */
const MAX_LONG = 10_302_003n;
const MAX_SHORT = 3_946_165n;

describe("activeLiquidityAt", () => {
  it("reconstructs the pool's active liquidity from the tick map", () => {
    expect(activeLiquidityAt(TICK_MAP, SQRT_PRICE_X96)).toBe(LIQUIDITY);
  });

  it("rejects a tick map that no longer describes the pool", () => {
    const stale: PoolTickMap = {
      tickSpacing: 30,
      ticks: TICK_MAP.ticks.filter((t) => t.tick !== 38040),
    };
    expect(() =>
      simulateTakerSwapExact({ ...base, tickMap: stale, perpDelta: 1_000_000n })
    ).toThrow(StaleTickMapError);
  });
});

describe("simulateTakerSwapExact", () => {
  it.each(LONG_QUOTES)("matches V4Quoter for a %s long", (perpDelta, expectedUsd) => {
    const result = simulateTakerSwapExact({ ...base, perpDelta });
    expect(result.exceedsLiquidity).toBe(false);
    expect(result.usdDelta).toBe(-expectedUsd);
  });

  it.each(SHORT_QUOTES)("matches V4Quoter for a %s short", (perpDelta, expectedUsd) => {
    const result = simulateTakerSwapExact({ ...base, perpDelta: -perpDelta });
    expect(result.exceedsLiquidity).toBe(false);
    expect(result.usdDelta).toBe(expectedUsd);
  });

  it("crosses ticks and reports how many", () => {
    const withinTick = simulateTakerSwapExact({ ...base, perpDelta: 100_000n });
    expect(withinTick.ticksCrossed).toBe(0);

    const multiTick = simulateTakerSwapExact({ ...base, perpDelta: 10_000_000n });
    expect(multiTick.ticksCrossed).toBeGreaterThan(0);
    expect(multiTick.endSqrtPriceX96).toBeGreaterThan(SQRT_PRICE_X96);
  });

  it("flags an order the pool cannot settle rather than quoting it", () => {
    expect(simulateTakerSwapExact({ ...base, perpDelta: MAX_LONG }).exceedsLiquidity).toBe(false);
    expect(simulateTakerSwapExact({ ...base, perpDelta: MAX_LONG + 1n }).exceedsLiquidity).toBe(
      true
    );
    expect(simulateTakerSwapExact({ ...base, perpDelta: -MAX_SHORT }).exceedsLiquidity).toBe(false);
    expect(simulateTakerSwapExact({ ...base, perpDelta: -(MAX_SHORT + 1n) }).exceedsLiquidity).toBe(
      true
    );
  });

  it("keeps fees out of the raw fill and folds them into the effective fields", () => {
    const feeRate = 0.0111;
    const perpDelta = 1_000_000n;
    const raw = simulateTakerSwapExact({ ...base, perpDelta });
    const withFee = simulateTakerSwapExact({ ...base, perpDelta, feeRate });

    expect(withFee.usdDelta).toBe(raw.usdDelta);
    expect(withFee.fillPrice).toBe(raw.fillPrice);
    expect(withFee.effectiveFillPrice).toBeCloseTo(raw.fillPrice * (1 + feeRate), 9);
  });

  it("prices a short below the mark and a long above it", () => {
    const long = simulateTakerSwapExact({ ...base, perpDelta: 1_000_000n });
    const short = simulateTakerSwapExact({ ...base, perpDelta: -1_000_000n });
    expect(long.fillPrice).toBeGreaterThan(MARK);
    expect(short.fillPrice).toBeLessThan(MARK);
  });

  it("corrects the single-region model, which errs in both directions at once", () => {
    const perpDelta = 10_000_000n;
    const exact = simulateTakerSwapExact({ ...base, perpDelta });
    const approx = simulateTakerSwap({ ...base, perpDelta });

    // Liquidity above spot makes the true fill much cheaper than the flat model.
    expect(-exact.usdDelta).toBeLessThan(-approx.usdDelta);
    expect(approx.liquidityLimited).toBe(true);

    // Yet the flat model thinks the pool is far deeper than it is.
    expect(simulateTakerSwap({ ...base, perpDelta: 20_000_000n }).exceedsLiquidity).toBe(false);
    expect(simulateTakerSwapExact({ ...base, perpDelta: 20_000_000n }).exceedsLiquidity).toBe(true);
  });
});

describe("maxFillablePerpDelta", () => {
  it("returns the exact largest settleable leg on each side", () => {
    expect(maxFillablePerpDelta({ ...base, isLong: true })).toBe(MAX_LONG);
    expect(maxFillablePerpDelta({ ...base, isLong: false })).toBe(MAX_SHORT);
  });
});

describe("getSqrtPriceAtTick", () => {
  it("brackets the pool's live price with its own tick", () => {
    expect(getSqrtPriceAtTick(38373)).toBeLessThanOrEqual(SQRT_PRICE_X96);
    expect(getSqrtPriceAtTick(38374)).toBeGreaterThan(SQRT_PRICE_X96);
  });

  it("is 2^96 at tick zero and monotonic", () => {
    expect(getSqrtPriceAtTick(0)).toBe(79_228_162_514_264_337_593_543_950_336n);
    expect(getSqrtPriceAtTick(-1)).toBeLessThan(getSqrtPriceAtTick(0));
    expect(getSqrtPriceAtTick(1)).toBeGreaterThan(getSqrtPriceAtTick(0));
  });
});
