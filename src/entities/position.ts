import type { Hex } from "viem";
import { publicActions } from "viem";
import { PerpCityContext } from "../context";
import { scale6Decimals } from "../utils";

export type ClosePositionParams = {
    minAmt0Out: number;
    minAmt1Out: number;
    maxAmt1In: number;
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

//   async closePosition(params: ClosePositionParams): Promise<Position | null> {
//     const contractParams = {
//       positionId: this.positionId,
//       minAmt0Out: scale6Decimals(params.minAmt0Out),
//       minAmt1Out: scale6Decimals(params.minAmt1Out),
//       maxAmt1In: scale6Decimals(params.maxAmt1In),
//     };
    
//     const { result, request } = await this.context.walletClient.extend(publicActions).simulateContract({
//       address: this.context.perpManagerAddress,
//       abi: this.context.perpManagerAbi,
//       functionName: 'closePosition',
//       args: [this.perpId, contractParams],
//       account: this.context.walletClient.account,
//     });

//     await this.context.walletClient.writeContract(request);

//     const takerPositionId = result[0];

//     if (takerPositionId === 0n) {
//       return null;
//     }
    
//     return new Position(this.context, this.perpId, takerPositionId);
//   }
}