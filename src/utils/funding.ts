import { Q96 } from "./constants";

const PRECISION = 10n ** 18n;

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
