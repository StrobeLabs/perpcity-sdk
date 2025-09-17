import { PerpCityContext } from "../context";
import { Perp } from "./perp";
import { priceToSqrtPriceX96 } from "../utils";
import type { Address } from "viem";

export class PerpManager {
  public readonly context: PerpCityContext;
  
  constructor(context: PerpCityContext) {
    this.context = context;
  }

  // TODO: retuen a Promise<Perp> instead of the transaction hash
  async createPerp(startingPrice: number, beacon: Address): Promise<`0x${string}`> {
    const sqrtPriceX96: bigint = priceToSqrtPriceX96(startingPrice);

    // The deployed contract expects a struct with two fields
    const params = {
      startingSqrtPriceX96: sqrtPriceX96,
      beacon: beacon,
    };

    const { request } = await this.context.publicClient.simulateContract({
      address: this.context.addresses.perpManager,
      abi: this.context.abis.perpManager,
      functionName: 'createPerp',
      args: [params],
      account: this.context.walletClient.account,
    });

    const hash: `0x${string}` = await this.context.walletClient.writeContract(request);

    return hash;
  }
}