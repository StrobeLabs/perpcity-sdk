import type { PerpBuild } from "../utils/build";
import { abs, mulDivUp, Q96, sMulDiv } from "./fixedPoint";

/**
 * Funding rate per day as a fraction of the EMA mark: `Rates.fundingPerDay`
 * (int88, USD per 1 perp per day, WAD) over the EMA AMM price.
 */
export function fundingRatePerDay(fundingPerDayWad: bigint, emaAmmX96: bigint): number {
  if (emaAmmX96 <= 0n) return 0;
  return Number(fundingPerDayWad) / 1e18 / (Number(emaAmmX96) / Number(Q96));
}

/**
 * Funding a taker owes since its last settle (micro-USD; negative = earned):
 * `perpDelta.sFullMulDiv(cumlNow - cumlLast, Q96, true)` (`takerFeesAccrued`).
 */
export function fundingPaymentUsd(
  perpDelta: bigint,
  cumlNowX96: bigint,
  cumlLastX96: bigint,
  build: PerpBuild
): bigint {
  return sMulDiv(perpDelta, cumlNowX96 - cumlLastX96, Q96, true, build);
}

/**
 * Utilization fee a taker owes since its last settle (micro-USD, >= 0):
 * `|perpDelta|.fullMulDivUp(paymentsNow - paymentsLast, Q96)` on its side.
 */
export function takerUtilOwed(p: {
  perpDelta: bigint;
  longUtilPaymentsX96: bigint;
  shortUtilPaymentsX96: bigint;
  lastLongUtilPaymentsX96: bigint;
  lastShortUtilPaymentsX96: bigint;
}): bigint {
  if (p.perpDelta > 0n) {
    return mulDivUp(abs(p.perpDelta), p.longUtilPaymentsX96 - p.lastLongUtilPaymentsX96, Q96);
  }
  if (p.perpDelta < 0n) {
    return mulDivUp(abs(p.perpDelta), p.shortUtilPaymentsX96 - p.lastShortUtilPaymentsX96, Q96);
  }
  return 0n;
}
