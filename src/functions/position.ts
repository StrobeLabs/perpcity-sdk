import { Hex, formatUnits, decodeEventLog } from "viem";
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

    // Extract actual positionId from transaction receipt logs
    // For partial closes, a PositionOpened event is emitted with the new position ID
    // For full closes, no PositionOpened event will be present
    let newPositionId: bigint | null = null;

    for (const log of receipt.logs) {
      try {
        const decoded = decodeEventLog({
          abi: PERP_MANAGER_ABI,
          data: log.data,
          topics: log.topics,
          eventName: 'PositionOpened',
        });

        // Match the perpId and extract the new position ID
        if (decoded.args.perpId === perpId) {
          newPositionId = decoded.args.posId as bigint;
          break;
        }
      } catch (e) {
        // Skip logs that aren't PositionOpened events
        continue;
      }
    }

    // If no PositionOpened event found, this was a full close - return null
    if (!newPositionId) {
      return null;
    }

    // Return the updated position data with actual on-chain position ID
    return {
      perpId,
      positionId: newPositionId,
      liveDetails: await getPositionLiveDetailsFromContract(context, perpId, newPositionId),
    };
  }, `closePosition for position ${positionId}`);
}

export async function getPositionLiveDetailsFromContract(
  context: PerpCityContext,
  perpId: Hex,
  positionId: bigint
): Promise<LiveDetails> {
  return withErrorHandling(async () => {
    // livePositionDetails is marked nonpayable in ABI but can be called read-only
    const result = (await context.walletClient.readContract({
      address: context.deployments().perpManager,
      abi: PERP_MANAGER_ABI,
      functionName: 'livePositionDetails' as any,
      args: [perpId, positionId],
    }) as unknown) as readonly [bigint, bigint, bigint, boolean, bigint];

    // Use formatUnits to safely convert bigint to decimal string, then parse to number
    // The result is a tuple: [pnl, fundingPayment, effectiveMargin, isLiquidatable, newPriceX96]
    return {
      pnl: Number(formatUnits(result[0], 6)),
      fundingPayment: Number(formatUnits(result[1], 6)),
      effectiveMargin: Number(formatUnits(result[2], 6)),
      isLiquidatable: result[3],
    };
  }, `getPositionLiveDetailsFromContract for position ${positionId}`);
}
