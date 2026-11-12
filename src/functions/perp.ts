import { BEACON_ABI } from "../abis/beacon";
import type { PerpCityContext } from "../context";
import type { PerpAddress } from "../types";
import type { PerpData } from "../types/entity-data";
import { scaleFromX96 } from "../utils/conversions";
import { withErrorHandling } from "../utils/errors";
import { readRates } from "./views";

export function getPerpBeacon(perpData: PerpData): string {
  return perpData.beacon;
}

export function getPerpFees(perpData: PerpData) {
  return perpData.fees;
}

export function getPerpTickSpacing(perpData: PerpData): number {
  return perpData.tickSpacing;
}

export type FundingRate = {
  /** Funding paid per 1 perp per day, in USD (longs pay when positive). */
  fundingPerDayUsd: number;
  /** Funding per day as a fraction of the cached mark (0.001 = 0.1%/day). */
  ratePerDay: number;
  /** Raw `Rates.fundingPerDay`: int88, USD per perp per day scaled by 1e18. */
  fundingPerDayRaw: bigint;
  /** Unix time the cached rate started to apply (`Rates.lastTouch`). */
  lastTouch: number;
};

/** Pure conversion from `Rates.fundingPerDay` (WAD) to a daily fraction of `markPrice`. */
export function fundingRateFromRaw(
  fundingPerDayRaw: bigint,
  markPrice: number
): { fundingPerDayUsd: number; ratePerDay: number } {
  const fundingPerDayUsd = Number(fundingPerDayRaw) / 1e18;
  return {
    fundingPerDayUsd,
    ratePerDay: markPrice > 0 ? fundingPerDayUsd / markPrice : 0,
  };
}

/**
 * The perp's cached funding rate (`rates()`), as a fraction of the mark cached
 * at the same touch (`rates().lastMark`). Both refresh on every market touch.
 */
export async function getFundingRate(
  context: PerpCityContext,
  perpAddress: PerpAddress
): Promise<FundingRate> {
  return withErrorHandling(async () => {
    const rates = await readRates(context.publicClient, perpAddress);
    return {
      ...fundingRateFromRaw(rates.fundingPerDay, scaleFromX96(rates.lastMark)),
      fundingPerDayRaw: rates.fundingPerDay,
      lastTouch: rates.lastTouch,
    };
  }, `getFundingRate for perp ${perpAddress}`);
}

/** The v1 beacon's `index()`: the Q96 index and its on-chain update time. */
export async function getBeaconIndex(
  context: PerpCityContext,
  perpAddress: PerpAddress
): Promise<{ indexX96: bigint; updatedAt: bigint }> {
  return withErrorHandling(async () => {
    const { beacon } = await context.getPerpConfig(perpAddress);
    const [indexX96, updatedAt] = await context.publicClient.readContract({
      address: beacon,
      abi: BEACON_ABI,
      functionName: "index",
    });
    return { indexX96, updatedAt };
  }, `getBeaconIndex for perp ${perpAddress}`);
}

/** The Q96 beacon index (`getBeaconIndex(...).indexX96`). */
export async function getIndexValue(
  context: PerpCityContext,
  perpAddress: PerpAddress
): Promise<bigint> {
  return (await getBeaconIndex(context, perpAddress)).indexX96;
}

export async function getIndexTWAP(
  context: PerpCityContext,
  perpAddress: PerpAddress,
  secondsAgo: number
): Promise<bigint> {
  return withErrorHandling(async () => {
    const { beacon } = await context.getPerpConfig(perpAddress);
    return context.publicClient.readContract({
      address: beacon,
      abi: BEACON_ABI,
      functionName: "twAvg",
      args: [secondsAgo],
    });
  }, `getIndexTWAP for perp ${perpAddress}`);
}
