import { Q96 } from "./constants";

/**
 * Exact bigint port of the Uniswap v4 `SqrtPriceMath` / `SwapMath` primitives
 * needed to walk a perp pool's curve.
 *
 * Only the token0-specified paths are ported, because a taker order always
 * fixes the perp leg (token0) and lets the pool settle the USD leg (token1):
 * a long is an exact-output-token0 swap, a short an exact-input-token0 swap.
 * Perp pools are created with `fee: 0` (fees are charged by the perp itself and
 * donated back), so every function here is the zero-fee specialisation.
 */

const UINT256_MAX = (1n << 256n) - 1n;

export function mulDivRoundingUp(a: bigint, b: bigint, denominator: bigint): bigint {
  const product = a * b;
  const result = product / denominator;
  return product % denominator === 0n ? result : result + 1n;
}

function divRoundingUp(a: bigint, b: bigint): bigint {
  return a % b === 0n ? a / b : a / b + 1n;
}

/**
 * `SqrtPriceMath.getAmount0Delta` — the token0 between two prices at a given
 * liquidity. `roundUp` when the amount is owed to the pool (an input).
 */
export function getAmount0Delta(
  sqrtPriceAX96: bigint,
  sqrtPriceBX96: bigint,
  liquidity: bigint,
  roundUp: boolean
): bigint {
  const [lower, upper] =
    sqrtPriceAX96 > sqrtPriceBX96 ? [sqrtPriceBX96, sqrtPriceAX96] : [sqrtPriceAX96, sqrtPriceBX96];
  const numerator1 = liquidity << 96n;
  const numerator2 = upper - lower;

  return roundUp
    ? divRoundingUp(mulDivRoundingUp(numerator1, numerator2, upper), lower)
    : (numerator1 * numerator2) / upper / lower;
}

/**
 * `SqrtPriceMath.getAmount1Delta` — the token1 (USD) between two prices at a
 * given liquidity. `roundUp` when the amount is owed to the pool (an input).
 */
export function getAmount1Delta(
  sqrtPriceAX96: bigint,
  sqrtPriceBX96: bigint,
  liquidity: bigint,
  roundUp: boolean
): bigint {
  const [lower, upper] =
    sqrtPriceAX96 > sqrtPriceBX96 ? [sqrtPriceBX96, sqrtPriceAX96] : [sqrtPriceAX96, sqrtPriceBX96];

  return roundUp
    ? mulDivRoundingUp(liquidity, upper - lower, Q96)
    : (liquidity * (upper - lower)) / Q96;
}

/**
 * `SqrtPriceMath.getNextSqrtPriceFromAmount0RoundingUp`.
 * `add` = token0 flows into the pool (a short; price falls).
 * `!add` = token0 leaves the pool (a long; price rises).
 */
export function getNextSqrtPriceFromAmount0(
  sqrtPriceX96: bigint,
  liquidity: bigint,
  amount0: bigint,
  add: boolean
): bigint {
  if (amount0 === 0n) return sqrtPriceX96;
  const numerator1 = liquidity << 96n;
  const product = amount0 * sqrtPriceX96;

  if (add) {
    // Solidity falls back to the less precise form on uint256 overflow; mirror
    // that boundary so a pathological input can never silently diverge.
    if (product <= UINT256_MAX && numerator1 + product <= UINT256_MAX) {
      return mulDivRoundingUp(numerator1, sqrtPriceX96, numerator1 + product);
    }
    return divRoundingUp(numerator1, numerator1 / sqrtPriceX96 + amount0);
  }

  if (product >= numerator1) {
    throw new Error("getNextSqrtPriceFromAmount0: amount0 exhausts the liquidity region");
  }
  return mulDivRoundingUp(numerator1, sqrtPriceX96, numerator1 - product);
}

export type SwapStep = {
  /** Pool price after this step. Equals the target when the step reached it. */
  sqrtPriceNextX96: bigint;
  /** Token0 (perp) moved by this step. */
  amount0: bigint;
  /** Token1 (USD) moved by this step: paid in for a long, received for a short. */
  amount1: bigint;
};

/**
 * `SwapMath.computeSwapStep` with `feePips = 0`, for a token0-denominated swap.
 *
 * Steps the price from `sqrtPriceCurrentX96` toward `sqrtPriceTargetX96`,
 * consuming at most `remainingToken0`. Reaching the target means the step was
 * liquidity-bound and the caller should cross the tick and continue; stopping
 * short means the order was filled.
 *
 * A zero-liquidity region moves the price straight to the target for no amount,
 * exactly as the pool does.
 */
export function computeSwapStepToken0(opts: {
  sqrtPriceCurrentX96: bigint;
  sqrtPriceTargetX96: bigint;
  liquidity: bigint;
  remainingToken0: bigint;
  /** True for a long (exact token0 out); false for a short (exact token0 in). */
  exactOutput: boolean;
}): SwapStep {
  const { sqrtPriceCurrentX96, sqrtPriceTargetX96, liquidity, remainingToken0, exactOutput } = opts;

  if (exactOutput) {
    const maxAmount0 = getAmount0Delta(sqrtPriceCurrentX96, sqrtPriceTargetX96, liquidity, false);
    const reachesTarget = remainingToken0 >= maxAmount0;
    const sqrtPriceNextX96 = reachesTarget
      ? sqrtPriceTargetX96
      : getNextSqrtPriceFromAmount0(sqrtPriceCurrentX96, liquidity, remainingToken0, false);

    return {
      sqrtPriceNextX96,
      amount0: reachesTarget ? maxAmount0 : remainingToken0,
      amount1: getAmount1Delta(sqrtPriceCurrentX96, sqrtPriceNextX96, liquidity, true),
    };
  }

  const maxAmount0 = getAmount0Delta(sqrtPriceTargetX96, sqrtPriceCurrentX96, liquidity, true);
  const reachesTarget = remainingToken0 >= maxAmount0;
  const sqrtPriceNextX96 = reachesTarget
    ? sqrtPriceTargetX96
    : getNextSqrtPriceFromAmount0(sqrtPriceCurrentX96, liquidity, remainingToken0, true);

  return {
    sqrtPriceNextX96,
    amount0: reachesTarget ? maxAmount0 : remainingToken0,
    amount1: getAmount1Delta(sqrtPriceNextX96, sqrtPriceCurrentX96, liquidity, false),
  };
}
