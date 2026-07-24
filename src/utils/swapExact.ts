import { applyFeeToUsd, FEE_SCALE, type SimulatedTakerSwap } from "./swap";
import { computeSwapStepToken0, getAmount0Delta, getAmount1Delta } from "./swapMath";
import { getSqrtPriceAtTick } from "./tickMath";

/**
 * Exact multi-tick taker swap simulation.
 *
 * A perp's fill is settled by a real Uniswap v4 `PoolManager.swap` against a
 * pool created with `fee: 0` and no hooks (`PerpFactory`), with no sqrt-price
 * limit (`PerpLogic.swap`). Given the pool's initialized ticks this walks the
 * same curve the chain walks, so the returned USD leg matches the on-chain fill
 * to the wei — unlike `simulateTakerSwap`, which assumes the current active
 * liquidity holds across the whole trade.
 *
 * That assumption is wrong in both directions, not merely optimistic: a band of
 * liquidity above spot makes real fills *cheaper* than the flat model predicts,
 * while the band's edge means the pool runs dry far *sooner* than the flat model
 * predicts. Only a tick walk gets both right.
 *
 * FEES are unchanged: the raw `fillPrice` / `usdDelta` are the pure curve result
 * (the true entry price), and the perp charges its taker fee separately out of
 * margin. See `simulateTakerSwap` for the `feeRate` / effective-field contract.
 */

/** An initialized tick and the liquidity delta applied when crossing it upward. */
export type PoolTick = {
  tick: number;
  liquidityNet: bigint;
};

/** Every initialized tick in a perp pool, ascending by tick. */
export type PoolTickMap = {
  tickSpacing: number;
  ticks: readonly PoolTick[];
};

export type ExactSimulatedTakerSwap = SimulatedTakerSwap & {
  /** Pool sqrt price after the swap. Feeds the `PriceImpactTooHigh` bounds check. */
  endSqrtPriceX96: bigint;
  /** Initialized ticks the swap crosses. Zero means it stays within one region. */
  ticksCrossed: number;
};

/**
 * Thrown when a tick map cannot reproduce the pool's live active liquidity,
 * which means an LP has minted or burned since the map was read. Callers should
 * refetch the map and retry, falling back to `simulateTakerSwap` if that fails.
 */
export class StaleTickMapError extends Error {
  constructor(
    readonly expectedLiquidity: bigint,
    readonly derivedLiquidity: bigint
  ) {
    super(
      `tick map is stale: derived active liquidity ${derivedLiquidity} != pool liquidity ${expectedLiquidity}`
    );
    this.name = "StaleTickMapError";
  }
}

/**
 * Active liquidity implied by a tick map at a given price: the sum of
 * `liquidityNet` over every initialized tick at or below the current tick.
 *
 * `getSqrtPriceAtTick` is monotonic, so `sqrtPriceAtTick(t) <= sqrtPriceX96`
 * holds exactly when `t <= currentTick`. Comparing sqrt prices therefore
 * identifies the ticks below spot without needing a `getTickAtSqrtPrice` port.
 */
export function activeLiquidityAt(tickMap: PoolTickMap, sqrtPriceX96: bigint): bigint {
  let liquidity = 0n;
  for (const { tick, liquidityNet } of tickMap.ticks) {
    if (getSqrtPriceAtTick(tick) > sqrtPriceX96) break;
    liquidity += liquidityNet;
  }
  return liquidity;
}

/**
 * Verify a tick map still describes the live pool. The pool's own `liquidity`
 * is streamed on every swap, so this costs nothing and catches a stale map
 * whenever an LP has changed liquidity spanning the current price.
 */
export function assertTickMapFresh(
  tickMap: PoolTickMap,
  sqrtPriceX96: bigint,
  liquidity: bigint
): void {
  const derived = activeLiquidityAt(tickMap, sqrtPriceX96);
  if (derived !== liquidity) throw new StaleTickMapError(liquidity, derived);
}

/** Ticks a long walks through, ascending. Excludes the current tick. */
function ticksAbove(tickMap: PoolTickMap, sqrtPriceX96: bigint): PoolTick[] {
  return tickMap.ticks.filter((t) => getSqrtPriceAtTick(t.tick) > sqrtPriceX96);
}

/** Ticks a short walks through, descending. Includes the current tick. */
function ticksAtOrBelow(tickMap: PoolTickMap, sqrtPriceX96: bigint): PoolTick[] {
  return tickMap.ticks.filter((t) => getSqrtPriceAtTick(t.tick) <= sqrtPriceX96).reverse();
}

/**
 * The largest perp leg the pool can fill in one direction, in 6-dp units.
 *
 * Beyond this the on-chain swap cannot settle the exact perp amount and
 * `PerpLogic.swap` reverts with `InsufficientLiquidityToFill`, so the UI must
 * block the order rather than quote it.
 */
export function maxFillablePerpDelta(opts: {
  sqrtPriceX96: bigint;
  liquidity: bigint;
  tickMap: PoolTickMap;
  isLong: boolean;
}): bigint {
  const { sqrtPriceX96, liquidity, tickMap, isLong } = opts;
  let sqrtPrice = sqrtPriceX96;
  let active = liquidity;
  let total = 0n;

  const path = isLong ? ticksAbove(tickMap, sqrtPriceX96) : ticksAtOrBelow(tickMap, sqrtPriceX96);
  for (const { tick, liquidityNet } of path) {
    const target = getSqrtPriceAtTick(tick);
    total += isLong
      ? getAmount0Delta(sqrtPrice, target, active, false)
      : getAmount0Delta(target, sqrtPrice, active, true);
    active += isLong ? liquidityNet : -liquidityNet;
    sqrtPrice = target;
  }
  return total;
}

/** One constant-liquidity region of a pool's one-sided depth, in walk order. */
export type DepthRegion = {
  /** Region bounds; start is nearer spot, end is the initialized tick's price. */
  sqrtPriceStartX96: bigint;
  sqrtPriceEndX96: bigint;
  /** The initialized tick that terminates the region (crossed at its end). */
  tick: number;
  /** Active liquidity within the region. */
  liquidity: bigint;
  /** Perp (token0) fillable within the region, 6-dp units. */
  perpDelta: bigint;
  /** USD (token1) leg for filling the region, 6-dp units. */
  usdDelta: bigint;
};

/**
 * The pool's one-sided depth as per-region rows: `maxFillablePerpDelta`'s walk
 * emitting each constant-liquidity region instead of a single sum. Feeds order
 * book style depth displays. Zero-liquidity regions are skipped (they fill
 * nothing). Does not check freshness — callers should `assertTickMapFresh`
 * first, exactly like `simulateTakerSwapExact` does internally.
 *
 * Amount rounding matches `computeSwapStepToken0` at a tick boundary, so a
 * fill to any region's end reproduces `simulateTakerSwapExact`'s USD leg to
 * the wei when summed over the preceding regions.
 */
export function walkPoolDepth(opts: {
  sqrtPriceX96: bigint;
  liquidity: bigint;
  tickMap: PoolTickMap;
  isLong: boolean;
}): DepthRegion[] {
  const { sqrtPriceX96, liquidity, tickMap, isLong } = opts;
  let sqrtPrice = sqrtPriceX96;
  let active = liquidity;
  const regions: DepthRegion[] = [];

  const path = isLong ? ticksAbove(tickMap, sqrtPriceX96) : ticksAtOrBelow(tickMap, sqrtPriceX96);
  for (const { tick, liquidityNet } of path) {
    const target = getSqrtPriceAtTick(tick);
    const perpDelta = isLong
      ? getAmount0Delta(sqrtPrice, target, active, false)
      : getAmount0Delta(target, sqrtPrice, active, true);

    if (active > 0n && perpDelta > 0n) {
      const usdDelta = isLong
        ? getAmount1Delta(sqrtPrice, target, active, true)
        : getAmount1Delta(target, sqrtPrice, active, false);
      regions.push({
        sqrtPriceStartX96: sqrtPrice,
        sqrtPriceEndX96: target,
        tick,
        liquidity: active,
        perpDelta,
        usdDelta,
      });
    }

    active += isLong ? liquidityNet : -liquidityNet;
    sqrtPrice = target;
  }
  return regions;
}

export function simulateTakerSwapExact(opts: {
  sqrtPriceX96: bigint;
  liquidity: bigint;
  perpDelta: bigint;
  markPrice: number;
  tickMap: PoolTickMap;
  feeRate?: number;
}): ExactSimulatedTakerSwap {
  const { sqrtPriceX96, liquidity, perpDelta, markPrice, tickMap } = opts;
  const feeRate = opts.feeRate ?? 0;
  if (!Number.isFinite(feeRate) || feeRate < 0) {
    throw new Error("feeRate must be a non-negative, finite number");
  }

  const feeScaled = BigInt(Math.round(feeRate * Number(FEE_SCALE)));
  const isLong = perpDelta > 0n;
  const absPerpDelta = perpDelta < 0n ? -perpDelta : perpDelta;
  const feeMultiplier = isLong ? 1 + feeRate : 1 - feeRate;

  if (sqrtPriceX96 <= 0n || absPerpDelta === 0n) {
    const usd = (absPerpDelta * BigInt(Math.round(markPrice * 1e6))) / 1_000_000n;
    const effectiveUsd = applyFeeToUsd(usd, isLong, feeScaled);
    return {
      usdDelta: isLong ? -usd : usd,
      fillPrice: markPrice,
      feeRate,
      effectiveUsdDelta: isLong ? -effectiveUsd : effectiveUsd,
      effectiveFillPrice: markPrice * feeMultiplier,
      exceedsLiquidity: absPerpDelta > 0n,
      liquidityLimited: false,
      endSqrtPriceX96: sqrtPriceX96,
      ticksCrossed: 0,
    };
  }

  assertTickMapFresh(tickMap, sqrtPriceX96, liquidity);

  let sqrtPrice = sqrtPriceX96;
  let active = liquidity;
  let remaining = absPerpDelta;
  let usd = 0n;
  let ticksCrossed = 0;

  const path = isLong ? ticksAbove(tickMap, sqrtPriceX96) : ticksAtOrBelow(tickMap, sqrtPriceX96);
  for (const { tick, liquidityNet } of path) {
    const step = computeSwapStepToken0({
      sqrtPriceCurrentX96: sqrtPrice,
      sqrtPriceTargetX96: getSqrtPriceAtTick(tick),
      liquidity: active,
      remainingToken0: remaining,
      exactOutput: isLong,
    });

    usd += step.amount1;
    remaining -= step.amount0;
    sqrtPrice = step.sqrtPriceNextX96;
    if (remaining === 0n) break;

    // The step stopped at the tick without filling, so the pool crosses it.
    active += isLong ? liquidityNet : -liquidityNet;
    ticksCrossed++;
  }

  // The pool ran out of initialized ticks before filling the perp leg, so the
  // real swap would revert with `InsufficientLiquidityToFill`.
  if (remaining > 0n) {
    const infUsd = 1n << 255n;
    return {
      usdDelta: isLong ? -infUsd : infUsd,
      fillPrice: Number.POSITIVE_INFINITY,
      feeRate,
      effectiveUsdDelta: isLong ? -infUsd : infUsd,
      effectiveFillPrice: Number.POSITIVE_INFINITY,
      exceedsLiquidity: true,
      liquidityLimited: false,
      endSqrtPriceX96: sqrtPrice,
      ticksCrossed,
    };
  }

  const fillPrice = Number(usd) / Number(absPerpDelta);
  const effectiveUsd = applyFeeToUsd(usd, isLong, feeScaled);

  return {
    usdDelta: isLong ? -usd : usd,
    fillPrice,
    feeRate,
    effectiveUsdDelta: isLong ? -effectiveUsd : effectiveUsd,
    effectiveFillPrice: fillPrice * feeMultiplier,
    exceedsLiquidity: false,
    liquidityLimited: false,
    endSqrtPriceX96: sqrtPrice,
    ticksCrossed,
  };
}
