import { BEACON_ABI } from "../abis/beacon";
import { PERP_ABI } from "../abis/perp";
import type { PerpCityContext } from "../context";
import type { PerpAddress } from "../types";
import type { PerpData } from "../types/entity-data";
import { withErrorHandling } from "../utils/errors";

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

export async function getFundingRate(
  context: PerpCityContext,
  perpAddress: PerpAddress
): Promise<{ ratePerDay: number; ratePerMinute: number; rawX96: bigint }> {
  return withErrorHandling(async () => {
    const rates = await context.publicClient.readContract({
      address: perpAddress,
      abi: PERP_ABI,
      functionName: "rates",
    });
    const ratePerDay = Number(rates[0]) / 1e18;

    return {
      ratePerDay: ratePerDay * 100,
      ratePerMinute: (ratePerDay * 100) / 1440,
      rawX96: BigInt(rates[0]),
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
