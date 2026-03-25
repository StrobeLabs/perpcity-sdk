import type { Address, Hex } from "viem";
import { decodeErrorResult, decodeEventLog, erc20Abi } from "viem";
import { PERP_MANAGER_ABI } from "../abis/perp-manager";
import type { PerpCityContext } from "../context";
import type {
  CreatePerpParams,
  OpenMakerPositionParams,
  OpenTakerPositionParams,
  QuoteOpenMakerPositionResult,
  QuoteTakerPositionResult,
} from "../types/entity-data";
import { MAX_TICK, MIN_TICK, NUMBER_1E6, priceToTick, scale6Decimals } from "../utils";
import { approveUsdc } from "../utils/approve";
import { withErrorHandling } from "../utils/errors";
import { OpenPosition } from "./open-position";

export async function createPerp(context: PerpCityContext, params: CreatePerpParams): Promise<Hex> {
  return withErrorHandling(async () => {
    const deployments = context.deployments();

    // Use params if provided, otherwise fall back to deployment config
    const fees = params.fees ?? deployments.feesModule;
    const marginRatios = params.marginRatios ?? deployments.marginRatiosModule;
    const lockupPeriod = params.lockupPeriod ?? deployments.lockupPeriodModule;
    const sqrtPriceImpactLimit =
      params.sqrtPriceImpactLimit ?? deployments.sqrtPriceImpactLimitModule;

    if (!fees || !marginRatios || !lockupPeriod || !sqrtPriceImpactLimit) {
      throw new Error("Module addresses must be provided either in params or deployment config");
    }

    const contractParams = {
      beacon: params.beacon,
      fees,
      marginRatios,
      lockupPeriod,
      sqrtPriceImpactLimit,
    };

    const { request } = await context.publicClient.simulateContract({
      address: context.deployments().perpManager,
      abi: PERP_MANAGER_ABI,
      functionName: "createPerp",
      args: [contractParams],
      account: context.walletClient.account,
    });

    // Execute the transaction
    const txHash = await context.walletClient.writeContract(request);

    // Wait for transaction confirmation
    const receipt = await context.publicClient.waitForTransactionReceipt({
      hash: txHash,
    });

    // Check if transaction was successful
    if (receipt.status === "reverted") {
      throw new Error(`Transaction reverted. Hash: ${txHash}`);
    }

    // Extract perpId from PerpCreated event
    for (const log of receipt.logs) {
      try {
        const decoded = decodeEventLog({
          abi: PERP_MANAGER_ABI,
          data: log.data,
          topics: log.topics,
          eventName: "PerpCreated",
        });

        // Return the perpId from the event
        return decoded.args.perpId as Hex;
      } catch (_e) {}
    }

    throw new Error("PerpCreated event not found in transaction receipt");
  }, "createPerp");
}

export async function openTakerPosition(
  context: PerpCityContext,
  perpId: Hex,
  params: OpenTakerPositionParams
): Promise<OpenPosition> {
  return withErrorHandling(async () => {
    // Validate inputs
    if (params.margin <= 0) {
      throw new Error("Margin must be greater than 0");
    }
    if (params.leverage <= 0) {
      throw new Error("Leverage must be greater than 0");
    }

    // Convert margin to 6-decimal scaled bigint
    const marginScaled = scale6Decimals(params.margin);

    // Calculate margin ratio by inverting leverage
    const marginRatio = Math.floor(NUMBER_1E6 / params.leverage);

    // Calculate total approval amount: margin + fees
    // Fees are percentages of notional (= margin * leverage)
    const perpData = await context.getPerpData(perpId);
    const { creatorFee, insuranceFee, lpFee } = perpData.fees;

    const protocolFeeRaw = await context.publicClient.readContract({
      address: context.deployments().perpManager,
      abi: PERP_MANAGER_ABI,
      functionName: "protocolFee",
    });
    const protocolFeeRate = Number(protocolFeeRaw) / NUMBER_1E6;

    const notional = (marginScaled * BigInt(NUMBER_1E6)) / BigInt(marginRatio);
    const totalFeeRate = creatorFee + insuranceFee + lpFee + protocolFeeRate;
    const totalFees = BigInt(Math.ceil(Number(notional) * totalFeeRate));

    const requiredAmount = marginScaled + totalFees;
    const currentAllowance = await context.publicClient.readContract({
      address: context.deployments().usdc,
      abi: erc20Abi,
      functionName: "allowance",
      args: [context.walletClient.account!.address, context.deployments().perpManager],
      blockTag: "latest",
    });
    if (currentAllowance < requiredAmount) {
      await approveUsdc(context, requiredAmount);
    }

    // Handle unspecifiedAmountLimit - can be number (human units) or bigint (raw value)
    const unspecifiedAmountLimit =
      typeof params.unspecifiedAmountLimit === "bigint"
        ? params.unspecifiedAmountLimit
        : scale6Decimals(params.unspecifiedAmountLimit);

    // Prepare contract parameters - deployed contract requires holder address
    const contractParams = {
      holder: context.walletClient.account!.address,
      isLong: params.isLong,
      margin: marginScaled,
      marginRatio: marginRatio,
      unspecifiedAmountLimit,
    };

    // Simulate transaction - deployed contract uses openTakerPos
    const { request } = await context.publicClient.simulateContract({
      address: context.deployments().perpManager,
      abi: PERP_MANAGER_ABI,
      functionName: "openTakerPos" as any,
      args: [perpId, contractParams],
      account: context.walletClient.account,
    });

    // Execute transaction
    const txHash = await context.walletClient.writeContract(request);

    // Wait for confirmation
    const receipt = await context.publicClient.waitForTransactionReceipt({
      hash: txHash,
    });

    // Verify success
    if (receipt.status === "reverted") {
      throw new Error(`Transaction reverted. Hash: ${txHash}`);
    }

    // Extract takerPosId from PositionOpened event
    let takerPosId: bigint | null = null;

    for (const log of receipt.logs) {
      try {
        // Don't specify eventName - let viem auto-detect from ABI
        const decoded = decodeEventLog({
          abi: PERP_MANAGER_ABI,
          data: log.data,
          topics: log.topics,
        });

        // Check if this is a PositionOpened event for our perpId and it's a taker
        // Note: perpId from events is lowercased, so normalize both for comparison
        if (
          decoded.eventName === "PositionOpened" &&
          (decoded.args.perpId as string).toLowerCase() === perpId.toLowerCase() &&
          !decoded.args.isMaker
        ) {
          takerPosId = decoded.args.posId as bigint;
          break;
        }
      } catch (_e) {}
    }

    if (!takerPosId) {
      throw new Error(`PositionOpened event not found in transaction receipt. Hash: ${txHash}`);
    }

    // Return OpenPosition instance with transaction hash
    return new OpenPosition(context, perpId, takerPosId, params.isLong, false, txHash);
  }, "openTakerPosition");
}

function buildMakerContractParams(
  context: PerpCityContext,
  marginScaled: bigint,
  params: OpenMakerPositionParams,
  alignedTickLower: number,
  alignedTickUpper: number,
  maxAmt0In: bigint,
  maxAmt1In: bigint
) {
  return {
    holder: context.walletClient.account!.address,
    margin: marginScaled,
    liquidity: params.liquidity,
    tickLower: alignedTickLower,
    tickUpper: alignedTickUpper,
    maxAmt0In,
    maxAmt1In,
  };
}

export function calculateAlignedTicks(
  priceLower: number,
  priceUpper: number,
  tickSpacing: number
): { alignedTickLower: number; alignedTickUpper: number } {
  const tickLower = priceToTick(priceLower, true);
  const tickUpper = priceToTick(priceUpper, false);

  const alignedTickLower = Math.floor(tickLower / tickSpacing) * tickSpacing;
  const alignedTickUpper = Math.ceil(tickUpper / tickSpacing) * tickSpacing;

  if (alignedTickLower < MIN_TICK) {
    throw new Error(
      `Lower tick ${alignedTickLower} is below MIN_TICK (${MIN_TICK}). Increase priceLower.`
    );
  }
  if (alignedTickUpper > MAX_TICK) {
    throw new Error(
      `Upper tick ${alignedTickUpper} exceeds MAX_TICK (${MAX_TICK}). Decrease priceUpper.`
    );
  }
  if (alignedTickLower === alignedTickUpper) {
    throw new Error(
      "Price range too narrow: lower and upper ticks are equal after alignment. Widen the range."
    );
  }

  return { alignedTickLower, alignedTickUpper };
}

function alignMakerTicks(
  params: OpenMakerPositionParams,
  tickSpacing: number
): { alignedTickLower: number; alignedTickUpper: number } {
  return calculateAlignedTicks(params.priceLower, params.priceUpper, tickSpacing);
}

export const DEFAULT_MAKER_SLIPPAGE_TOLERANCE = 0.01;
export const MAX_UINT128 = 2n ** 128n - 1n;

export async function quoteOpenMakerPosition(
  context: PerpCityContext,
  perpId: Hex,
  params: OpenMakerPositionParams
): Promise<QuoteOpenMakerPositionResult> {
  return withErrorHandling(async () => {
    if (params.margin <= 0) {
      throw new Error("Margin must be greater than 0");
    }
    if (params.priceLower >= params.priceUpper) {
      throw new Error("priceLower must be less than priceUpper");
    }

    const marginScaled = scale6Decimals(params.margin);
    const perpData = await context.getPerpData(perpId);
    const { alignedTickLower, alignedTickUpper } = alignMakerTicks(params, perpData.tickSpacing);

    const contractParams = buildMakerContractParams(
      context,
      marginScaled,
      params,
      alignedTickLower,
      alignedTickUpper,
      MAX_UINT128,
      MAX_UINT128
    );

    const [unexpectedReason, perpDelta, usdDelta] = (await context.publicClient.readContract({
      address: context.deployments().perpManager,
      abi: PERP_MANAGER_ABI,
      functionName: "quoteOpenMakerPosition" as any,
      args: [perpId, contractParams] as any,
    })) as unknown as readonly [string, bigint, bigint];

    if (unexpectedReason !== "0x") {
      throw new Error(`Quote failed: ${unexpectedReason}`);
    }

    return { perpDelta, usdDelta };
  }, "quoteOpenMakerPosition");
}

/**
 * Computes maxAmtIn slippage limit from a quote delta.
 *
 * When delta < 0 (tokens need to go in), applies slippage tolerance to the
 * absolute amount. When delta >= 0 (quote says no tokens needed), uses
 * `fallbackRef` as a reference to compute a small buffer — this prevents
 * reverts when price moves between quote and execution, shifting the token
 * split so some amount of this token is now required.
 */
export function applySlippage(
  delta: bigint,
  slippageTolerance: number,
  fallbackRef?: bigint
): bigint {
  const slippageBps = BigInt(Math.ceil(slippageTolerance * 10000));

  if (delta < 0n) {
    const absDelta = -delta;
    return absDelta + (absDelta * slippageBps) / 10000n;
  }

  // delta >= 0: quote says no tokens sent in, but price may move.
  // Use a fraction of the fallback reference as a buffer.
  if (fallbackRef !== undefined && fallbackRef !== 0n) {
    const absRef = fallbackRef < 0n ? -fallbackRef : fallbackRef;
    return (absRef * slippageBps) / 10000n;
  }

  return 0n;
}

export async function openMakerPosition(
  context: PerpCityContext,
  perpId: Hex,
  params: OpenMakerPositionParams
): Promise<OpenPosition> {
  return withErrorHandling(async () => {
    if (params.margin <= 0) {
      throw new Error("Margin must be greater than 0");
    }
    if (params.priceLower >= params.priceUpper) {
      throw new Error("priceLower must be less than priceUpper");
    }

    const marginScaled = scale6Decimals(params.margin);
    const perpData = await context.getPerpData(perpId);
    const { alignedTickLower, alignedTickUpper } = alignMakerTicks(params, perpData.tickSpacing);

    let maxAmt0In: bigint;
    let maxAmt1In: bigint;

    if ((params.maxAmt0In === undefined) !== (params.maxAmt1In === undefined)) {
      throw new Error(
        "Both maxAmt0In and maxAmt1In must be provided together or neither. " +
          "Omit both to use automatic quote-based slippage calculation."
      );
    }

    if (params.maxAmt0In !== undefined && params.maxAmt1In !== undefined) {
      maxAmt0In =
        typeof params.maxAmt0In === "bigint" ? params.maxAmt0In : scale6Decimals(params.maxAmt0In);
      maxAmt1In =
        typeof params.maxAmt1In === "bigint" ? params.maxAmt1In : scale6Decimals(params.maxAmt1In);
    } else {
      const quote = await quoteOpenMakerPosition(context, perpId, params);
      const slippage = params.slippageTolerance ?? DEFAULT_MAKER_SLIPPAGE_TOLERANCE;
      // Pass the other delta as fallback: if one token has delta >= 0 (not needed),
      // use the other token's delta to compute a small buffer for price movement.
      maxAmt0In = applySlippage(quote.perpDelta, slippage, quote.usdDelta);
      maxAmt1In = applySlippage(quote.usdDelta, slippage, quote.perpDelta);
    }

    // Approve USDC spending only if current allowance is insufficient
    // maxAmt1In is a slippage limit, not the actual amount needed
    // For positions below current price, only margin is deposited
    const currentAllowance = await context.publicClient.readContract({
      address: context.deployments().usdc,
      abi: erc20Abi,
      functionName: "allowance",
      args: [context.walletClient.account!.address, context.deployments().perpManager],
      blockTag: "latest",
    });
    if (currentAllowance < marginScaled) {
      await approveUsdc(context, marginScaled);
    }

    const contractParams = buildMakerContractParams(
      context,
      marginScaled,
      params,
      alignedTickLower,
      alignedTickUpper,
      maxAmt0In,
      maxAmt1In
    );

    const { request } = await context.publicClient.simulateContract({
      address: context.deployments().perpManager,
      abi: PERP_MANAGER_ABI,
      functionName: "openMakerPos" as any,
      args: [perpId, contractParams],
      account: context.walletClient.account,
    });

    const txHash = await context.walletClient.writeContract(request);
    const receipt = await context.publicClient.waitForTransactionReceipt({
      hash: txHash,
    });

    if (receipt.status === "reverted") {
      throw new Error(`Transaction reverted. Hash: ${txHash}`);
    }

    let makerPosId: bigint | null = null;

    for (const log of receipt.logs) {
      try {
        const decoded = decodeEventLog({
          abi: PERP_MANAGER_ABI,
          data: log.data,
          topics: log.topics,
        });

        if (
          decoded.eventName === "PositionOpened" &&
          (decoded.args.perpId as string).toLowerCase() === perpId.toLowerCase() &&
          decoded.args.isMaker
        ) {
          makerPosId = decoded.args.posId as bigint;
          break;
        }
      } catch (_e) {}
    }

    if (!makerPosId) {
      throw new Error(`PositionOpened event not found in transaction receipt. Hash: ${txHash}`);
    }

    return new OpenPosition(context, perpId, makerPosId, undefined, true, txHash);
  }, "openMakerPosition");
}

export async function quoteTakerPosition(
  context: PerpCityContext,
  perpId: Hex,
  params: {
    holder: Address;
    isLong: boolean;
    margin: number;
    leverage: number;
  }
): Promise<QuoteTakerPositionResult> {
  return withErrorHandling(async () => {
    const marginScaled = scale6Decimals(params.margin);
    const marginRatio = Math.floor(NUMBER_1E6 / params.leverage);

    const result = await context.publicClient.simulateContract({
      address: context.deployments().perpManager,
      abi: PERP_MANAGER_ABI,
      functionName: "quoteOpenTakerPosition" as any,
      args: [
        perpId,
        {
          holder: params.holder,
          isLong: params.isLong,
          margin: marginScaled,
          marginRatio,
          unspecifiedAmountLimit: params.isLong ? 0n : (1n << 128n) - 1n,
        },
      ] as any,
      account: params.holder,
    });

    const [unexpectedReason, perpDelta, usdDelta] = result.result as unknown as readonly [
      Hex,
      bigint,
      bigint,
    ];

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

    const absPerpDelta = perpDelta < 0n ? -perpDelta : perpDelta;
    const absUsdDelta = usdDelta < 0n ? -usdDelta : usdDelta;

    if (absPerpDelta === 0n) {
      throw new Error("Zero position size");
    }

    const fillPrice = Number(absUsdDelta) / Number(absPerpDelta);

    return { perpDelta, usdDelta, fillPrice };
  }, "quoteTakerPosition");
}

export async function adjustMargin(
  context: PerpCityContext,
  positionId: bigint,
  marginDelta: bigint
): Promise<{ txHash: Hex }> {
  return withErrorHandling(async () => {
    const deployments = context.deployments();

    if (marginDelta > 0n) {
      const currentAllowance = await context.publicClient.readContract({
        address: deployments.usdc,
        abi: erc20Abi,
        functionName: "allowance",
        args: [context.walletClient.account!.address, deployments.perpManager],
        blockTag: "latest",
      });
      if (currentAllowance < marginDelta) {
        await approveUsdc(context, marginDelta);
      }
    }

    const { request } = await context.publicClient.simulateContract({
      address: deployments.perpManager,
      abi: PERP_MANAGER_ABI,
      functionName: "adjustMargin",
      args: [{ posId: positionId, marginDelta }],
      account: context.walletClient.account,
    });

    const txHash = await context.walletClient.writeContract(request);

    return { txHash };
  }, `adjustMargin for position ${positionId}`);
}

export async function adjustNotional(
  context: PerpCityContext,
  positionId: bigint,
  usdDelta: bigint,
  perpLimit: bigint
): Promise<{ txHash: Hex }> {
  return withErrorHandling(async () => {
    const deployments = context.deployments();

    if (usdDelta > 0n) {
      const currentAllowance = await context.publicClient.readContract({
        address: deployments.usdc,
        abi: erc20Abi,
        functionName: "allowance",
        args: [context.walletClient.account!.address, deployments.perpManager],
        blockTag: "latest",
      });
      if (currentAllowance < perpLimit) {
        await approveUsdc(context, perpLimit);
      }
    }

    const { request } = await context.publicClient.simulateContract({
      address: deployments.perpManager,
      abi: PERP_MANAGER_ABI,
      functionName: "adjustNotional",
      args: [{ posId: positionId, usdDelta, perpLimit }],
      account: context.walletClient.account,
    });

    const txHash = await context.walletClient.writeContract(request);

    return { txHash };
  }, `adjustNotional for position ${positionId}`);
}
