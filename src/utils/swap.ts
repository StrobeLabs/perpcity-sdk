import { Q96 } from "./constants";

/**
 * Single-region (constant-liquidity) swap simulation for an exact-perp-in
 * taker order.
 *
 * The pool is a Uniswap-v3-style concentrated-liquidity AMM where token0 is the
 * perp and token1 is USD, so the spot price (token1/token0) is the mark price
 * and `sqrtPriceX96 = sqrt(price) * 2^96`. A taker order fixes the perp leg
 * (`perpDelta`) and the contract settles whatever USD (`amount1`) that perp
 * costs, so this simulates exact-token0-in/out and returns the resulting USD
 * cost and the average fill price.
 *
 * IMPORTANT — single-region approximation. We only have the pool's *current*
 * active liquidity (`poolState.liquidity`), not the full per-tick liquidity
 * map, so this walks the curve as if `liquidity` were constant. That is exact
 * while the swap stays within the current tick and an approximation once it
 * would cross an initialized tick (it overstates available depth, so it
 * *understates* the true impact). Two flags surface this:
 *   - `exceedsLiquidity` — the order is larger than the entire constant-
 *     liquidity region can fill; a strong signal the real swap would revert
 *     with `PriceImpactTooHigh`.
 *   - `liquidityLimited` — the order moves the pool price by more than
 *     `APPROX_TICK_CROSS_WARN_FRACTION`, so it very likely crosses at least one
 *     initialized tick and the returned impact is a (possibly large)
 *     *underestimate* of the true impact. The UI should warn on this.
 *
 * FEES. The raw `fillPrice` / `usdDelta` are the pure AMM curve result and do
 * NOT include pool fees. Pass `feeRate` (the total taker fee as a fraction —
 * creatorFee + insuranceFee + lpFee) to also get the fee-inclusive
 * `effectiveFillPrice` / `effectiveUsdDelta`, which are the true cost the user
 * pays: a long pays `feeRate` more USD, a short receives `feeRate` less USD.
 * Callers derive the displayed "Est %" price impact from `effectiveFillPrice`
 * (fees included) while `fillPrice` stays available to separate raw impact from
 * fees. When `feeRate` is omitted the effective fields equal the raw ones.
 */
export type SimulatedTakerSwap = {
  /** Signed USD delta in 6-dp contract units (negative for longs). Fee-exclusive. */
  usdDelta: bigint;
  /** Average fill price (USD per perp), price impact only, fees excluded. */
  fillPrice: number;
  /** Total taker fee rate folded into the effective fields (fraction, e.g. 0.003). */
  feeRate: number;
  /**
   * Fee-inclusive signed USD delta in 6-dp contract units. Larger magnitude
   * than `usdDelta` for a long (pays more), smaller for a short (receives less).
   */
  effectiveUsdDelta: bigint;
  /**
   * Fee-inclusive average fill price (USD per perp) — the true per-unit cost the
   * user pays. Worse than `fillPrice` by exactly `feeRate`: higher for a long,
   * lower for a short.
   */
  effectiveFillPrice: number;
  /** True when the order exceeds the constant-liquidity region's capacity. */
  exceedsLiquidity: boolean;
  /**
   * True when the trade moves the pool price by more than
   * `APPROX_TICK_CROSS_WARN_FRACTION`, i.e. it very likely crosses an
   * initialized tick and the single-region model understates the real impact.
   */
  liquidityLimited: boolean;
};

/** 6-dp fixed-point scale for the fee rate (fees are read as `uint24 / 1e6`). */
export const FEE_SCALE = 1_000_000n;

/**
 * Fractional pool-price move above which the single-region (constant-liquidity)
 * approximation is treated as unreliable: past this the swap has almost
 * certainly crossed an initialized tick, so the returned impact is an
 * underestimate. Heuristic — tune as pool tick spacing / depth profiles are
 * better understood. Measured on the sqrt price, so the price itself moves by
 * roughly `2 * APPROX_TICK_CROSS_WARN_FRACTION`.
 */
export const APPROX_TICK_CROSS_WARN_FRACTION = 0.02;

function mulDivRoundingUp(a: bigint, b: bigint, denominator: bigint): bigint {
  const product = a * b;
  const result = product / denominator;
  return product % denominator === 0n ? result : result + 1n;
}

/**
 * Replicates Uniswap v3 `SqrtPriceMath.getNextSqrtPriceFromAmount0RoundingUp`.
 * `add` = true when token0 (perp) flows into the pool (a short, price falls);
 * `add` = false when token0 leaves the pool (a long, price rises).
 */
function getNextSqrtPriceFromAmount0(
  sqrtPriceX96: bigint,
  liquidity: bigint,
  amount0: bigint,
  add: boolean
): bigint {
  if (amount0 === 0n) return sqrtPriceX96;
  const numerator1 = liquidity << 96n; // liquidity * Q96
  const product = amount0 * sqrtPriceX96;

  if (add) {
    const denominator = numerator1 + product;
    return mulDivRoundingUp(numerator1, sqrtPriceX96, denominator);
  }
  // Removing token0: the region is exhausted once it would price out to
  // infinity (product >= numerator1). The caller flags this case.
  const denominator = numerator1 - product;
  return mulDivRoundingUp(numerator1, sqrtPriceX96, denominator);
}

/** Replicates Uniswap v3 `SqrtPriceMath.getAmount1Delta` (token1 = USD). */
function getAmount1Delta(sqrtLowerX96: bigint, sqrtUpperX96: bigint, liquidity: bigint): bigint {
  const diff =
    sqrtUpperX96 > sqrtLowerX96 ? sqrtUpperX96 - sqrtLowerX96 : sqrtLowerX96 - sqrtUpperX96;
  return (liquidity * diff) / Q96;
}

/**
 * Fold the total taker fee into an absolute USD amount, in the direction the
 * trader actually pays it: a long pays `feeScaled` more USD, a short receives
 * `feeScaled` less. `feeScaled` is the fee rate in 6-dp fixed point.
 */
export function applyFeeToUsd(absUsd: bigint, isLong: boolean, feeScaled: bigint): bigint {
  return isLong
    ? (absUsd * (FEE_SCALE + feeScaled)) / FEE_SCALE
    : (absUsd * (FEE_SCALE - feeScaled)) / FEE_SCALE;
}

/**
 * Simulate an exact-perp-in taker swap against constant active liquidity.
 *
 * @param sqrtPriceX96 - Current pool sqrt price (X96), from `poolState`.
 * @param liquidity - Current active liquidity, from `poolState`.
 * @param perpDelta - Signed perp leg in 6-dp units (positive long, negative short).
 * @param markPrice - Current mark price, used for the exhausted-liquidity fallback.
 * @param feeRate - Total taker fee as a fraction (creatorFee + insuranceFee +
 *   lpFee). Defaults to 0, in which case the effective fields equal the raw ones.
 */
export function simulateTakerSwap(opts: {
  sqrtPriceX96: bigint;
  liquidity: bigint;
  perpDelta: bigint;
  markPrice: number;
  feeRate?: number;
}): SimulatedTakerSwap {
  const { sqrtPriceX96, liquidity, perpDelta, markPrice } = opts;
  const feeRate = opts.feeRate ?? 0;
  if (!Number.isFinite(feeRate) || feeRate < 0) {
    throw new Error("feeRate must be a non-negative, finite number");
  }
  const feeScaled = BigInt(Math.round(feeRate * Number(FEE_SCALE)));
  const isLong = perpDelta > 0n;
  const absPerpDelta = perpDelta < 0n ? -perpDelta : perpDelta;
  const feeMultiplier = isLong ? 1 + feeRate : 1 - feeRate;

  // No active liquidity (or a degenerate quote): fall back to the flat mark.
  if (liquidity <= 0n || sqrtPriceX96 <= 0n || absPerpDelta === 0n) {
    const usd = (absPerpDelta * BigInt(Math.round(markPrice * 1e6))) / 1_000_000n;
    const effectiveUsd = applyFeeToUsd(usd, isLong, feeScaled);
    return {
      usdDelta: isLong ? -usd : usd,
      fillPrice: markPrice,
      feeRate,
      effectiveUsdDelta: isLong ? -effectiveUsd : effectiveUsd,
      effectiveFillPrice: markPrice * feeMultiplier,
      exceedsLiquidity: liquidity <= 0n && absPerpDelta > 0n,
      liquidityLimited: false,
    };
  }

  // Long buys perp -> token0 leaves the pool -> add = false (price rises).
  // Short sells perp -> token0 enters the pool -> add = true (price falls).
  const add = !isLong;

  // Capacity of the constant-liquidity region when removing token0 (long):
  // amount0 < liquidity * Q96 / sqrtPriceX96. Beyond that the region is dry.
  if (!add) {
    const maxAmount0 = (liquidity << 96n) / sqrtPriceX96;
    if (absPerpDelta >= maxAmount0) {
      const infUsd = 1n << 255n;
      return {
        usdDelta: isLong ? -infUsd : infUsd,
        fillPrice: Number.POSITIVE_INFINITY,
        feeRate,
        effectiveUsdDelta: isLong ? -infUsd : infUsd,
        effectiveFillPrice: Number.POSITIVE_INFINITY,
        exceedsLiquidity: true,
        liquidityLimited: true,
      };
    }
  }

  const nextSqrtX96 = getNextSqrtPriceFromAmount0(sqrtPriceX96, liquidity, absPerpDelta, add);
  const usd = getAmount1Delta(sqrtPriceX96, nextSqrtX96, liquidity);
  // fillPrice = usd / perp; both legs are 6-dp so the scale cancels.
  const fillPrice = Number(usd) / Number(absPerpDelta);
  const effectiveUsd = applyFeeToUsd(usd, isLong, feeScaled);

  // Single-region reliability signal: how far this swap moved the pool price.
  // A large move almost certainly crossed an initialized tick, so the constant-
  // liquidity walk understates the true impact.
  const sqrtMoveFraction = Math.abs(Number(nextSqrtX96 - sqrtPriceX96)) / Number(sqrtPriceX96);

  return {
    usdDelta: isLong ? -usd : usd,
    fillPrice,
    feeRate,
    effectiveUsdDelta: isLong ? -effectiveUsd : effectiveUsd,
    effectiveFillPrice: fillPrice * feeMultiplier,
    exceedsLiquidity: false,
    liquidityLimited: sqrtMoveFraction >= APPROX_TICK_CROSS_WARN_FRACTION,
  };
}
