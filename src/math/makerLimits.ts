import { getAmount0Delta, getAmount1Delta } from "../utils/swapMath";
import { getSqrtPriceAtTick } from "../utils/tickMath";
import { E6, mulDiv, mulDivUp } from "./fixedPoint";

export type MakerLimits = {
  /** Perp (amount0) limit, raw micro units. */
  amt0Limit: bigint;
  /** USD (amount1) limit, raw micro units. */
  amt1Limit: bigint;
};

/**
 * `amt0Limit` / `amt1Limit` for `openMaker` / `adjustMaker`, from the amounts
 * the pool moves for `liquidityDelta` at `sqrtPriceX96`.
 *
 * `PerpLogic.checkMakerAmountLimits` (both builds): an add (liquidityDelta > 0)
 * reverts `MaxAmtExceeded` when either |amount| is ABOVE its limit, so the
 * limits are maximums (amounts rounded up as the pool charges them, plus
 * slippage). A remove (< 0) reverts `MinAmtUnmet` when either is BELOW its
 * limit, so the limits are minimums (rounded down, less slippage); 0 accepts
 * any amount. A zero delta checks nothing.
 */
export function makerLimits(p: {
  liquidityDelta: bigint;
  sqrtPriceX96: bigint;
  tickLower: number;
  tickUpper: number;
  /** Fraction, e.g. 0.01 = 1%. */
  slippage: number;
}): MakerLimits {
  if (p.liquidityDelta === 0n) return { amt0Limit: 0n, amt1Limit: 0n };
  if (!Number.isFinite(p.slippage) || p.slippage < 0 || p.slippage >= 1) {
    throw new Error("slippage must be a fraction in [0, 1)");
  }

  const adding = p.liquidityDelta > 0n;
  const liquidity = adding ? p.liquidityDelta : -p.liquidityDelta;
  const sqrtLower = getSqrtPriceAtTick(p.tickLower);
  const sqrtUpper = getSqrtPriceAtTick(p.tickUpper);

  let amount0 = 0n;
  let amount1 = 0n;
  if (p.sqrtPriceX96 < sqrtLower) {
    amount0 = getAmount0Delta(sqrtLower, sqrtUpper, liquidity, adding);
  } else if (p.sqrtPriceX96 < sqrtUpper) {
    amount0 = getAmount0Delta(p.sqrtPriceX96, sqrtUpper, liquidity, adding);
    amount1 = getAmount1Delta(sqrtLower, p.sqrtPriceX96, liquidity, adding);
  } else {
    amount1 = getAmount1Delta(sqrtLower, sqrtUpper, liquidity, adding);
  }

  const slip = BigInt(Math.round(p.slippage * 1e6));
  if (adding) {
    return {
      amt0Limit: mulDivUp(amount0, E6 + slip, E6),
      amt1Limit: mulDivUp(amount1, E6 + slip, E6),
    };
  }
  return {
    amt0Limit: mulDiv(amount0, E6 - slip, E6),
    amt1Limit: mulDiv(amount1, E6 - slip, E6),
  };
}
