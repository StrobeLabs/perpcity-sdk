import { PerpCityContext } from "../context";
import { priceToSqrtPriceX96 } from "../utils";
import type { Address, Hex } from "viem";
import { gql } from "graphql-request";
import type { TypedDocumentNode } from '@graphql-typed-document-node/core';
import { parse } from 'graphql';
import { PERP_MANAGER_ABI } from "../abis/perp-manager";
import { CreatePerpParams } from "../types/entity-data";

// Functional alternatives for PerpManager methods
export async function getPerps(context: PerpCityContext): Promise<Hex[]> {
  const query: TypedDocumentNode<{ perps: { id: Hex }[] }, {}> = parse(gql`
    {
      perps {
        id
      }
    }
  `)

  const response = await context.goldskyClient.request(query);
  
  return response.perps.map((perpData: { id: Hex }) => perpData.id as Hex);
}

export async function createPerp(context: PerpCityContext, params: CreatePerpParams): Promise<Hex> {
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

  await context.walletClient.writeContract(request);

  return result as Hex;
}
