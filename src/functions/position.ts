import { decodeErrorResult, decodeEventLog, formatUnits, type Hex } from "viem";
import { PERP_MANAGER_ABI } from "../abis/perp-manager";
import type { PerpCityContext } from "../context";
import type {
  ClosePositionParams,
  ClosePositionResult,
  LiveDetails,
  OpenPositionData,
  PositionRawData,
  QuoteClosePositionResult,
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

export async function quoteClosePosition(
  context: PerpCityContext,
  positionId: bigint
): Promise<QuoteClosePositionResult> {
  return withErrorHandling(async () => {
    const result = await context.publicClient.readContract({
      address: context.deployments().perpManager,
      abi: PERP_MANAGER_ABI,
      functionName: "quoteClosePosition" as "positions",
      args: [positionId],
    });

    const [unexpectedReason, pnl, funding, netMargin, wasLiquidated] =
      result as unknown as readonly [Hex, bigint, bigint, bigint, boolean];

    if (unexpectedReason && unexpectedReason !== "0x") {
      let errorName = "Quote simulation failed";
      try {
        const decoded = decodeErrorResult({
          abi: PERP_MANAGER_ABI,
          data: unexpectedReason,
        });
        errorName = decoded.errorName;
      } catch {
        // Could not decode, use generic name
      }
      throw new Error(errorName);
    }

    return {
      pnl: Number(formatUnits(pnl, 6)),
      funding: -Number(formatUnits(funding, 6)),
      netMargin: Number(formatUnits(netMargin, 6)),
      wasLiquidated,
    };
  }, `quoteClosePosition for position ${positionId}`);
}

export async function closePositionWithQuote(
  context: PerpCityContext,
  _perpId: Hex,
  positionId: bigint,
  slippageTolerance: number = 0.01
): Promise<ClosePositionResult> {
  return withErrorHandling(async () => {
    // Read position to determine if it's a maker position
    const rawData = await context.getPositionRawData(positionId);
    const isMaker = rawData.makerDetails !== null;

    const result = await context.publicClient.readContract({
      address: context.deployments().perpManager,
      abi: PERP_MANAGER_ABI,
      functionName: "quoteClosePosition" as "positions",
      args: [positionId],
    });

    const [unexpectedReason] = result as unknown as readonly [Hex, bigint, bigint, bigint, boolean];

    if (unexpectedReason && unexpectedReason !== "0x") {
      throw new Error("Quote failed — position may be invalid or already closed");
    }

    let contractParams = {
      posId: positionId,
      minAmt0Out: 0n,
      minAmt1Out: 0n,
      maxAmt1In: 0n,
    };

    const canonicalPerpId = rawData.perpId;

    if (!isMaker) {
      // Compute notional at current price for slippage limits.
      // The contract checks minAmt1Out/maxAmt1In against raw swap USD deltas,
      // not netMargin. The swap amount ≈ positionSize * markPrice.
      const perpData = await context.getPerpData(canonicalPerpId);
      const absPerpDelta =
        rawData.entryPerpDelta < 0n ? -rawData.entryPerpDelta : rawData.entryPerpDelta;
      const positionSize = Number(absPerpDelta);
      const notionalAtClose = BigInt(Math.floor(positionSize * perpData.mark));
      const isLong = rawData.entryPerpDelta > 0n;

      const slippageBps = BigInt(Math.ceil(slippageTolerance * 10000));

      if (isLong) {
        // Long close: swap perps → USD. Contract checks min USD out.
        contractParams = {
          posId: positionId,
          minAmt0Out: 0n,
          minAmt1Out: notionalAtClose - (notionalAtClose * slippageBps) / 10000n,
          maxAmt1In: 0n,
        };
      } else {
        // Short close: swap USD → perps. Contract checks max USD in.
        contractParams = {
          posId: positionId,
          minAmt0Out: 0n,
          minAmt1Out: 0n,
          maxAmt1In: notionalAtClose + (notionalAtClose * slippageBps) / 10000n,
        };
      }
    }

    const { request } = await context.publicClient.simulateContract({
      address: context.deployments().perpManager,
      abi: PERP_MANAGER_ABI,
      functionName: "closePosition",
      args: [contractParams],
      account: context.walletClient.account,
      gas: 500000n,
    });

    const txHash = await context.walletClient.writeContract(request);
    const receipt = await context.publicClient.waitForTransactionReceipt({
      hash: txHash,
    });

    if (receipt.status === "reverted") {
      throw new Error(`Transaction reverted. Hash: ${txHash}`);
    }

    let newPositionId: bigint | null = null;
    for (const log of receipt.logs) {
      try {
        const decoded = decodeEventLog({
          abi: PERP_MANAGER_ABI,
          data: log.data,
          topics: log.topics,
          eventName: "PositionOpened",
        });
        const eventPerpId = (decoded.args.perpId as string).toLowerCase();
        const eventPosId = decoded.args.posId as bigint;
        if (eventPerpId === canonicalPerpId.toLowerCase() && eventPosId !== positionId) {
          newPositionId = eventPosId;
          break;
        }
      } catch (_e) {}
    }

    if (!newPositionId) {
      return { position: null, txHash };
    }

    return {
      position: {
        perpId: canonicalPerpId,
        positionId: newPositionId,
        liveDetails: await getPositionLiveDetailsFromContract(
          context,
          canonicalPerpId,
          newPositionId
        ),
      },
      txHash,
    };
  }, `closePositionWithQuote for position ${positionId}`);
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

    const { request } = await context.publicClient.simulateContract({
      address: context.deployments().perpManager,
      abi: PERP_MANAGER_ABI,
      functionName: "closePosition",
      args: [contractParams],
      account: context.walletClient.account,
      gas: 500000n, // Provide explicit gas limit to avoid estimation issues
    });

    const txHash = await context.walletClient.writeContract(request);

    // Wait for transaction confirmation
    const receipt = await context.publicClient.waitForTransactionReceipt({
      hash: txHash,
    });

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

        // Match the perpId (case-insensitive) and extract the new position ID
        // For partial closes, a NEW position is created with a DIFFERENT posId
        const eventPerpId = (decoded.args.perpId as string).toLowerCase();
        const eventPosId = decoded.args.posId as bigint;

        if (eventPerpId === perpId.toLowerCase() && eventPosId !== positionId) {
          newPositionId = eventPosId;
          break;
        }
      } catch (_e) {}
    }

    // If no PositionOpened event found with a new posId, this was a full close - return null
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
    const result = (await context.publicClient.readContract({
      address: context.deployments().perpManager,
      abi: PERP_MANAGER_ABI,
      functionName: "quoteClosePosition" as any,
      args: [positionId],
    })) as unknown as readonly [Hex, bigint, bigint, bigint, boolean];

    // The result is a tuple: [unexpectedReason, pnl, funding, netMargin, wasLiquidated]
    const [unexpectedReason, pnl, funding, netMargin, wasLiquidated] = result;

    if (unexpectedReason !== "0x") {
      throw new Error(
        `Failed to quote position ${positionId} - position may be invalid or already closed`
      );
    }

    return {
      pnl: Number(formatUnits(pnl, 6)),
      // Negate so positive = user receives funding, matching quoteClosePosition convention
      fundingPayment: -Number(formatUnits(funding, 6)),
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
 * Liquidation occurs when: effectiveMargin / positionValue <= liqMarginRatio
 * For longs: liqPrice = entryPrice - (margin - liqRatio * entryNotional) / size
 * For shorts: liqPrice = entryPrice + (margin - liqRatio * entryNotional) / size
 *
 * @param rawData - The raw position data from the contract
 * @param isLong - Whether the position is long
 * @returns Liquidation price in USD, or null if cannot be calculated
 */
export function calculateLiquidationPrice(
  rawData: PositionRawData,
  isLong: boolean
): number | null {
  const entryPrice = calculateEntryPrice(rawData);
  const positionSize = Math.abs(calculatePositionSize(rawData));

  if (positionSize === 0 || rawData.margin <= 0) {
    return null;
  }

  // Liquidation margin ratio is scaled by 1e6, convert to decimal
  const liqMarginRatio = rawData.marginRatios.liq / 1e6;

  // Entry notional value
  const entryNotional = positionSize * entryPrice;

  // Calculate price move that would trigger liquidation
  // At liquidation: margin + pnl = liqMarginRatio * notional
  // For long: margin + (liqPrice - entryPrice) * size = liqMarginRatio * liqPrice * size
  // Solving: liqPrice = (margin + entryPrice * size) / (size * (1 + liqMarginRatio))
  // Simplified: liqPrice = entryPrice - (margin - liqMarginRatio * entryNotional) / size

  if (isLong) {
    // For longs, liquidation happens when price drops
    const liqPrice = entryPrice - (rawData.margin - liqMarginRatio * entryNotional) / positionSize;
    return Math.max(0, liqPrice);
  } else {
    // For shorts, liquidation happens when price rises
    const liqPrice = entryPrice + (rawData.margin - liqMarginRatio * entryNotional) / positionSize;
    return liqPrice;
  }
}

export function calculatePnlPercentage(pnl: number, funding: number, margin: number): number {
  const totalPnl = pnl + funding;
  const initialMargin = margin - totalPnl;
  if (initialMargin <= 0) return 0;
  return (totalPnl / initialMargin) * 100;
}

/**
 * Calculates ClosePositionParams for a position close, handling the difference
 * between taker and maker positions.
 *
 * For taker positions, the contract checks minAmt1Out (for longs) or maxAmt1In
 * (for shorts) against the raw USD swap delta — NOT netMargin. The swap amount
 * corresponds to the position's notional value at current price, so slippage
 * limits must be based on `notional`, not `expectedReturn`.
 *
 * For maker positions, the contract checks minAmt0Out and minAmt1Out against
 * the raw token amounts from Uniswap liquidity removal. The split between
 * perp tokens and USDC depends on where the current price sits in the LP range,
 * and quoteClosePosition only returns the aggregate netMargin. Since we cannot
 * predict the individual token amounts, both minimums are set to 0.
 */
export function calculateClosePositionParams(opts: {
  isMaker: boolean;
  isLong?: boolean;
  notional: number;
  slippagePercent: number;
}): ClosePositionParams {
  if (opts.isMaker) {
    return { minAmt0Out: 0, minAmt1Out: 0, maxAmt1In: 0 };
  }

  if (typeof opts.isLong !== "boolean") {
    throw new Error("isLong must be explicitly set for taker positions");
  }

  const absNotional = Math.abs(opts.notional);

  if (opts.isLong) {
    // Long close: swap perps → USD. Contract checks minAmt1Out (min USD out).
    return {
      minAmt0Out: 0,
      minAmt1Out: Math.max(0, absNotional * (1 - opts.slippagePercent / 100)),
      maxAmt1In: 0,
    };
  } else {
    // Short close: swap USD → perps. Contract checks maxAmt1In (max USD in).
    return {
      minAmt0Out: 0,
      minAmt1Out: 0,
      maxAmt1In: absNotional * (1 + opts.slippagePercent / 100),
    };
  }
}
