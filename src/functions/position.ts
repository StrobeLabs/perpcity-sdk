import { Hex, formatUnits } from "viem";
import { publicActions } from "viem";
import { PerpCityContext } from "../context";
import { scale6Decimals, scaleFrom6Decimals } from "../utils";
import { withErrorHandling } from "../utils/errors";
import { PERP_MANAGER_ABI } from "../abis/perp-manager";
import { OpenPositionData, LiveDetails, ClosePositionParams } from "../types/entity-data";

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
  return withErrorHandling(async () => {
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

    const txHash = await context.walletClient.writeContract(request);

    // Wait for transaction confirmation
    const publicClient = context.walletClient.extend(publicActions);
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

    // Check if transaction was successful
    if (receipt.status === 'reverted') {
      throw new Error(`Transaction reverted. Hash: ${txHash}`);
    }

    if (result === null) {
      return null;
    }

    // Return the updated position data
    return {
      perpId,
      positionId: result,
      liveDetails: await getPositionLiveDetailsFromContract(context, perpId, result),
    };
  }, `closePosition for position ${positionId}`);
}

export async function getPositionLiveDetailsFromContract(
  context: PerpCityContext,
  perpId: Hex,
  positionId: bigint
): Promise<LiveDetails> {
  return withErrorHandling(async () => {
    const { result } = await context.walletClient.simulateContract({
      address: context.deployments().perpManager,
      abi: PERP_MANAGER_ABI,
      functionName: 'livePositionDetails',
      args: [perpId, positionId],
      account: context.walletClient.account,
    });

    // Use formatUnits to safely convert bigint to decimal string, then parse to number
    return {
      pnl: Number(formatUnits(result[0] as bigint, 6)),
      fundingPayment: Number(formatUnits(result[1] as bigint, 6)),
      effectiveMargin: Number(formatUnits(result[2] as bigint, 6)),
      isLiquidatable: result[3] as boolean,
    };
  }, `getPositionLiveDetailsFromContract for position ${positionId}`);
}
