import { PerpCityContext } from "../context";
import { Perp } from "./perp";
import { priceToSqrtPriceX96 } from "../utils";
import type { Address, Hex } from "viem";
import { gql } from "graphql-request";
import type { TypedDocumentNode } from '@graphql-typed-document-node/core';
import { parse } from 'graphql';
import { PERP_MANAGER_ABI } from "../abis/perp-manager";

export type CreatePerpParams = {
  startingPrice: number;
  beacon: Address;
}

export class PerpManager {
  public readonly context: PerpCityContext;
  
  constructor(context: PerpCityContext) {
    this.context = context;
  }

  // READS

  async getPerps(): Promise<Perp[]> {
    const query: TypedDocumentNode<{ perps: { id: Hex }[] }, {}> = parse(gql`
      {
        perps {
          id
        }
      }
    `)

    const response = await this.context.goldskyClient.request(query);
    
    return response.perps.map((perpData: { id: Hex }) => 
      new Perp(this.context, perpData.id as Hex)
    );
  }

  // WRITES

  async createPerp(params: CreatePerpParams): Promise<Perp> {
    const sqrtPriceX96 = priceToSqrtPriceX96(params.startingPrice);

    const contractParams = {
      startingSqrtPriceX96: sqrtPriceX96,
      beacon: params.beacon,
    };

    const { result, request } = await this.context.walletClient.simulateContract({
      address: this.context.deployments().perpManager,
      abi: PERP_MANAGER_ABI,
      functionName: 'createPerp',
      args: [contractParams],
      account: this.context.walletClient.account,
    });

    await this.context.walletClient.writeContract(request);

    return new Perp(this.context, result as Hex);
  }
}