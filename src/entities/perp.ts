import type {Hex} from "viem";
import { PerpCityContext } from "../context";
import { Position } from "./position";
import { estimateLiquidity, priceToTick, scale6Decimals, scaleX96 } from "../utils";
import { nearestUsableTick } from "@uniswap/v3-sdk";
import { approveUsdc } from "../utils/approve";
import { PERP_MANAGER_ABI } from "../abis/perp-manager";

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

export type OpenInterest = {
  makerOI: number,
  longTakerOI: number,
  shortTakerOI: number,
}

export type TimeSeries<T extends number | OpenInterest> = {
  timestamp: number,
  value: T,
}

export type SimulateTakerResults = {
  success: boolean,
  notional: number,
  size: number,
  takerFee: number,
  protocolFeeAmt: number,
  insuranceFeeAmt: number,
  tradingFeeAmt: number,
}

export type TakerFees = {
  protocolFeePercent: number,
  insuranceFeePercent: number,
  tradingFeePercent: number,
}

export class Perp {
  public readonly context: PerpCityContext;
  public readonly id: Hex;

  constructor(context: PerpCityContext, id: Hex) {
    this.context = context;
    this.id = id;
  }

  // READS

  async tickSpacing(): Promise<number> {
    return await this.context.walletClient.readContract({
      address: this.context.deployments().perpManager,
      abi: PERP_MANAGER_ABI,
      functionName: 'tickSpacing',
      args: [this.id]
    }) as number;
  }

  async mark(): Promise<number>  {
    return 0;
  }

  async index(): Promise<number> {
    return 0;
  }

  async lastIndexUpdate(): Promise<number> {
    return 0;
  }

  async openInterest(): Promise<OpenInterest> {
    return {
      makerOI: 0,
      longTakerOI: 0,
      shortTakerOI: 0
    };
  }

  async maxTakerNotional(isLong: boolean): Promise<number> {
    return 0;
  }

  async markTiemSeries(): Promise<TimeSeries<number>[]> {
    return [];
  }

  async indexTimeSeries(): Promise<TimeSeries<number>[]> {
    return [];
  }

  async fundingRate(): Promise<number> {
    return 0;
  }

  // TODO: may need to create a type for bounds (e.g. leverage, margin, notional)
  async takerBounds(params: OpenTakerPositionParams): Promise<number> {
    return 0;
  }

  async simulateTaker(params: OpenTakerPositionParams): Promise<SimulateTakerResults> {
    return {
      success: false,
      notional: 0,
      size: 0,
      takerFee: 0,
      protocolFeeAmt: 0,
      insuranceFeeAmt: 0,
      tradingFeeAmt: 0,
    };
  }

  async takerFees(): Promise<TakerFees> {
    return {
      protocolFeePercent: 0,
      insuranceFeePercent: 0,
      tradingFeePercent: 0,
    };
  }

  async makerPnl(): Promise<number> {
    return 0;
  }

  async takerPnl(): Promise<number> {
    return 0;
  }

  // maybe not needed
  async liquidity(): Promise<number> {
    return 0;
  }

  async openInterestTimeSeries(): Promise<TimeSeries<OpenInterest>[]> {
    return [];
  }

  async fundingRateTimeSeries(): Promise<TimeSeries<number>[]> {
    return [];
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
    const deployments = this.context.deployments();
    const tickSpacing = await this.tickSpacing();

    const scaledUsd = scale6Decimals(params.margin);
    const tickLower = nearestUsableTick(priceToTick(params.priceLower, true), tickSpacing);
    const tickUpper = nearestUsableTick(priceToTick(params.priceUpper, false), tickSpacing);

    const contractParams = {
      margin: scaledUsd,
      liquidity: await estimateLiquidity(this.context, tickLower, tickUpper, scaledUsd),
      tickLower: tickLower,
      tickUpper: tickUpper,
      maxAmt0In: scale6Decimals(params.maxAmt0In),
      maxAmt1In: scale6Decimals(params.maxAmt1In),
    };

    const { result, request } = await this.context.walletClient.simulateContract({
      address: deployments.perpManager,
      abi: PERP_MANAGER_ABI,
      functionName: 'openMakerPosition',
      args: [this.id, contractParams],
      account: this.context.walletClient.account,
    });

    await this.context.walletClient.writeContract(request);

    return new Position(this.context, this.id, result);
  }

  async openTakerPosition(params: OpenTakerPositionParams): Promise<Position> {
    const contractParams = {
      isLong: params.isLong,
      margin: scale6Decimals(params.margin),
      levX96: scaleX96(params.leverage),
      unspecifiedAmountLimit: scale6Decimals(params.unspecifiedAmountLimit),
    };
    
    const { result, request } = await this.context.walletClient.simulateContract({
      address: this.context.deployments().perpManager,
      abi: PERP_MANAGER_ABI,
      functionName: 'openTakerPosition',
      args: [this.id, contractParams],
      account: this.context.walletClient.account,
    });

    await this.context.walletClient.writeContract(request);

    return new Position(this.context, this.id, result as bigint);
  }
}