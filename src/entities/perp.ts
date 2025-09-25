import type {Address, Hex} from "viem";
import { PerpCityContext } from "../context";
import { OpenPosition } from "./openPosition";
import { estimateLiquidity, priceToTick, scale6Decimals, scaleToX96, scaleFromX96, sqrtPriceX96ToPrice, marginRatioToLeverage, scaleFrom6Decimals } from "../utils";
import { nearestUsableTick } from "@uniswap/v3-sdk";
import { approveUsdc } from "../utils/approve";
import { PERP_MANAGER_ABI } from "../abis/perp-manager";
import { TypedDocumentNode } from "@graphql-typed-document-node/core";
import { gql } from "graphql-request";
import { parse } from "graphql";

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
  takerLongNotional: number,
  takerShortNotional: number,
}

export type TimeSeries<T extends number | OpenInterest> = {
  timestamp: number,
  value: T,
}

export type SimulateOpenPositionResults = {
  success: boolean,
  size: number,
  notional: number,
  creatorFeeAmt: number,
  insuranceFeeAmt: number,
  lpFeeAmt: number,
}

export type Fees = {
  creatorFee: number,
  insuranceFee: number,
  lpFee: number,
  liquidationFee: number,
}

export type Bounds = {
  minMargin: number,
  minTakerLeverage: number,
  maxTakerLeverage: number,
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
    const sqrtPriceX96 = await this.context.walletClient.readContract({
      address: this.context.deployments().perpManager,
      abi: PERP_MANAGER_ABI,
      functionName: 'sqrtPriceX96',
      args: [this.id]
    }) as bigint;

    return sqrtPriceX96ToPrice(sqrtPriceX96);
  }

  async index(): Promise<number> {
    const beacon: Address = await this.beacon();

    const query: TypedDocumentNode<{ beaconSnapshots: { indexPrice: string }[] }, {beaconAddr: Address}> = parse(gql`
      query ($beaconAddr: Bytes!) {
        beaconSnapshots(
          first: 1
          orderBy: timestamp
          orderDirection: desc
          where: { beacon: $beaconAddr }
        ) { indexPrice }
      }
    `);

    const response = await this.context.goldskyClient.request(query, { beaconAddr: beacon });
    
    return Number(response.beaconSnapshots[0].indexPrice);
  }

  async beacon(): Promise<Address> {
    const query: TypedDocumentNode<{ perp: { beacon: { id: Hex } } }, { perpId: Hex }> = parse(gql`
      query ($perpId: Bytes!) {
        perp(id: $perpId) {
          beacon { id }
        }
      }
    `);

    const response = await this.context.goldskyClient.request(query, { perpId: this.id });
    
    return response.perp.beacon.id as Address;
  }

  async lastIndexUpdate(): Promise<number> {
    const beacon: Address = await this.beacon();

    const query: TypedDocumentNode<{ beaconSnapshots: { timestamp: BigInt }[] }, {beaconAddr: Address}> = parse(gql`
      query ($beaconAddr: Bytes!) {
        beaconSnapshots(
          first: 1
          orderBy: timestamp
          orderDirection: desc
          where: { beacon: $beaconAddr }
        ) { timestamp }
      }
    `);

    const response = await this.context.goldskyClient.request(query, { beaconAddr: beacon });
    
    return Number(response.beaconSnapshots[0].timestamp);
  }

  async openInterest(): Promise<OpenInterest> {
    const query: TypedDocumentNode<{ perpSnapshots: { takerLongNotional: string, takerShortNotional: string }[] }, {perpId: Hex}> = parse(gql`
      query ($perpId: Bytes!) {
        perpSnapshots(
          first: 1
          orderBy: timestamp
          orderDirection: desc
          where: { perp: $perpId }
        ) {
          takerLongNotional
          takerShortNotional
        }
      }
    `);

    const response = await this.context.goldskyClient.request(query, { perpId: this.id });
    
    return {
      takerLongNotional: Number(response.perpSnapshots[0].takerLongNotional),
      takerShortNotional: Number(response.perpSnapshots[0].takerShortNotional),
    };
  }

  async markTimeSeries(): Promise<TimeSeries<number>[]> {
    const query: TypedDocumentNode<{ perpSnapshots: { timestamp: BigInt, markPrice: string }[] }, {perpId: Hex}> = parse(gql`
      query ($perpId: Bytes!) {
        perpSnapshots(
          orderBy: timestamp
          orderDirection: asc
          where: { perp: $perpId }
        ) {
          timestamp
          markPrice
        }
      }
    `);

    const response = await this.context.goldskyClient.request(query, { perpId: this.id });
    
    return response.perpSnapshots.map((snapshot) => ({
      timestamp: Number(snapshot.timestamp),
      value: Number(snapshot.markPrice),
    }));
  }

  async indexTimeSeries(): Promise<TimeSeries<number>[]> {
    const beacon: Address = await this.beacon();

    const query: TypedDocumentNode<{ beaconSnapshots: { timestamp: BigInt, indexPrice: string }[] }, {beaconAddr: Address}> = parse(gql`
      query ($beaconAddr: Bytes!) {
        beaconSnapshots(
          orderBy: timestamp
          orderDirection: asc
          where: { beacon: $beaconAddr }
        ) {
          timestamp
          indexPrice
        }
      }
    `);

    const response = await this.context.goldskyClient.request(query, { beaconAddr: beacon });
    
    return response.beaconSnapshots.map((snapshot) => ({
      timestamp: Number(snapshot.timestamp),
      value: Number(snapshot.indexPrice),
    }));
  }

  async fundingRate(): Promise<number> {
    const query: TypedDocumentNode<{ perpSnapshots: { fundingRate: string }[] }, {perpId: Hex}> = parse(gql`
      query ($perpId: Bytes!) {
        perpSnapshots(
          first: 1
          orderBy: timestamp
          orderDirection: desc
          where: { perp: $perpId }
        ) {
          fundingRate
        }
      }
    `);

    const response = await this.context.goldskyClient.request(query, { perpId: this.id });
    
    return Number(response.perpSnapshots[0].fundingRate);
  }

  async bounds(): Promise<Bounds> {
    const result = await this.context.walletClient.readContract({
      address: this.context.deployments().perpManager,
      abi: PERP_MANAGER_ABI,
      functionName: 'tradingBounds',
      args: [this.id]
    });

    return {
      minMargin: Number(result[0]),
      minTakerLeverage: marginRatioToLeverage(result[5]),
      maxTakerLeverage: marginRatioToLeverage(result[4]),
    };
  }

  // TODO
  async maxTakerNotional(isLong: boolean): Promise<number> {
    return 0;
  }

  async simulateTaker(params: OpenTakerPositionParams): Promise<SimulateOpenPositionResults> {
    const contractParams = {
      isLong: params.isLong,
      margin: scale6Decimals(params.margin),
      levX96: scaleToX96(params.leverage),
      unspecifiedAmountLimit: scale6Decimals(params.unspecifiedAmountLimit),
    };

    const { result, request } = await this.context.walletClient.simulateContract({
      address: this.context.deployments().perpManager,
      abi: PERP_MANAGER_ABI,
      functionName: 'quoteTakerPosition',
      args: [this.id, contractParams],
      account: this.context.walletClient.account,
    });

    return {
      success: result[0],
      size: scaleFrom6Decimals(Math.abs(Number(result[1]))),
      notional: scaleFrom6Decimals(Math.abs(Number(result[2]))),
      creatorFeeAmt: scaleFrom6Decimals(Number(result[3])),
      insuranceFeeAmt: scaleFrom6Decimals(Number(result[4])),
      lpFeeAmt: scaleFrom6Decimals(Number(result[5])),
    };
  }

  async allMakerPositions(): Promise<OpenPosition[]> {
    const query: TypedDocumentNode<{ openPositions: { perp: { id: Hex }, inContractPosId: bigint }[] }, {perpId: Hex}> = parse(gql`
      query ($perpId: Bytes!) {
        openPositions(
          where: { perp: $perpId, isMaker: true }
        ) {
          perp { id }
          inContractPosId
        }
      }
    `);

    const response = await this.context.goldskyClient.request(query, { perpId: this.id });
    
    return response.openPositions.map((position) => (new OpenPosition(this.context, position.perp.id, position.inContractPosId)));
  }

  async allTakerPositions(): Promise<OpenPosition[]> {
    const query: TypedDocumentNode<{ openPositions: { perp: { id: Hex }, inContractPosId: bigint }[] }, {perpId: Hex}> = parse(gql`
      query ($perpId: Bytes!) {
        openPositions(
          where: { perp: $perpId, isMaker: false }
        ) {
          perp { id }
          inContractPosId
        }
      }
    `);

    const response = await this.context.goldskyClient.request(query, { perpId: this.id });
    
    return response.openPositions.map((position) => (new OpenPosition(this.context, position.perp.id, position.inContractPosId)));
  }

  async totalOpenMakerPnl(): Promise<number> {
    const positions = await this.allMakerPositions();
    const liveDetails = await Promise.all(positions.map((position) => position.liveDetails()));
    return liveDetails.reduce((acc, detail) => acc + detail.pnl - detail.fundingPayment, 0);
  }

  async totalOpenTakerPnl(): Promise<number> {
    const positions = await this.allTakerPositions();
    const liveDetails = await Promise.all(positions.map((position) => position.liveDetails()));
    return liveDetails.reduce((acc, detail) => acc + detail.pnl - detail.fundingPayment, 0);
  }

  async fees(): Promise<Fees> {
    const result = await this.context.walletClient.readContract({
      address: this.context.deployments().perpManager,
      abi: PERP_MANAGER_ABI,
      functionName: 'fees',
      args: [this.id]
    });

    return {
      creatorFee: scaleFrom6Decimals(result[0]),
      insuranceFee: scaleFrom6Decimals(result[1]),
      lpFee: scaleFrom6Decimals(result[2]),
      liquidationFee: scaleFrom6Decimals(result[3]),
    };
  }

  async openInterestTimeSeries(): Promise<TimeSeries<OpenInterest>[]> {
    const query: TypedDocumentNode<{ perpSnapshots: { timestamp: BigInt, takerLongNotional: string, takerShortNotional: string }[] }, {perpId: Hex}> = parse(gql`
      query ($perpId: Bytes!) {
        perpSnapshots(
          orderBy: timestamp
          orderDirection: asc
          where: { perp: $perpId }
        ) {
          timestamp
          takerLongNotional
          takerShortNotional
        }
      }
    `);

    const response = await this.context.goldskyClient.request(query, { perpId: this.id });
    
    return response.perpSnapshots.map((snapshot) => ({
      timestamp: Number(snapshot.timestamp),
      value: {
        takerLongNotional: Number(snapshot.takerLongNotional),
        takerShortNotional: Number(snapshot.takerShortNotional),
      },
    }));
  }

  async fundingRateTimeSeries(): Promise<TimeSeries<number>[]> {
    const query: TypedDocumentNode<{ perpSnapshots: { timestamp: BigInt, fundingRate: string }[] }, {perpId: Hex}> = parse(gql`
      query ($perpId: Bytes!) {
        perpSnapshots(
          orderBy: timestamp
          orderDirection: asc
          where: { perp: $perpId }
        ) {
          timestamp
          fundingRate
        }
      }
    `);

    const response = await this.context.goldskyClient.request(query, { perpId: this.id });
    
    return response.perpSnapshots.map((snapshot) => ({
      timestamp: Number(snapshot.timestamp),
      value: Number(snapshot.fundingRate),
    }));
  }

  // WRITES

  async approveAndOpenMakerPosition(params: OpenMakerPositionParams): Promise<OpenPosition> {
    await approveUsdc(this.context, scale6Decimals(params.margin));
    return await this.openMakerPosition(params);
  }

  async approveAndOpenTakerPosition(params: OpenTakerPositionParams): Promise<OpenPosition> {
    await approveUsdc(this.context, scale6Decimals(params.margin));
    return await this.openTakerPosition(params);
  }

  async openMakerPosition(params: OpenMakerPositionParams): Promise<OpenPosition> {
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

    return new OpenPosition(this.context, this.id, result);
  }

  async openTakerPosition(params: OpenTakerPositionParams): Promise<OpenPosition> {
    const contractParams = {
      isLong: params.isLong,
      margin: scale6Decimals(params.margin),
      levX96: scaleToX96(params.leverage),
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

    return new OpenPosition(this.context, this.id, result as bigint);
  }
}