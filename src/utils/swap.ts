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
 * *understates* the true impact). `exceedsLiquidity` is set when the order is
 * larger than the entire constant-liquidity region can fill — a strong signal
 * the real swap would revert with `PriceImpactTooHigh`.
 *
 * Fees are NOT modeled here; the caller's slippage tolerance is expected to
 * absorb them.
 */
export type SimulatedTakerSwap = {
  /** Signed USD delta in 6-dp contract units (negative for longs). */
  usdDelta: bigint;
  /** Average fill price (USD per perp), including price impact. */
  fillPrice: number;
  /** True when the order exceeds the constant-liquidity region's capacity. */
  exceedsLiquidity: boolean;
};

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
 * Simulate an exact-perp-in taker swap against constant active liquidity.
 *
 * @param sqrtPriceX96 - Current pool sqrt price (X96), from `poolState`.
 * @param liquidity - Current active liquidity, from `poolState`.
 * @param perpDelta - Signed perp leg in 6-dp units (positive long, negative short).
 * @param markPrice - Current mark price, used for the exhausted-liquidity fallback.
 */
export function simulateTakerSwap(opts: {
  sqrtPriceX96: bigint;
  liquidity: bigint;
  perpDelta: bigint;
  markPrice: number;
}): SimulatedTakerSwap {
  const { sqrtPriceX96, liquidity, perpDelta, markPrice } = opts;
  const isLong = perpDelta > 0n;
  const absPerpDelta = perpDelta < 0n ? -perpDelta : perpDelta;

  // No active liquidity (or a degenerate quote): fall back to the flat mark.
  if (liquidity <= 0n || sqrtPriceX96 <= 0n || absPerpDelta === 0n) {
    const usd = (absPerpDelta * BigInt(Math.round(markPrice * 1e6))) / 1_000_000n;
    return {
      usdDelta: isLong ? -usd : usd,
      fillPrice: markPrice,
      exceedsLiquidity: liquidity <= 0n && absPerpDelta > 0n,
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
      return {
        usdDelta: isLong ? -(1n << 255n) : 1n << 255n,
        fillPrice: Number.POSITIVE_INFINITY,
        exceedsLiquidity: true,
      };
    }
  }

  const nextSqrtX96 = getNextSqrtPriceFromAmount0(sqrtPriceX96, liquidity, absPerpDelta, add);
  const usd = getAmount1Delta(sqrtPriceX96, nextSqrtX96, liquidity);
  // fillPrice = usd / perp; both legs are 6-dp so the scale cancels.
  const fillPrice = Number(usd) / Number(absPerpDelta);

  return {
    usdDelta: isLong ? -usd : usd,
    fillPrice,
    exceedsLiquidity: false,
  };
}
