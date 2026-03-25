import { Q96 } from "./constants";

const PRECISION = 10n ** 18n;

/**
 * Convert a funding diff (over `interval` seconds) to a percentage for `period` seconds.
 * Defers the interval division until after scaling to avoid truncating small differentials.
 */
export function convertFundingDiffX96ToPercentPerPeriod(
  fundingDiffX96: bigint,
  interval: bigint,
  periodSeconds: bigint
): number {
  // rate = (diff / interval) * period = (diff * period) / interval
  // Scale by PRECISION before dividing by Q96 and interval to preserve precision.
  const scaledRate = (fundingDiffX96 * periodSeconds * PRECISION) / (Q96 * interval);
  return Number(scaledRate) / Number(PRECISION);
}

export function convertFundingPerSecondX96ToPercentPerMinute(fundingPerSecondX96: bigint): number {
  const SECONDS_PER_MINUTE = 60n;
  const scaledRate = (fundingPerSecondX96 * SECONDS_PER_MINUTE * PRECISION) / Q96;
  return Number(scaledRate) / Number(PRECISION);
}

export function convertFundingPerSecondX96ToPercentPerDay(fundingPerSecondX96: bigint): number {
  const SECONDS_PER_DAY = 86400n;
  const scaledRate = (fundingPerSecondX96 * SECONDS_PER_DAY * PRECISION) / Q96;
  return Number(scaledRate) / Number(PRECISION);
}
