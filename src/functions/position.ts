import { decodeEventLog, formatUnits, type Hex, publicActions } from "viem";
import { PERP_MANAGER_ABI } from "../abis/perp-manager";
import type { PerpCityContext } from "../context";
import type {
  ClosePositionParams,
  ClosePositionResult,
  LiveDetails,
  OpenPositionData,
  PositionRawData,
} from "../types/entity-data";
import { scale6Decimals } from "../utils";
import { withErrorHandling } from "../utils/errors";

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
): Promise<ClosePositionResult> {
  return withErrorHandling(async () => {
    const contractParams = {
      posId: positionId,
      minAmt0Out: scale6Decimals(params.minAmt0Out),
      minAmt1Out: scale6Decimals(params.minAmt1Out),
      maxAmt1In: scale6Decimals(params.maxAmt1In),
    };

    const { request } = await context.walletClient.extend(publicActions).simulateContract({
      address: context.deployments().perpManager,
      abi: PERP_MANAGER_ABI,
      functionName: "closePosition",
      args: [contractParams],
      account: context.walletClient.account,
      gas: 500000n, // Provide explicit gas limit to avoid estimation issues
    });

    const txHash = await context.walletClient.writeContract(request);

    // Wait for transaction confirmation
    const publicClient = context.walletClient.extend(publicActions);
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

    // Check if transaction was successful
    if (receipt.status === "reverted") {
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
          eventName: "PositionOpened",
        });

        // Match the perpId and extract the new position ID
        if (decoded.args.perpId === perpId) {
          newPositionId = decoded.args.posId as bigint;
          break;
        }
      } catch (_e) {}
    }

    // If no PositionOpened event found, this was a full close - return null
    if (!newPositionId) {
      return { position: null, txHash };
    }

    // Return the updated position data with actual on-chain position ID
    return {
      position: {
        perpId,
        positionId: newPositionId,
        liveDetails: await getPositionLiveDetailsFromContract(context, perpId, newPositionId),
      },
      txHash,
    };
  }, `closePosition for position ${positionId}`);
}

export async function getPositionLiveDetailsFromContract(
  context: PerpCityContext,
  _perpId: Hex,
  positionId: bigint
): Promise<LiveDetails> {
  return withErrorHandling(async () => {
    // Use quoteClosePosition which provides live position details
    const result = (await context.walletClient.readContract({
      address: context.deployments().perpManager,
      abi: PERP_MANAGER_ABI,
      functionName: "quoteClosePosition" as any,
      args: [positionId],
    })) as unknown as readonly [boolean, bigint, bigint, bigint, boolean];

    // The result is a tuple: [success, pnl, funding, netMargin, wasLiquidated]
    const [success, pnl, funding, netMargin, wasLiquidated] = result;

    if (!success) {
      throw new Error(
        `Failed to quote position ${positionId} - position may be invalid or already closed`
      );
    }

    return {
      pnl: Number(formatUnits(pnl, 6)),
      fundingPayment: Number(formatUnits(funding, 6)),
      effectiveMargin: Number(formatUnits(netMargin, 6)),
      isLiquidatable: wasLiquidated,
    };
  }, `getPositionLiveDetailsFromContract for position ${positionId}`);
}

// Pure calculation functions for position metrics

/**
 * Calculate the entry price from raw position data
 * Entry price = abs(entryUsdDelta) / abs(entryPerpDelta)
 * @param rawData - The raw position data from the contract
 * @returns Entry price in USD
 */
export function calculateEntryPrice(rawData: PositionRawData): number {
  const perpDelta = rawData.entryPerpDelta;
  const usdDelta = rawData.entryUsdDelta;

  // Handle edge case where position size is zero
  if (perpDelta === 0n) {
    return 0;
  }

  // Both values are in scaled format (6 decimals each)
  // entryUsdDelta is scaled by 1e6, entryPerpDelta is scaled by 1e6
  // Price = USD / Perp = (usdDelta / 1e6) / (perpDelta / 1e6) = usdDelta / perpDelta
  const absPerpDelta = perpDelta < 0n ? -perpDelta : perpDelta;
  const absUsdDelta = usdDelta < 0n ? -usdDelta : usdDelta;

  // Since both are scaled by 1e6, they cancel out
  return Number(absUsdDelta) / Number(absPerpDelta);
}

/**
 * Calculate the position size (in perp units)
 * @param rawData - The raw position data from the contract
 * @returns Position size (positive for long, negative for short)
 */
export function calculatePositionSize(rawData: PositionRawData): number {
  // entryPerpDelta is scaled by 1e6
  return Number(rawData.entryPerpDelta) / 1e6;
}

/**
 * Calculate the current position value at a given mark price
 * Position value = abs(size) * markPrice
 * @param rawData - The raw position data from the contract
 * @param markPrice - Current mark price
 * @returns Position value in USD (always positive)
 */
export function calculatePositionValue(rawData: PositionRawData, markPrice: number): number {
  const size = calculatePositionSize(rawData);
  return Math.abs(size) * markPrice;
}

/**
 * Calculate the current leverage of a position
 * Leverage = positionValue / effectiveMargin
 * @param positionValue - Current position value in USD
 * @param effectiveMargin - Current effective margin in USD
 * @returns Leverage multiplier
 */
export function calculateLeverage(positionValue: number, effectiveMargin: number): number {
  if (effectiveMargin <= 0) {
    return Infinity;
  }
  return positionValue / effectiveMargin;
}

/**
 * Calculate the liquidation price for a position
 * Liquidation occurs when: effectiveMargin / positionValue <= minMarginRatio
 * For longs: liqPrice = entryPrice * (1 - (margin - fees) / positionValue * (1 - minRatio))
 * For shorts: liqPrice = entryPrice * (1 + (margin - fees) / positionValue * (1 - minRatio))
 *
 * Simplified approximation:
 * liquidationPrice = entryPrice * (1 +/- margin / notional * (1 - 1/maxLeverage))
 *
 * @param rawData - The raw position data from the contract
 * @param markPrice - Current mark price (used for current notional)
 * @param isLong - Whether the position is long
 * @returns Liquidation price in USD, or null if cannot be calculated
 */
export function calculateLiquidationPrice(
  rawData: PositionRawData,
  _markPrice: number,
  isLong: boolean
): number | null {
  const entryPrice = calculateEntryPrice(rawData);
  const positionSize = Math.abs(calculatePositionSize(rawData));

  if (positionSize === 0 || rawData.margin <= 0) {
    return null;
  }

  // Min margin ratio is scaled by 1e6, convert to decimal
  const minMarginRatio = rawData.marginRatios.min / 1e6;

  // Entry notional value
  const entryNotional = positionSize * entryPrice;

  // Calculate price move that would trigger liquidation
  // At liquidation: margin + pnl = minMarginRatio * notional
  // For long: margin + (liqPrice - entryPrice) * size = minMarginRatio * liqPrice * size
  // Solving: liqPrice = (margin + entryPrice * size) / (size * (1 + minMarginRatio))
  // Simplified: liqPrice = entryPrice - (margin - minMarginRatio * entryNotional) / size

  if (isLong) {
    // For longs, liquidation happens when price drops
    const liqPrice = entryPrice - (rawData.margin - minMarginRatio * entryNotional) / positionSize;
    return Math.max(0, liqPrice);
  } else {
    // For shorts, liquidation happens when price rises
    const liqPrice = entryPrice + (rawData.margin - minMarginRatio * entryNotional) / positionSize;
    return liqPrice;
  }
}
