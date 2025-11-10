import { PerpCityContext } from "../context";
import { priceToSqrtPriceX96, scale6Decimals, scaleToX96, priceToTick } from "../utils";
import { withErrorHandling, GraphQLError } from "../utils/errors";
import { approveUsdc } from "../utils/approve";
import type { Address, Hex } from "viem";
import { publicActions, decodeEventLog } from "viem";
import { gql } from "graphql-request";
import type { TypedDocumentNode } from '@graphql-typed-document-node/core';
import { parse } from 'graphql';
import { PERP_MANAGER_ABI } from "../abis/perp-manager";
import { CreatePerpParams, OpenTakerPositionParams, OpenMakerPositionParams } from "../types/entity-data";
import { OpenPosition } from "./open-position";

// Functional alternatives for PerpManager methods
export async function getPerps(context: PerpCityContext): Promise<Hex[]> {
  return withErrorHandling(async () => {
    const query: TypedDocumentNode<{ perps: { id: Hex }[] }, {}> = parse(gql`
      {
        perps {
          id
        }
      }
    `)

    const response = await context.goldskyClient.request(query);
    return response.perps.map((perpData: { id: Hex }) => perpData.id as Hex);
  }, "getPerps");
}

export async function createPerp(context: PerpCityContext, params: CreatePerpParams): Promise<Hex> {
  return withErrorHandling(async () => {
    const sqrtPriceX96 = priceToSqrtPriceX96(params.startingPrice);

    const contractParams = {
      beacon: params.beacon,
      fees: params.fees,
      marginRatios: params.marginRatios,
      lockupPeriod: params.lockupPeriod,
      sqrtPriceImpactLimit: params.sqrtPriceImpactLimit,
      startingSqrtPriceX96: sqrtPriceX96,
    };

    const { request } = await context.walletClient.simulateContract({
      address: context.deployments().perpManager,
      abi: PERP_MANAGER_ABI,
      functionName: 'createPerp',
      args: [contractParams],
      account: context.walletClient.account,
    });

    // Execute the transaction
    const txHash = await context.walletClient.writeContract(request);

    // Wait for transaction confirmation
    const publicClient = context.walletClient.extend(publicActions);
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

    // Check if transaction was successful
    if (receipt.status === 'reverted') {
      throw new Error(`Transaction reverted. Hash: ${txHash}`);
    }

    // Extract perpId from PerpCreated event
    for (const log of receipt.logs) {
      try {
        const decoded = decodeEventLog({
          abi: PERP_MANAGER_ABI,
          data: log.data,
          topics: log.topics,
          eventName: 'PerpCreated',
        });

        // Return the perpId from the event
        return decoded.args.perpId as Hex;
      } catch (e) {
        // Skip logs that aren't PerpCreated event
        continue;
      }
    }

    throw new Error('PerpCreated event not found in transaction receipt');
  }, "createPerp");
}

export async function openTakerPosition(
  context: PerpCityContext,
  perpId: Hex,
  params: OpenTakerPositionParams
): Promise<OpenPosition> {
  return withErrorHandling(async () => {
    // Convert margin to 6-decimal scaled bigint
    const marginScaled = scale6Decimals(params.margin);

    // Approve USDC spending
    await approveUsdc(context, marginScaled);

    // Convert leverage to X96 format: leverage * 2^96
    const levX96 = scaleToX96(params.leverage);

    // Prepare contract parameters - deployed contract requires holder address
    const contractParams = {
      holder: context.walletClient.account!.address,
      isLong: params.isLong,
      margin: marginScaled,
      levX96,
      unspecifiedAmountLimit: scale6Decimals(params.unspecifiedAmountLimit),
    };

    // Simulate transaction - deployed contract uses openTakerPos
    const { request } = await context.walletClient.simulateContract({
      address: context.deployments().perpManager,
      abi: PERP_MANAGER_ABI,
      functionName: 'openTakerPos' as any,
      args: [perpId, contractParams],
      account: context.walletClient.account,
    });

    // Execute transaction
    const txHash = await context.walletClient.writeContract(request);

    // Wait for confirmation
    const publicClient = context.walletClient.extend(publicActions);
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

    // Verify success
    if (receipt.status === 'reverted') {
      throw new Error(`Transaction reverted. Hash: ${txHash}`);
    }

    // Extract takerPosId from PositionOpened event
    let takerPosId: bigint | null = null;

    for (const log of receipt.logs) {
      try {
        const decoded = decodeEventLog({
          abi: PERP_MANAGER_ABI,
          data: log.data,
          topics: log.topics,
          eventName: 'PositionOpened',
        });

        // Match perpId and ensure it's a taker position
        if (decoded.args.perpId === perpId && !decoded.args.isMaker) {
          takerPosId = decoded.args.posId as bigint;
          break;
        }
      } catch (e) {
        // Skip logs that aren't PositionOpened events
        continue;
      }
    }

    if (!takerPosId) {
      throw new Error(`PositionOpened event not found in transaction receipt. Hash: ${txHash}`);
    }

    // Return OpenPosition instance
    return new OpenPosition(context, perpId, takerPosId, params.isLong, false);
  }, 'openTakerPosition');
}

export async function openMakerPosition(
  context: PerpCityContext,
  perpId: Hex,
  params: OpenMakerPositionParams
): Promise<OpenPosition> {
  return withErrorHandling(async () => {
    // Convert margin to 6-decimal scaled bigint
    const marginScaled = scale6Decimals(params.margin);

    // Approve USDC spending
    await approveUsdc(context, marginScaled);

    // Get perp data to determine tick spacing
    const perpData = await context.getPerpData(perpId);

    // Convert prices to ticks
    const tickLower = priceToTick(params.priceLower, true);  // round down
    const tickUpper = priceToTick(params.priceUpper, false); // round up

    // Ensure ticks are valid for tick spacing
    const tickSpacing = perpData.tickSpacing;
    const alignedTickLower = Math.floor(tickLower / tickSpacing) * tickSpacing;
    const alignedTickUpper = Math.ceil(tickUpper / tickSpacing) * tickSpacing;

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
      functionName: 'openMakerPos' as any,
      args: [perpId, contractParams],
      account: context.walletClient.account,
    });

    // Execute transaction
    const txHash = await context.walletClient.writeContract(request);

    // Wait for confirmation
    const publicClient = context.walletClient.extend(publicActions);
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

    // Verify success
    if (receipt.status === 'reverted') {
      throw new Error(`Transaction reverted. Hash: ${txHash}`);
    }

    // Extract makerPosId from PositionOpened event
    let makerPosId: bigint | null = null;

    for (const log of receipt.logs) {
      try {
        const decoded = decodeEventLog({
          abi: PERP_MANAGER_ABI,
          data: log.data,
          topics: log.topics,
          eventName: 'PositionOpened',
        });

        // Match perpId and ensure it's a maker position
        if (decoded.args.perpId === perpId && decoded.args.isMaker) {
          makerPosId = decoded.args.posId as bigint;
          break;
        }
      } catch (e) {
        // Skip logs that aren't PositionOpened events
        continue;
      }
    }

    if (!makerPosId) {
      throw new Error(`PositionOpened event not found in transaction receipt. Hash: ${txHash}`);
    }

    // Return OpenPosition instance (isLong will be determined by position data)
    return new OpenPosition(context, perpId, makerPosId, undefined, true);
  }, 'openMakerPosition');
}
