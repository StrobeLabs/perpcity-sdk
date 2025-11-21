import type { Hex } from "viem";
import { decodeEventLog, publicActions } from "viem";
import { PERP_MANAGER_ABI } from "../abis/perp-manager";
import type { PerpCityContext } from "../context";
import type {
  CreatePerpParams,
  OpenMakerPositionParams,
  OpenTakerPositionParams,
} from "../types/entity-data";
import { priceToSqrtPriceX96, priceToTick, scale6Decimals, scaleToX96 } from "../utils";
import { approveUsdc } from "../utils/approve";
import { withErrorHandling } from "../utils/errors";
import { OpenPosition } from "./open-position";

export async function createPerp(context: PerpCityContext, params: CreatePerpParams): Promise<Hex> {
  return withErrorHandling(async () => {
    const sqrtPriceX96 = priceToSqrtPriceX96(params.startingPrice);
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
      startingSqrtPriceX96: sqrtPriceX96,
    };

    const { request } = await context.walletClient.simulateContract({
      address: context.deployments().perpManager,
      abi: PERP_MANAGER_ABI,
      functionName: "createPerp",
      args: [contractParams],
      account: context.walletClient.account,
    });

    // Execute the transaction
    const txHash = await context.walletClient.writeContract(request);

    // Wait for transaction confirmation
    const publicClient = context.walletClient.extend(publicActions);
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

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

    // Approve USDC spending
    await approveUsdc(context, marginScaled);

    // Convert leverage to X96 format: leverage * 2^96
    const levX96 = scaleToX96(params.leverage);

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
      levX96,
      unspecifiedAmountLimit,
    };

    // Simulate transaction - deployed contract uses openTakerPos
    const { request } = await context.walletClient.simulateContract({
      address: context.deployments().perpManager,
      abi: PERP_MANAGER_ABI,
      functionName: "openTakerPos" as any,
      args: [perpId, contractParams],
      account: context.walletClient.account,
    });

    // Execute transaction
    const txHash = await context.walletClient.writeContract(request);

    // Wait for confirmation
    const publicClient = context.walletClient.extend(publicActions);
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

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

export async function openMakerPosition(
  context: PerpCityContext,
  perpId: Hex,
  params: OpenMakerPositionParams
): Promise<OpenPosition> {
  return withErrorHandling(async () => {
    // Validate inputs
    if (params.margin <= 0) {
      throw new Error("Margin must be greater than 0");
    }
    if (params.priceLower >= params.priceUpper) {
      throw new Error("priceLower must be less than priceUpper");
    }

    // Convert margin to 6-decimal scaled bigint
    const marginScaled = scale6Decimals(params.margin);

    // Approve USDC spending - need to approve margin + maxAmt1In
    // because the contract may need to pull additional USDC for LP position
    const totalApprovalNeeded = marginScaled + scale6Decimals(params.maxAmt1In);
    await approveUsdc(context, totalApprovalNeeded);

    // Get perp data to determine tick spacing
    const perpData = await context.getPerpData(perpId);

    // Convert prices to ticks
    const tickLower = priceToTick(params.priceLower, true); // round down
    const tickUpper = priceToTick(params.priceUpper, false); // round up

    // Validate ticks are aligned to tick spacing
    const tickSpacing = perpData.tickSpacing;
    const alignedTickLower = Math.floor(tickLower / tickSpacing) * tickSpacing;
    const alignedTickUpper = Math.ceil(tickUpper / tickSpacing) * tickSpacing;

    // Throw error if ticks need alignment - require users to provide pre-aligned prices
    if (tickLower !== alignedTickLower || tickUpper !== alignedTickUpper) {
      throw new Error(
        `Ticks must be aligned to tickSpacing (${tickSpacing}). ` +
          `Provided ticks: [${tickLower}, ${tickUpper}], ` +
          `Required aligned ticks: [${alignedTickLower}, ${alignedTickUpper}]. ` +
          `Adjust your priceLower/priceUpper to match the aligned tick values.`
      );
    }

    // Prepare contract parameters - deployed contract requires holder address
    const contractParams = {
      holder: context.walletClient.account!.address,
      margin: marginScaled,
      liquidity: params.liquidity,
      tickLower: alignedTickLower,
      tickUpper: alignedTickUpper,
      maxAmt0In: scale6Decimals(params.maxAmt0In),
      maxAmt1In: scale6Decimals(params.maxAmt1In),
    };

    // Simulate transaction - deployed contract uses openMakerPos
    const { request } = await context.walletClient.simulateContract({
      address: context.deployments().perpManager,
      abi: PERP_MANAGER_ABI,
      functionName: "openMakerPos" as any,
      args: [perpId, contractParams],
      account: context.walletClient.account,
    });

    // Execute transaction
    const txHash = await context.walletClient.writeContract(request);

    // Wait for confirmation
    const publicClient = context.walletClient.extend(publicActions);
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

    // Verify success
    if (receipt.status === "reverted") {
      throw new Error(`Transaction reverted. Hash: ${txHash}`);
    }

    // Extract makerPosId from PositionOpened event
    let makerPosId: bigint | null = null;

    for (const log of receipt.logs) {
      try {
        // Don't specify eventName - let viem auto-detect from ABI
        const decoded = decodeEventLog({
          abi: PERP_MANAGER_ABI,
          data: log.data,
          topics: log.topics,
        });

        // Check if this is a PositionOpened event for our perpId and it's a maker
        // Note: perpId from events is lowercased, so normalize both for comparison
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

    // Return OpenPosition instance with transaction hash (isLong will be determined by position data)
    return new OpenPosition(context, perpId, makerPosId, undefined, true, txHash);
  }, "openMakerPosition");
}
