import { Hex } from "viem";
import { publicActions } from "viem";
import { PerpCityContext } from "../context";
import { scale6Decimals, scaleFrom6Decimals } from "../utils";
import { PERP_MANAGER_ABI } from "../abis/perp-manager";
import { OpenPositionData } from "../types/entity-data";
import { LiveDetails, ClosePositionParams } from "../entities/openPosition";

// Pure functions that operate on OpenPositionData
export function getPositionPerpId(positionData: OpenPositionData): Hex {
  return positionData.perpId;
}

export function getPositionId(positionData: OpenPositionData): bigint {
  return positionData.positionId;
}

export function getPositionIsLong(positionData: OpenPositionData): boolean | undefined {
  return positionData.isLong;
}

export function getPositionIsMaker(positionData: OpenPositionData): boolean | undefined {
  return positionData.isMaker;
}

export function getPositionLiveDetails(positionData: OpenPositionData): LiveDetails {
  return positionData.liveDetails;
}

export function getPositionPnl(positionData: OpenPositionData): number {
  return positionData.liveDetails.pnl;
}

export function getPositionFundingPayment(positionData: OpenPositionData): number {
  return positionData.liveDetails.fundingPayment;
}

export function getPositionEffectiveMargin(positionData: OpenPositionData): number {
  return positionData.liveDetails.effectiveMargin;
}

export function getPositionIsLiquidatable(positionData: OpenPositionData): boolean {
  return positionData.liveDetails.isLiquidatable;
}

// Functions that require context for operations
export async function closePosition(
  context: PerpCityContext,
  perpId: Hex,
  positionId: bigint,
  params: ClosePositionParams
): Promise<OpenPositionData | null> {
  const contractParams = {
    posId: positionId,
    minAmt0Out: scale6Decimals(params.minAmt0Out),
    minAmt1Out: scale6Decimals(params.minAmt1Out),
    maxAmt1In: scale6Decimals(params.maxAmt1In),
  };
  
  const { result, request } = await context.walletClient.extend(publicActions).simulateContract({
    address: context.deployments().perpManager,
    abi: PERP_MANAGER_ABI,
    functionName: 'closePosition',
    args: [perpId, contractParams],
    account: context.walletClient.account,
  });

  await context.walletClient.writeContract(request);

  if (result === null) {
    return null;
  }

  // Return the updated position data
  return {
    perpId,
    positionId: result,
    liveDetails: await getPositionLiveDetailsFromContract(context, perpId, result),
  };
}

export async function getPositionLiveDetailsFromContract(
  context: PerpCityContext,
  perpId: Hex,
  positionId: bigint
): Promise<LiveDetails> {
  const { result } = await context.walletClient.simulateContract({
    address: context.deployments().perpManager,
    abi: PERP_MANAGER_ABI,
    functionName: 'livePositionDetails',
    args: [perpId, positionId],
    account: context.walletClient.account,
  });

  return {
    pnl: scaleFrom6Decimals(Number(result[0])),
    fundingPayment: scaleFrom6Decimals(Number(result[1])),
    effectiveMargin: scaleFrom6Decimals(Number(result[2])),
    isLiquidatable: result[3],
  };
}
