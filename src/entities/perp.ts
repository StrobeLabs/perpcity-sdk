import type {Hex} from "viem";
import { publicActions } from "viem";
import { PerpCityContext } from "../context";
import { Position } from "./position";
import { estimateLiquidity, priceToTick, scale6Decimals, scaleX96 } from "../utils";
import { nearestUsableTick } from "@uniswap/v3-sdk";
import { approveUsdc } from "../utils/approve";

export type OpenMakerPositionParams = {
  margin: number;
  priceLower: number;
  priceUpper: number;
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
  public readonly context: PerpCityContext;
  public readonly id: Hex;

  constructor(context: PerpCityContext, id: Hex) {
    this.context = context;
    this.id = id;
  }

  // READS

  async getTickSpacing(): Promise<number> {
    const tickSpacing: bigint = await this.context.walletClient.extend(publicActions).readContract({
      address: this.context.perpManagerAddress,
      abi: this.context.perpManagerAbi,
      functionName: 'tickSpacing',
      args: [this.id]
    }) as bigint;

    return Number(tickSpacing);
  }

  // WRITES

  async approveAndOpenMakerPosition(params: OpenMakerPositionParams): Promise<Position> {
    await approveUsdc(this.context, scale6Decimals(params.margin));
    return await this.openMakerPosition(params);
  }

  async approveAndOpenTakerPosition(params: OpenTakerPositionParams): Promise<Position> {
    await approveUsdc(this.context, scale6Decimals(params.margin));
    return await this.openTakerPosition(params);
  }

  async openMakerPosition(params: OpenMakerPositionParams): Promise<Position> {
    const tickSpacing = await this.getTickSpacing();

    const scaledUsd = scale6Decimals(params.margin);
    const tickLower = BigInt(nearestUsableTick(priceToTick(params.priceLower, true), tickSpacing));
    const tickUpper = BigInt(nearestUsableTick(priceToTick(params.priceUpper, false), tickSpacing));

    const contractParams = {
      margin: scaledUsd,
      liquidity: await estimateLiquidity(this.context, tickLower, tickUpper, scaledUsd),
      tickLower: tickLower,
      tickUpper: tickUpper,
      maxAmt0In: scale6Decimals(params.maxAmt0In),
      maxAmt1In: scale6Decimals(params.maxAmt1In),
    };

    const { result, request } = await this.context.walletClient.extend(publicActions).simulateContract({
      address: this.context.perpManagerAddress,
      abi: this.context.perpManagerAbi,
      functionName: 'openMakerPosition',
      args: [this.id, contractParams],
      account: this.context.walletClient.account,
    });

    await this.context.walletClient.writeContract(request);

    return new Position(this.context, this.id, result as bigint);
  }

  async openTakerPosition(params: OpenTakerPositionParams): Promise<Position> {
    const contractParams = {
      isLong: params.isLong,
      margin: scale6Decimals(params.margin),
      levX96: scaleX96(params.leverage),
      unspecifiedAmountLimit: scale6Decimals(params.unspecifiedAmountLimit),
    };
    
    const { result, request } = await this.context.walletClient.extend(publicActions).simulateContract({
      address: this.context.perpManagerAddress,
      abi: this.context.perpManagerAbi,
      functionName: 'openTakerPosition',
      args: [this.id, contractParams],
      account: this.context.walletClient.account,
    });

    await this.context.walletClient.writeContract(request);

    return new Position(this.context, this.id, result as bigint);
  }
}