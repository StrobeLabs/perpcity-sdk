import type { PerpBuild } from "../utils/build";
import { getSqrtPriceAtTick } from "../utils/tickMath";
import { BUILD_RULES } from "./buildRules";
import { type FeeRatesE6, liquidationFeeAmount, swapFees } from "./fees";
import { abs, E6, Q96, sMulDiv } from "./fixedPoint";
import { getAmountsForLiquidity } from "./liquidityAmounts";

/** `MIN_OPENING_MARGIN`: 5 USDC, both builds. */
export const MIN_OPENING_MARGIN = 5_000_000n;

/**
 * `PerpLogic.isHealthy` (both builds): equity / (value + 1) >= ratio, in 1e6
 * fixed point, with non-positive equity counting as 0.
 */
export function isHealthy(equity: bigint, value: bigint, marginRatioE6: bigint): boolean {
  const ratio = equity <= 0n ? 0n : (equity * E6) / (value + 1n);
  return ratio >= marginRatioE6;
}

export type TakerEconomicsInput = {
  build: PerpBuild;
  /** Position delta, raw micro units (perp signed: + long, - short). */
  perpDelta: bigint;
  usdDelta: bigint;
  /** Settled margin, micro-USD. */
  margin: bigint;
  /** Funding owed since last settle, micro-USD (negative = earned). See `fundingPaymentUsd`. */
  fundingOwed: bigint;
  /** Utilization fee owed since last settle, micro-USD. See `takerUtilOwed`. */
  utilOwed: bigint;
  /** Mark to value at: the fair price (see `getFairPrice`). */
  fairX96: bigint;
  /** `Position.liqMarginRatio`, 1e6-scaled (50000 = 5%). */
  liqMarginRatioE6: number;
  /** Fees module `liqFee()`, 1e6-scaled. Used on 58b42b7 only. */
  liqFeeE6: number;
  /** Swap fee rates the closing swap pays. Used on 58b42b7 only. */
  closeFeeRates: FeeRatesE6;
  /** Realized price PnL already folded into `usdDelta` by reduces (display only). */
  realizedPnl?: bigint;
};

export type TakerEconomics = {
  /** |perpDelta| at the mark, micro-USD (`valPnl` posVal). */
  value: bigint;
  /** Price PnL of the open exposure: perp leg at mark + usdDelta - realizedPnl. */
  pnl: bigint;
  /** Margin - funding owed - util owed + perp leg at mark + usdDelta. */
  equity: bigint;
  /** value / equity; null when equity <= 0. */
  leverage: number | null;
  /** Mark at which the build's liquidation check first fails (USD per perp). */
  liquidationPrice: number | null;
  isLiquidatable: boolean;
};

/**
 * Live taker economics for the deployed builds. The liquidation check and
 * price follow the build (see `BUILD_RULES.liquidationNetsFees`):
 *
 * - v0.2.2: (margin - accrued + PnL) / value < liq ratio at the pre-swap mark.
 * - 58b42b7: the closing swap's fees and the liquidation fee come off first,
 *   and the contract values at the post-close mark. Here the close is
 *   approximated by `value` at the given mark, so a thin pool can liquidate
 *   slightly earlier than this predicts.
 */
export function takerEconomics(p: TakerEconomicsInput): TakerEconomics {
  const perpVal = sMulDiv(p.perpDelta, p.fairX96, Q96, false, p.build);
  const value = abs(perpVal);
  const settledMargin = p.margin - p.fundingOwed - p.utilOwed;
  const equity = settledMargin + perpVal + p.usdDelta;
  const liqRatio = BigInt(p.liqMarginRatioE6);

  let healthEquity = equity;
  let feeFraction = 0;
  if (BUILD_RULES[p.build].liquidationNetsFees) {
    healthEquity -= swapFees(value, p.closeFeeRates).total;
    healthEquity -= liquidationFeeAmount(value, BigInt(p.liqFeeE6));
    const r = p.closeFeeRates;
    feeFraction =
      Number(r.lpFee + r.creatorFee + r.insuranceFee + r.protocolFee + BigInt(p.liqFeeE6)) / 1e6;
  }

  return {
    value,
    pnl: perpVal + p.usdDelta - (p.realizedPnl ?? 0n),
    equity,
    leverage: equity > 0n ? Number(value) / Number(equity) : null,
    liquidationPrice: takerLiquidationPrice({
      perpDelta: p.perpDelta,
      usdDelta: p.usdDelta,
      settledMargin,
      liqRatio: p.liqMarginRatioE6 / 1e6,
      feeFraction,
    }),
    isLiquidatable: !isHealthy(healthEquity, value, liqRatio),
  };
}

/**
 * Solve margin + S*p + U - fee*|S|*p = liq*|S|*p for p, in human units:
 * p = (M + U) / ((liq + fee)*|S| - S). Clamped at 0; null with no exposure.
 */
function takerLiquidationPrice(p: {
  perpDelta: bigint;
  usdDelta: bigint;
  settledMargin: bigint;
  liqRatio: number;
  feeFraction: number;
}): number | null {
  if (p.perpDelta === 0n) return null;
  const size = Number(p.perpDelta) / 1e6;
  const denominator = (p.liqRatio + p.feeFraction) * Math.abs(size) - size;
  if (denominator === 0) return null;
  const price = (Number(p.settledMargin) / 1e6 + Number(p.usdDelta) / 1e6) / denominator;
  return Math.max(0, price);
}

/**
 * A maker's in-pool liquidity value, micro-USD: the range amounts split at the
 * POOL sqrt price, the perp leg valued at the fair mark (`valPnl` liquidityVal,
 * `fullMulDivN(perps, mark, 96) + usd`).
 */
export function makerPoolValue(p: {
  liquidity: bigint;
  tickLower: number;
  tickUpper: number;
  sqrtPriceX96: bigint;
  fairX96: bigint;
}): bigint {
  if (p.liquidity <= 0n) return 0n;
  const { amount0, amount1 } = getAmountsForLiquidity(
    p.sqrtPriceX96,
    getSqrtPriceAtTick(p.tickLower),
    getSqrtPriceAtTick(p.tickUpper),
    p.liquidity
  );
  return (amount0 * p.fairX96) / Q96 + amount1;
}

/**
 * Highest leverage the open check accepts after fees and price impact.
 * Open check (both builds): (margin - fees + PnL) / value >= init ratio.
 * With margin = value / L, fees = feeRate * value and PnL ~= -impact * value:
 * L_max = 1 / (initRatio + feeRate + impact), floored to 0.1. A favourable
 * (negative) impact is not counted.
 */
export function maxOpenLeverage(p: {
  initRatio: number;
  /** Total taker fee rate incl. protocol fee (fraction). */
  feeRate: number;
  /** (fill - mark) / mark against the trader (fraction). */
  priceImpact: number;
}): number {
  const denominator = p.initRatio + p.feeRate + Math.max(0, p.priceImpact);
  if (!(denominator > 0) || !Number.isFinite(denominator)) return 0;
  return Math.floor((1 / denominator) * 10 + 1e-9) / 10;
}

/**
 * The 5 USDC opening minimum: on the deposit (58b42b7 :256), and on v0.2.2
 * also after the open's swap fees (:391).
 */
export function meetsMinOpeningMargin(p: {
  build: PerpBuild;
  /** Deposit, micro-USD. */
  margin: bigint;
  /** Swap fees of the open, micro-USD. */
  fees: bigint;
}): boolean {
  if (p.margin < MIN_OPENING_MARGIN) return false;
  return !BUILD_RULES[p.build].minMarginAfterFees || p.margin - p.fees >= MIN_OPENING_MARGIN;
}
