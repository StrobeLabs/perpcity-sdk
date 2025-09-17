import { PerpCityContext } from "../context";
import { Perp } from "./perp";
import { priceToSqrtPriceX96 } from "../utils";
import type { Address, Hex } from "viem";

export type CreatePerpParams = {
  startingPrice: number;
  beacon: Address;
}

export class PerpManager {
  private readonly context: PerpCityContext;
  
  constructor(context: PerpCityContext) {
    this.context = context;
  }

  async createPerp(params: CreatePerpParams): Promise<Perp> {
    const sqrtPriceX96: bigint = priceToSqrtPriceX96(params.startingPrice);

    const { result, request } = await this.context.publicClient.simulateContract({
      address: this.context.addresses.perpManager,
      abi: this.context.abis.perpManager,
      functionName: 'createPerp',
      args: [sqrtPriceX96, params.beacon],
      account: this.context.walletClient.account,
    });

    await this.context.walletClient.writeContract(request);

    return new Perp(result[0] as Hex);
  }
}