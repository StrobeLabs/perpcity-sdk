import type {Hex} from "viem";
import { PerpCityContext } from "../context";
import { Position } from "./position";
import { scale6Decimals, scaleX96 } from "../utils";

export type OpenMakerPositionParams = {
  margin: number;
  liquidity: number;
  tickLower: number;
  tickUpper: number;
  maxAmt0In: number;
  maxAmt1In: number;
}

export type OpenTakerPositionParams = {
  isLong: boolean;
  margin: number;
  leverage: number;
  unspecifiedAmountLimit: number;
  
}

export class Perp {
  private readonly context: PerpCityContext;
  public readonly id: Hex;

  constructor(context: PerpCityContext, id: Hex) {
    this.context = context;
    this.id = id;
  }

  // READS

  // WRITES

  async openMakerPosition(params: OpenMakerPositionParams): Promise<Position> {
    const contractParams = {
      margin: scale6Decimals(params.margin),
      liquidity: BigInt(params.liquidity),
      tickLower: BigInt(params.tickLower),
      tickUpper: BigInt(params.tickUpper),
      maxAmt0In: scale6Decimals(params.maxAmt0In),
      maxAmt1In: scale6Decimals(params.maxAmt1In),
    };

    const { result, request } = await this.context.publicClient.simulateContract({
      address: this.context.perpManagerAddress,
      abi: this.context.perpManagerAbi,
      functionName: 'openMakerPosition',
      args: [this.id, contractParams],
      account: this.context.walletClient.account,
    });

    await this.context.walletClient.writeContract(request);

    return new Position(this.context, result[0] as bigint);
  }

  async openTakerPosition(params: OpenTakerPositionParams): Promise<Position> {
    const contractParams = {
      isLong: params.isLong,
      margin: scale6Decimals(params.margin),
      leverage: scaleX96(params.leverage),
      unspecifiedAmountLimit: scale6Decimals(params.unspecifiedAmountLimit),
    };
    
    const { result, request } = await this.context.publicClient.simulateContract({
      address: this.context.perpManagerAddress,
      abi: this.context.perpManagerAbi,
      functionName: 'openTakerPosition',
      args: [this.id, contractParams],
      account: this.context.walletClient.account,
    });

    await this.context.walletClient.writeContract(request);

    return new Position(this.context, result[0] as bigint);
  }
}