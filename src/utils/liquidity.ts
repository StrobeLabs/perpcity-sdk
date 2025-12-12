import type { PerpCityContext } from "../context";
import { sqrtPriceX96ToPrice, tickToPrice } from "./conversions";

/**
 * Calculate liquidity from USDC amount (amount1) using Uniswap v3 formula
 * liquidity = amount1 / (sqrt(priceUpper) - sqrt(priceLower))
 *
 * This replicates the estimateLiquidityForAmount1 function that existed in older contracts
 * but is not present in the deployed contracts.
 */
export async function estimateLiquidity(
  _context: PerpCityContext,
  tickLower: number,
  tickUpper: number,
  usdScaled: bigint
): Promise<bigint> {
  // Validate inputs
  if (tickLower >= tickUpper) {
    throw new Error(
      `Invalid tick range: tickLower (${tickLower}) must be less than tickUpper (${tickUpper})`
    );
  }

  if (usdScaled === 0n) {
    return 0n;
  }

  // Calculate sqrt prices from ticks using Uniswap v3 formula
  // sqrtPriceX96 = sqrt(1.0001^tick) * 2^96
  const Q96 = 1n << 96n;

  const sqrtPriceLowerX96 = getSqrtRatioAtTick(tickLower);
  const sqrtPriceUpperX96 = getSqrtRatioAtTick(tickUpper);

  // Calculate liquidity using the formula:
  // L = amount1 / (sqrtPriceUpper - sqrtPriceLower) * Q96
  const sqrtPriceDiff = sqrtPriceUpperX96 - sqrtPriceLowerX96;

  if (sqrtPriceDiff === 0n) {
    throw new Error(
      `Division by zero: sqrtPriceDiff is 0 for ticks ${tickLower} to ${tickUpper}. sqrtLower=${sqrtPriceLowerX96}, sqrtUpper=${sqrtPriceUpperX96}`
    );
  }

  const liquidity = (usdScaled * Q96) / sqrtPriceDiff;

  return liquidity;
}

/**
 * Get sqrt price at tick using Uniswap v3 formula
 * sqrtPriceX96 = sqrt(1.0001^tick) * 2^96
 */
function getSqrtRatioAtTick(tick: number): bigint {
  const absTick = Math.abs(tick);

  let ratio = absTick & 0x1 ? 0xfffcb933bd6fad37aa2d162d1a594001n : 0x100000000000000000000000000000000n;
  if (absTick & 0x2) ratio = (ratio * 0xfff97272373d413259a46990580e213an) >> 128n;
  if (absTick & 0x4) ratio = (ratio * 0xfff2e50f5f656932ef12357cf3c7fdccn) >> 128n;
  if (absTick & 0x8) ratio = (ratio * 0xffe5caca7e10e4e61c3624eaa0941cd0n) >> 128n;
  if (absTick & 0x10) ratio = (ratio * 0xffcb9843d60f6159c9db58835c926644n) >> 128n;
  if (absTick & 0x20) ratio = (ratio * 0xff973b41fa98c081472e6896dfb254c0n) >> 128n
  if (absTick & 0x40) ratio = (ratio * 0xff2ea16466c96a3843ec78b326b52861n) >> 128n;
  if (absTick & 0x80) ratio = (ratio * 0xfe5dee046a99a2a811c461f1969c3053n) >> 128n;
  if (absTick & 0x100) ratio = (ratio * 0xfcbe86c7900a88aedcffc83b479aa3a4n) >> 128n;
  if (absTick & 0x200) ratio = (ratio * 0xf987a7253ac413176f2b074cf7815e54n) >> 128n;
  if (absTick & 0x400) ratio = (ratio * 0xf3392b0822b70005940c7a398e4b70f3n) >> 128n;
  if (absTick & 0x800) ratio = (ratio * 0xe7159475a2c29b7443b29c7fa6e889d9n) >> 128n;
  if (absTick & 0x1000) ratio = (ratio * 0xd097f3bdfd2022b8845ad8f792aa5825n) >> 128n;
  if (absTick & 0x2000) ratio = (ratio * 0xa9f746462d870fdf8a65dc1f90e061e5n) >> 128n;
  if (absTick & 0x4000) ratio = (ratio * 0x70d869a156d2a1b890bb3df62baf32f7n) >> 128n;
  if (absTick & 0x8000) ratio = (ratio * 0x31be135f97d08fd981231505542fcfa6n) >> 128n;
  if (absTick & 0x10000) ratio = (ratio * 0x9aa508b5b7a84e1c677de54f3e99bc9n) >> 128n;
  if (absTick & 0x20000) ratio = (ratio * 0x5d6af8dedb81196699c329225ee604n) >> 128n;
  if (absTick & 0x40000) ratio = (ratio * 0x2216e584f5fa1ea926041bedfe98n) >> 128n;
  if (absTick & 0x80000) ratio = (ratio * 0x48a170391f7dc42444e8fa2n) >> 128n;

  if (tick > 0) ratio = (1n << 256n) / ratio;
  return ratio >> 32n;
}

/**
 * Calculate liquidity amount to achieve a target margin ratio for a maker position.
 *
 * For a Uniswap v3 style maker position:
 * - Margin ratio = margin / total_debt
 * - Total debt = USD value of LP exposure at current price
 *
 * When price P is within range [pL, pU]:
 * - amount0 = liquidity * (1/sqrt(P) - 1/sqrt(pU))
 * - amount1 = liquidity * (sqrt(P) - sqrt(pL))
 * - total_debt = amount0 * P + amount1 (in USD terms)
 *
 * @param marginScaled - Margin in scaled units (6 decimals)
 * @param tickLower - Lower tick of the range
 * @param tickUpper - Upper tick of the range
 * @param currentSqrtPriceX96 - Current sqrt price in Q96 format
 * @param targetMarginRatio - Target margin ratio (e.g., 1.2 for 120%)
 * @returns Liquidity amount as bigint
 */
export function calculateLiquidityForTargetRatio(
  marginScaled: bigint,
  tickLower: number,
  tickUpper: number,
  currentSqrtPriceX96: bigint,
  targetMarginRatio: number
): bigint {
  // Validate inputs
  if (tickLower >= tickUpper) {
    throw new Error(
      `Invalid tick range: tickLower (${tickLower}) must be less than tickUpper (${tickUpper})`
    );
  }

  if (marginScaled === 0n) {
    return 0n;
  }

  if (targetMarginRatio <= 0) {
    throw new Error(`Invalid target margin ratio: ${targetMarginRatio} must be positive`);
  }

  // Get prices from ticks
  const priceLower = tickToPrice(tickLower);
  const priceUpper = tickToPrice(tickUpper);

  // Current price from sqrtPriceX96
  const currentPrice = sqrtPriceX96ToPrice(currentSqrtPriceX96);

  // Calculate sqrt prices
  const sqrtCurrentPrice = Math.sqrt(currentPrice);
  const sqrtPriceLower = Math.sqrt(priceLower);
  const sqrtPriceUpper = Math.sqrt(priceUpper);

  // Debt per unit liquidity (in USD terms)
  // When price is within range:
  // amount0_per_L = (1/sqrtP - 1/sqrtPU) [perp tokens per unit liquidity]
  // amount1_per_L = (sqrtP - sqrtPL) [USD per unit liquidity]
  // debt_per_L = amount0_per_L * P + amount1_per_L [total USD value per unit liquidity]
  let debtPerL: number;

  if (currentPrice <= priceLower) {
    // Price below range: only token0 exposure
    // amount0_per_L = (1/sqrtPL - 1/sqrtPU)
    const amount0PerL = 1 / sqrtPriceLower - 1 / sqrtPriceUpper;
    debtPerL = amount0PerL * currentPrice;
  } else if (currentPrice >= priceUpper) {
    // Price above range: only token1 exposure
    // amount1_per_L = (sqrtPU - sqrtPL)
    debtPerL = sqrtPriceUpper - sqrtPriceLower;
  } else {
    // Price within range: both token0 and token1 exposure
    const amount0PerL = 1 / sqrtCurrentPrice - 1 / sqrtPriceUpper;
    const amount1PerL = sqrtCurrentPrice - sqrtPriceLower;
    debtPerL = amount0PerL * currentPrice + amount1PerL;
  }

  if (debtPerL <= 0) {
    throw new Error("Calculated debt per unit liquidity is zero or negative");
  }

  // Target debt = margin / targetRatio
  const margin = Number(marginScaled) / 1e6;
  const targetDebt = margin / targetMarginRatio;

  // Liquidity = targetDebt / debtPerL
  const liquidity = targetDebt / debtPerL;

  if (liquidity <= 0) {
    throw new Error("Calculated liquidity is zero or negative");
  }

  return BigInt(Math.floor(liquidity));
}
