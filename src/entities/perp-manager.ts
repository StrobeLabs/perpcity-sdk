import { PerpCityContext } from "../context";
import { Perp } from "./perp";
import { priceToSqrtPriceX96 } from "../utils";
import { PerpCollection } from "./perp-collection";
import type { Address, Hex } from "viem";
import { publicActions } from "viem";
import { gql } from "graphql-request";
import type { TypedDocumentNode } from '@graphql-typed-document-node/core';
import { parse } from 'graphql';

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

  async getPerps(): Promise<PerpCollection> {
    const query: TypedDocumentNode<{ perps: { id: Hex }[] }, Record<any, never>> = parse(gql`
      {
        perps {
          id
        }
      }
    `)

    const response = await this.context.goldskyClient.request(query);
    
    const perps = response.perps.map((perpData: { id: Hex }) => 
      new Perp(this.context, perpData.id as Hex)
    );

    return new PerpCollection(this.context, perps);
  }

  // WRITES

  async createPerp(params: CreatePerpParams): Promise<Perp> {
    const sqrtPriceX96 = priceToSqrtPriceX96(params.startingPrice);

    const contractParams = {
      startingSqrtPriceX96: sqrtPriceX96,
      beacon: params.beacon,
    };

    const { result, request } = await this.context.walletClient.extend(publicActions).simulateContract({
      address: this.context.perpManagerAddress,
      abi: this.context.perpManagerAbi,
      functionName: 'createPerp',
      args: [contractParams],
      account: this.context.walletClient.account,
      chain: this.context.walletClient.chain,
    });

    await this.context.walletClient.writeContract(request);

    return new Perp(this.context, result as Hex);
  }
}