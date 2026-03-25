import type { Hex } from "viem";
import { BEACON_ABI } from "../abis/beacon";
import { PERP_MANAGER_ABI } from "../abis/perp-manager";
import type { PerpCityContext } from "../context";
import type { PerpData } from "../types/entity-data";
import { Q96 } from "../utils/constants";
import { withErrorHandling } from "../utils/errors";
import {
  convertFundingPerSecondX96ToPercentPerDay,
  convertFundingPerSecondX96ToPercentPerMinute,
} from "../utils/funding";

const TWAVG_WINDOW = 3600; // 1 hour, matches Constants.sol TWAVG_WINDOW
const INTERVAL = 86400n; // 1 day in seconds, matches Constants.sol INTERVAL

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
    const perpManagerAddr = context.deployments().perpManager;
    const cfg = await context.getPerpConfig(perpId);

    const [twAvgSqrtMarkX96, twAvgIndexX96] = await Promise.all([
      context.publicClient.readContract({
        address: perpManagerAddr,
        abi: PERP_MANAGER_ABI,
        functionName: "timeWeightedAvgSqrtPriceX96",
        args: [perpId, TWAVG_WINDOW],
      }) as Promise<bigint>,
      context.publicClient.readContract({
        address: cfg.beacon,
        abi: BEACON_ABI,
        functionName: "twAvg",
        args: [TWAVG_WINDOW],
      }) as Promise<bigint>,
    ]);

    const twAvgMarkX96 = (twAvgSqrtMarkX96 * twAvgSqrtMarkX96) / Q96;
    const fundingPerSecondX96 = (twAvgMarkX96 - twAvgIndexX96) / INTERVAL;

    return {
      ratePerDay: convertFundingPerSecondX96ToPercentPerDay(fundingPerSecondX96),
      ratePerMinute: convertFundingPerSecondX96ToPercentPerMinute(fundingPerSecondX96),
      rawX96: fundingPerSecondX96,
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
