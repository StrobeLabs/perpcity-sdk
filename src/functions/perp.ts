import { BEACON_ABI } from "../abis/beacon";
import { PERP_ABI } from "../abis/perp";
import type { PerpCityContext } from "../context";
import type { PerpAddress } from "../types";
import type { PerpData } from "../types/entity-data";
import { scaleFromX96 } from "../utils/conversions";
import { isMissingViewError, withErrorHandling } from "../utils/errors";

// Pure functions that operate on PerpData
export function getPerpMark(perpData: PerpData): number {
  return perpData.mark;
}

export function getPerpBeacon(perpData: PerpData): string {
  return perpData.beacon;
}

export function getPerpBounds(perpData: PerpData) {
  return perpData.bounds;
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
  /** Funding per day as a fraction of the EMA mark (0.001 = 0.1%/day). */
  ratePerDay: number;
  /** Mark used to turn USD into a fraction: the EMA AMM price, or spot when
   * the perp has no `emas()` view (v0.2.2-upgradeable). */
  ratePriceBasis: "ema" | "spot";
  /** Raw Rates.fundingPerDay: int88, USD per perp per day scaled by 1e18. */
  fundingPerDayRaw: bigint;
};

/**
 * Pure conversion from the on-chain Rates.fundingPerDay (WAD, USD per perp
 * per day) to a funding rate per day as a fraction of `markPrice`.
 */
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
 * Read the perp's current funding rate.
 *
 * Breaking in 0.18.0: the old `ratePerDay` was USD per perp per day times 100
 * (labelled as a percent). It is now `fundingPerDayUsd` (USD per 1 perp per
 * day) and `ratePerDay` (fraction of the EMA mark).
 */
export async function getFundingRate(
  context: PerpCityContext,
  perpAddress: PerpAddress
): Promise<FundingRate> {
  return withErrorHandling(async () => {
    const [rates, emas, poolState] = await Promise.all([
      context.publicClient.readContract({
        address: perpAddress,
        abi: PERP_ABI,
        functionName: "rates",
      }),
      // 58b42b7 exposes emas(); v0.2.2-upgradeable has no view and reverts.
      context.publicClient
        .readContract({ address: perpAddress, abi: PERP_ABI, functionName: "emas" })
        .catch((error: unknown) => {
          if (isMissingViewError(error)) return null;
          throw error;
        }),
      context.publicClient.readContract({
        address: perpAddress,
        abi: PERP_ABI,
        functionName: "poolState",
      }),
    ]);

    const emaAmmX96 = emas?.[0] ?? 0n;
    const ratePriceBasis = emaAmmX96 > 0n ? "ema" : "spot";
    const markPrice = scaleFromX96(ratePriceBasis === "ema" ? emaAmmX96 : poolState[2]);

    return {
      ...fundingRateFromRaw(rates[0], markPrice),
      ratePriceBasis,
      fundingPerDayRaw: rates[0],
    };
  }, `getFundingRate for perp ${perpAddress}`);
}

export async function getIndexValue(
  context: PerpCityContext,
  perpAddress: PerpAddress
): Promise<bigint> {
  return withErrorHandling(async () => {
    const perpData = await context.getPerpData(perpAddress);
    return (await context.publicClient.readContract({
      address: perpData.beacon,
      abi: BEACON_ABI,
      functionName: "index",
    })) as bigint;
  }, `getIndexValue for perp ${perpAddress}`);
}

export async function getIndexTWAP(
  context: PerpCityContext,
  perpAddress: PerpAddress,
  secondsAgo: number
): Promise<bigint> {
  return withErrorHandling(async () => {
    const perpData = await context.getPerpData(perpAddress);
    return (await context.publicClient.readContract({
      address: perpData.beacon,
      abi: BEACON_ABI,
      functionName: "twAvg",
      args: [secondsAgo],
    })) as bigint;
  }, `getIndexTWAP for perp ${perpAddress}`);
}
