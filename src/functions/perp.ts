import type { Hex } from "viem";
import { BEACON_ABI } from "../abis/beacon";
import { PERP_MANAGER_ABI } from "../abis/perp-manager";
import type { PerpCityContext } from "../context";
import type { PerpData } from "../types/entity-data";
import { withErrorHandling } from "../utils/errors";
import {
  convertFundingPerSecondX96ToPercentPerDay,
  convertFundingPerSecondX96ToPercentPerMinute,
} from "../utils/funding";

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
  perpId: Hex
): Promise<{ ratePerDay: number; ratePerMinute: number; rawX96: bigint }> {
  return withErrorHandling(async () => {
    const fundingX96 = (await context.publicClient.readContract({
      address: context.deployments().perpManager,
      abi: PERP_MANAGER_ABI,
      functionName: "fundingPerSecondX96",
      args: [perpId],
    })) as bigint;

    return {
      ratePerDay: convertFundingPerSecondX96ToPercentPerDay(fundingX96),
      ratePerMinute: convertFundingPerSecondX96ToPercentPerMinute(fundingX96),
      rawX96: fundingX96,
    };
  }, `getFundingRate for perp ${perpId}`);
}

export async function getIndexValue(context: PerpCityContext, perpId: Hex): Promise<bigint> {
  return withErrorHandling(async () => {
    const perpData = await context.getPerpData(perpId);
    return (await context.publicClient.readContract({
      address: perpData.beacon,
      abi: BEACON_ABI,
      functionName: "index",
    })) as bigint;
  }, `getIndexValue for perp ${perpId}`);
}

export async function getIndexTWAP(
  context: PerpCityContext,
  perpId: Hex,
  secondsAgo: number
): Promise<bigint> {
  return withErrorHandling(async () => {
    const perpData = await context.getPerpData(perpId);
    return (await context.publicClient.readContract({
      address: perpData.beacon,
      abi: BEACON_ABI,
      functionName: "twAvg",
      args: [secondsAgo],
    })) as bigint;
  }, `getIndexTWAP for perp ${perpId}`);
}
