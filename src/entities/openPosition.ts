import type { Hex } from "viem";
import { publicActions } from "viem";
import { PerpCityContext } from "../context";
import { scale6Decimals, scaleFrom6Decimals } from "../utils";
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
}

export class OpenPosition {
  public readonly context: PerpCityContext;
  public readonly perpId: Hex;
  public readonly positionId: bigint;

  constructor(context: PerpCityContext, perpId: Hex, positionId: bigint) {
    this.context = context;
    this.perpId = perpId;
    this.positionId = positionId;
  }

  async closePosition(params: ClosePositionParams): Promise<OpenPosition | null> {
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

    return result === null ? null : new OpenPosition(this.context, this.perpId, result);
  }

  async liveDetails(): Promise<LiveDetails> {
    const { result, request } = await this.context.walletClient.simulateContract({
      address: this.context.deployments().perpManager,
      abi: PERP_MANAGER_ABI,
      functionName: 'livePositionDetails',
      args: [this.perpId, this.positionId],
      account: this.context.walletClient.account,
    });

    return {
      pnl: scaleFrom6Decimals(Number(result[0])),
      fundingPayment: scaleFrom6Decimals(Number(result[1])),
      effectiveMargin: scaleFrom6Decimals(Number(result[2])),
      isLiquidatable: result[3],
    };
  }
}