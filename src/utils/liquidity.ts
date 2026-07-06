import { encodeFunctionData } from "viem";
import { BEACON_ABI } from "../abis/beacon";
import { MARGIN_RATIOS_ABI } from "../abis/margin-ratios";
import { PERP_ABI } from "../abis/perp";
import type { PerpCityContext } from "../context";
import type { PerpAddress } from "../types";
import { sqrtPriceX96ToPrice, tickToPrice } from "./conversions";

const Q96 = 1n << 96n;
const E6 = 1_000_000n;
const MAX_UINT128 = (1n << 128n) - 1n;
const MAX_UINT256 = (1n << 256n) - 1n;

// openMaker pulls amounts rounded up in the pool's favor while the health
// check values the position rounded down, so equity lands up to two units
// below margin. Validated against deployed markets: the max healthy liquidity
// is exactly floor((margin - 2) * Q96 / sqrtPriceDiff) for below-range makers.
const EQUITY_ROUNDING_SLACK = 2n;

// Ranges at or straddling the current price are valued at the mark price,
// which accrues per block; leave headroom so the estimate survives until the
// transaction lands.
const PRICE_DEPENDENT_BUFFER_BPS = 10n;

const MARGIN_RATIO_TOO_LOW_SELECTOR = "b2c649db";

// The health check is the last revert before transferMargin pulls USDC from
// the sender. The probe sender has no allowance, so a healthy position
// reverts there: solady's TransferFromFailed() selector, plus the reason
// strings ERC20 implementations raise for the same failure.
const POST_MARGIN_CHECK_REVERT_MARKERS = [
  "7939f424", // solady SafeTransferLib.TransferFromFailed()
  "transfer amount exceeds",
  "allowance",
];

const BISECTION_MAX_ITERATIONS = 16;

/**
 * Calculate the maximum maker liquidity a margin deposit can collateralize
 * over a tick range, mirroring the contract's openMaker health check
 * (equity / position value >= maker initial margin ratio).
 *
 * The position value depends on where the range sits relative to the current
 * price: below the current price it is pure quote (USD) exposure, above it is
 * pure perp exposure valued at the mark price, and a straddling range is a mix.
 * The mark price blends the AMM price with the beacon index and is not
 * directly readable, so perp exposure is valued at the larger of the two and
 * the estimate is verified with an eth_call simulation of openMaker,
 * bisecting down if the contract still reports MarginRatioTooLow.
 */
export async function estimateLiquidity(
  context: PerpCityContext,
  perpAddress: PerpAddress,
  tickLower: number,
  tickUpper: number,
  usdScaled: bigint
): Promise<bigint> {
  if (tickLower >= tickUpper) {
    throw new Error(
      `Invalid tick range: tickLower (${tickLower}) must be less than tickUpper (${tickUpper})`
    );
  }

  if (usdScaled === 0n) {
    return 0n;
  }

  const cfg = await context.getPerpConfig(perpAddress);
  const [poolState, makerRatios, beaconIndex] = await Promise.all([
    context.publicClient.readContract({
      address: perpAddress,
      abi: PERP_ABI,
      functionName: "poolState",
    }),
    context.publicClient.readContract({
      address: cfg.marginRatios,
      abi: MARGIN_RATIOS_ABI,
      functionName: "makerMarginRatios",
    }),
    context.publicClient.readContract({
      address: cfg.beacon,
      abi: BEACON_ABI,
      functionName: "index",
    }),
  ]);
  const sqrtPriceX96 = poolState[1];
  const ammPriceX96 = poolState[2];
  const markPriceX96 = beaconIndex > ammPriceX96 ? beaconIndex : ammPriceX96;

  const candidate = maxLiquidityForMargin(
    usdScaled,
    getSqrtRatioAtTick(tickLower),
    getSqrtRatioAtTick(tickUpper),
    sqrtPriceX96,
    markPriceX96,
    BigInt(makerRatios[0])
  );

  if (candidate <= 0n) {
    throw new Error(
      `Margin ${usdScaled} is too small to collateralize any liquidity over ticks ${tickLower} to ${tickUpper}`
    );
  }

  if (await passesMarginCheck(context, perpAddress, tickLower, tickUpper, usdScaled, candidate)) {
    return candidate;
  }

  // The analytic estimate over-shot (e.g. the mark price sits above both the
  // AMM price and the index). Bisect between zero and the failing candidate
  // against the simulated margin check to recover the largest healthy amount.
  let lo = 0n;
  let hi = candidate;
  for (let i = 0; i < BISECTION_MAX_ITERATIONS && hi - lo > 1n + hi / 1000n; i++) {
    const mid = (lo + hi) / 2n;
    if (await passesMarginCheck(context, perpAddress, tickLower, tickUpper, usdScaled, mid)) {
      lo = mid;
    } else {
      hi = mid;
    }
  }

  if (lo <= 0n) {
    throw new Error(
      `Could not find a liquidity amount passing the maker margin check for margin ${usdScaled} over ticks ${tickLower} to ${tickUpper}`
    );
  }
  return lo;
}

function maxLiquidityForMargin(
  usdScaled: bigint,
  sqrtLowerX96: bigint,
  sqrtUpperX96: bigint,
  sqrtPriceX96: bigint,
  markPriceX96: bigint,
  makerInitRatio: bigint
): bigint {
  // Worst-case equity after the contract's rounding, spread over the margin
  // ratio to get the largest position value the margin can back.
  const equity = usdScaled - EQUITY_ROUNDING_SLACK;
  if (equity <= 0n || makerInitRatio <= 0n) {
    return 0n;
  }
  const maxPositionValue = (equity * E6) / makerInitRatio;

  if (sqrtPriceX96 >= sqrtUpperX96) {
    // Range entirely below the current price: pure USD exposure of
    // L * (sqrtUpper - sqrtLower) / Q96, independent of price movement.
    return clampUint128((maxPositionValue * Q96) / (sqrtUpperX96 - sqrtLowerX96));
  }

  const bufferedValue = (maxPositionValue * (10_000n - PRICE_DEPENDENT_BUFFER_BPS)) / 10_000n;

  if (sqrtPriceX96 <= sqrtLowerX96) {
    // Range entirely above the current price: pure perp exposure of
    // L * Q96 * (sqrtUpper - sqrtLower) / (sqrtLower * sqrtUpper), valued at mark.
    const valuePerLiquidityX96 = ceilDiv(
      (sqrtUpperX96 - sqrtLowerX96) * markPriceX96 * Q96,
      sqrtLowerX96 * sqrtUpperX96
    );
    return clampUint128((bufferedValue * Q96) / valuePerLiquidityX96);
  }

  // Straddling range: USD exposure below the current price plus perp exposure
  // above it, the latter valued at mark.
  const usdPerLiquidityX96 = sqrtPriceX96 - sqrtLowerX96;
  const perpValuePerLiquidityX96 = ceilDiv(
    (sqrtUpperX96 - sqrtPriceX96) * markPriceX96 * Q96,
    sqrtPriceX96 * sqrtUpperX96
  );
  return clampUint128((bufferedValue * Q96) / (usdPerLiquidityX96 + perpValuePerLiquidityX96));
}

/**
 * Simulate openMaker to confirm the margin health check passes. The check runs
 * before the margin transfer, so a MarginRatioTooLow revert is conclusive
 * unhealthy, while a success or the margin-transfer revert the allowance-less
 * probe sender triggers means the liquidity amount is healthy. Anything else
 * (transport failures, unrelated reverts such as misaligned ticks) is rethrown
 * rather than misread as a verdict.
 */
async function passesMarginCheck(
  context: PerpCityContext,
  perpAddress: PerpAddress,
  tickLower: number,
  tickUpper: number,
  margin: bigint,
  liquidity: bigint
): Promise<boolean> {
  const data = encodeFunctionData({
    abi: PERP_ABI,
    functionName: "openMaker",
    args: [
      {
        holder: perpAddress,
        margin,
        tickLower,
        tickUpper,
        liquidity,
        maxAmt0In: MAX_UINT256,
        maxAmt1In: MAX_UINT256,
      },
    ],
  });

  try {
    // batch: false keeps this probe out of the client's Multicall3 aggregation:
    // routing it through aggregate3 would make Multicall3 the inner msg.sender
    // (instead of the zero address), which can change which allowance-failure
    // revert the margin transfer produces and break the marker matching below.
    await context.publicClient.call({ to: perpAddress, data, batch: false });
    return true;
  } catch (error) {
    if (errorChainContains(error, MARGIN_RATIO_TOO_LOW_SELECTOR)) {
      return false;
    }
    if (POST_MARGIN_CHECK_REVERT_MARKERS.some((marker) => errorChainContains(error, marker))) {
      return true;
    }
    throw error;
  }
}

function errorChainContains(error: unknown, needle: string): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 10 && current instanceof Error; depth++) {
    const { message, data, details, cause } = current as Error & {
      data?: unknown;
      details?: unknown;
      cause?: unknown;
    };
    if (
      message.includes(needle) ||
      (typeof data === "string" && data.includes(needle)) ||
      (typeof details === "string" && details.includes(needle))
    ) {
      return true;
    }
    current = cause;
  }
  return false;
}

function ceilDiv(numerator: bigint, denominator: bigint): bigint {
  return (numerator + denominator - 1n) / denominator;
}

function clampUint128(value: bigint): bigint {
  return value > MAX_UINT128 ? MAX_UINT128 : value < 0n ? 0n : value;
}

/**
 * Get sqrt price at tick using Uniswap v4 formula
 * sqrtPriceX96 = sqrt(1.0001^tick) * 2^96
 */
function getSqrtRatioAtTick(tick: number): bigint {
  const absTick = Math.abs(tick);

  let ratio =
    absTick & 0x1 ? 0xfffcb933bd6fad37aa2d162d1a594001n : 0x100000000000000000000000000000000n;
  if (absTick & 0x2) ratio = (ratio * 0xfff97272373d413259a46990580e213an) >> 128n;
  if (absTick & 0x4) ratio = (ratio * 0xfff2e50f5f656932ef12357cf3c7fdccn) >> 128n;
  if (absTick & 0x8) ratio = (ratio * 0xffe5caca7e10e4e61c3624eaa0941cd0n) >> 128n;
  if (absTick & 0x10) ratio = (ratio * 0xffcb9843d60f6159c9db58835c926644n) >> 128n;
  if (absTick & 0x20) ratio = (ratio * 0xff973b41fa98c081472e6896dfb254c0n) >> 128n;
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

  if (tick > 0) ratio = MAX_UINT256 / ratio;
  // Round up like the contract's TickMath so amounts derived from these
  // sqrt prices match on-chain values exactly.
  return (ratio >> 32n) + (ratio % (1n << 32n) === 0n ? 0n : 1n);
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
