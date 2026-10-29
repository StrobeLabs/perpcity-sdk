import { Q96 } from "./fixedPoint";

/**
 * v4-core `LiquidityAmounts` (the `LiqAmts` library the perps value makers
 * and capacity with), floored like the Solidity.
 */

function ordered(a: bigint, b: bigint): [bigint, bigint] {
  return a > b ? [b, a] : [a, b];
}

export function getAmount0ForLiquidity(
  sqrtPriceAX96: bigint,
  sqrtPriceBX96: bigint,
  liquidity: bigint
): bigint {
  const [lo, hi] = ordered(sqrtPriceAX96, sqrtPriceBX96);
  return ((liquidity << 96n) * (hi - lo)) / hi / lo;
}

export function getAmount1ForLiquidity(
  sqrtPriceAX96: bigint,
  sqrtPriceBX96: bigint,
  liquidity: bigint
): bigint {
  const [lo, hi] = ordered(sqrtPriceAX96, sqrtPriceBX96);
  return (liquidity * (hi - lo)) / Q96;
}

/** Perp (amount0) and USD (amount1) held by `liquidity` at `sqrtPriceX96`. */
export function getAmountsForLiquidity(
  sqrtPriceX96: bigint,
  sqrtPriceAX96: bigint,
  sqrtPriceBX96: bigint,
  liquidity: bigint
): { amount0: bigint; amount1: bigint } {
  const [lo, hi] = ordered(sqrtPriceAX96, sqrtPriceBX96);
  if (sqrtPriceX96 <= lo)
    return { amount0: getAmount0ForLiquidity(lo, hi, liquidity), amount1: 0n };
  if (sqrtPriceX96 < hi) {
    return {
      amount0: getAmount0ForLiquidity(sqrtPriceX96, hi, liquidity),
      amount1: getAmount1ForLiquidity(lo, sqrtPriceX96, liquidity),
    };
  }
  return { amount0: 0n, amount1: getAmount1ForLiquidity(lo, hi, liquidity) };
}

/** `PerpLogic.calcCapacity`: the taker OI a range of liquidity backs per side. */
export function rangeCapacity(
  sqrtPriceX96: bigint,
  sqrtPriceLowerX96: bigint,
  sqrtPriceUpperX96: bigint,
  liquidity: bigint
): { long: bigint; short: bigint } {
  if (sqrtPriceX96 <= sqrtPriceLowerX96) {
    return {
      long: getAmount0ForLiquidity(sqrtPriceLowerX96, sqrtPriceUpperX96, liquidity),
      short: 0n,
    };
  }
  if (sqrtPriceX96 < sqrtPriceUpperX96) {
    return {
      long: getAmount0ForLiquidity(sqrtPriceX96, sqrtPriceUpperX96, liquidity),
      short: getAmount0ForLiquidity(sqrtPriceLowerX96, sqrtPriceX96, liquidity),
    };
  }
  return {
    long: 0n,
    short: getAmount0ForLiquidity(sqrtPriceLowerX96, sqrtPriceUpperX96, liquidity),
  };
}
