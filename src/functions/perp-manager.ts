import { PerpCityContext } from "../context";
import { priceToSqrtPriceX96 } from "../utils";
import { withErrorHandling, GraphQLError } from "../utils/errors";
import type { Address, Hex } from "viem";
import { gql } from "graphql-request";
import type { TypedDocumentNode } from '@graphql-typed-document-node/core';
import { parse } from 'graphql';
import { PERP_MANAGER_ABI } from "../abis/perp-manager";
import { CreatePerpParams } from "../types/entity-data";

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

    try {
      const response = await context.goldskyClient.request(query);
      return response.perps.map((perpData: { id: Hex }) => perpData.id as Hex);
    } catch (error) {
      throw new GraphQLError(`Failed to fetch perps: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error : undefined);
    }
  }, "getPerps");
}

export async function createPerp(context: PerpCityContext, params: CreatePerpParams): Promise<Hex> {
  return withErrorHandling(async () => {
    const sqrtPriceX96 = priceToSqrtPriceX96(params.startingPrice);

    const contractParams = {
      startingSqrtPriceX96: sqrtPriceX96,
      beacon: params.beacon,
    };

    const { result, request } = await context.walletClient.simulateContract({
      address: context.deployments().perpManager,
      abi: PERP_MANAGER_ABI,
      functionName: 'createPerp',
      args: [contractParams],
      account: context.walletClient.account,
    });

    const txHash = await context.walletClient.writeContract(request);

    // Wait for transaction confirmation
    const publicClient = context.walletClient.extend((client: any) => ({
      waitForTransactionReceipt: (args: any) => client.request({
        method: 'eth_getTransactionReceipt',
        params: [args.hash],
      }),
    }));

    return result as Hex;
  }, "createPerp");
}
