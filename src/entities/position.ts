import type { Hex } from "viem";
import { publicActions } from "viem";
import { PerpCityContext } from "../context";
import { scale6Decimals } from "../utils";
import { PERP_MANAGER_ABI } from "../abis/perp-manager";

export type ClosePositionParams = {
  minAmt0Out: number;
  minAmt1Out: number;
  maxAmt1In: number;
}

export type LiveDetails = {
  pnl: number;
  fundingPayment: number;
  effectiveMargin: number;
  isLiquidatable: boolean;
  liquidationPrice: number;
}

export class Position {
  public readonly context: PerpCityContext;
  public readonly perpId: Hex;
  public readonly positionId: bigint;

  constructor(context: PerpCityContext, perpId: Hex, positionId: bigint) {
    this.context = context;
    this.perpId = perpId;
    this.positionId = positionId;
  }

  async closePosition(params: ClosePositionParams): Promise<Position | null> {
    const contractParams = {
      posId: this.positionId,
      minAmt0Out: scale6Decimals(params.minAmt0Out),
      minAmt1Out: scale6Decimals(params.minAmt1Out),
      maxAmt1In: scale6Decimals(params.maxAmt1In),
    };
    
    const { result, request } = await this.context.walletClient.extend(publicActions).simulateContract({
      address: this.context.deployments().perpManager,
      abi: PERP_MANAGER_ABI,
      functionName: 'closePosition',
      args: [this.perpId, contractParams],
      account: this.context.walletClient.account,
    });

    await this.context.walletClient.writeContract(request);

    return result === null ? null : new Position(this.context, this.perpId, result);
  }

  // if open, sc read, is close, goldsky query
  async liveDetails(): Promise<LiveDetails> {
    return {
      pnl: 0, 
      fundingPayment: 0,
      effectiveMargin: 0,
      isLiquidatable: false,
      liquidationPrice: 0,
    };
  }
}