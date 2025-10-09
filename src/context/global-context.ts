import { GraphQLClient } from 'graphql-request';
import { TypedDocumentNode } from "@graphql-typed-document-node/core";
import { parse } from "graphql";
import { Address, Hex } from "viem";
import { PerpCityContext } from "../context";
import { PerpData, UserData, OpenPositionData } from "../types/entity-data";
import { OpenInterest, TimeSeries, Bounds, Fees, LiveDetails, ClosedPosition } from "../entities";
import { scaleFrom6Decimals, sqrtPriceX96ToPrice, marginRatioToLeverage } from "../utils";
import { PERP_MANAGER_ABI } from "../abis/perp-manager";
import { erc20Abi } from "viem";

export class GlobalPerpCityContext {
  private context: PerpCityContext;

  constructor(context: PerpCityContext) {
    this.context = context;
  }

  private async fetchPerpData(perpId: Hex): Promise<PerpData> {
    // Batch all perp-related queries into a single GraphQL request
    const perpQuery: TypedDocumentNode<{
      perp: {
        beacon: { id: Hex };
      };
      perpSnapshots: {
        timestamp: BigInt;
        markPrice: string;
        takerLongNotional: string;
        takerShortNotional: string;
        fundingRate: string;
      }[];
    }, { perpId: Hex }> = parse(`
      query ($perpId: Bytes!) {
        perp(id: $perpId) {
          beacon { id }
        }
        perpSnapshots(
          orderBy: timestamp
          orderDirection: asc
          where: { perp: $perpId }
        ) {
          timestamp
          markPrice
          takerLongNotional
          takerShortNotional
          fundingRate
        }
      }
    `);

    const beaconQuery: TypedDocumentNode<{
      beaconSnapshots: {
        timestamp: BigInt;
        indexPrice: string;
      }[];
    }, { beaconAddr: Address }> = parse(`
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

    // Execute first query to get beacon address
    const perpResponse = await this.context.goldskyClient.request(perpQuery, { perpId });
    
    // Execute remaining queries in parallel
    const [beaconResponse, contractData] = await Promise.all([
      this.context.goldskyClient.request(beaconQuery, { beaconAddr: perpResponse.perp.beacon.id }),
      this.fetchPerpContractData(perpId),
    ]);

    // Process time series data
    const markTimeSeries: TimeSeries<number>[] = perpResponse.perpSnapshots.map((snapshot: any) => ({
      timestamp: Number(snapshot.timestamp),
      value: Number(snapshot.markPrice),
    }));

    const indexTimeSeries: TimeSeries<number>[] = beaconResponse.beaconSnapshots.map((snapshot: any) => ({
      timestamp: Number(snapshot.timestamp),
      value: Number(snapshot.indexPrice),
    }));

    const openInterestTimeSeries: TimeSeries<OpenInterest>[] = perpResponse.perpSnapshots.map((snapshot: any) => ({
      timestamp: Number(snapshot.timestamp),
      value: {
        takerLongNotional: Number(snapshot.takerLongNotional),
        takerShortNotional: Number(snapshot.takerShortNotional),
      },
    }));

    const fundingRateTimeSeries: TimeSeries<number>[] = perpResponse.perpSnapshots.map((snapshot: any) => ({
      timestamp: Number(snapshot.timestamp),
      value: Number(snapshot.fundingRate),
    }));

    // Get latest values
    const latestSnapshot = perpResponse.perpSnapshots[perpResponse.perpSnapshots.length - 1];
    const latestBeaconSnapshot = beaconResponse.beaconSnapshots[beaconResponse.beaconSnapshots.length - 1];

    const perpData: PerpData = {
      id: perpId,
      tickSpacing: contractData.tickSpacing,
      mark: contractData.mark,
      index: Number(latestBeaconSnapshot.indexPrice),
      beacon: perpResponse.perp.beacon.id,
      lastIndexUpdate: Number(latestBeaconSnapshot.timestamp),
      openInterest: {
        takerLongNotional: Number(latestSnapshot.takerLongNotional),
        takerShortNotional: Number(latestSnapshot.takerShortNotional),
      },
      markTimeSeries,
      indexTimeSeries,
      fundingRate: Number(latestSnapshot.fundingRate),
      bounds: contractData.bounds,
      fees: contractData.fees,
      openInterestTimeSeries,
      fundingRateTimeSeries,
      totalOpenMakerPnl: 0, // Will be calculated when needed
      totalOpenTakerPnl: 0, // Will be calculated when needed
    };

    return perpData;
  }

  private async fetchPerpContractData(perpId: Hex) {
    const [tickSpacing, sqrtPriceX96, bounds, fees] = await Promise.all([
      this.context.walletClient.readContract({
        address: this.context.deployments().perpManager,
        abi: PERP_MANAGER_ABI,
        functionName: 'tickSpacing',
        args: [perpId]
      }) as Promise<number>,
      this.context.walletClient.readContract({
        address: this.context.deployments().perpManager,
        abi: PERP_MANAGER_ABI,
        functionName: 'sqrtPriceX96',
        args: [perpId]
      }) as Promise<bigint>,
      this.context.walletClient.readContract({
        address: this.context.deployments().perpManager,
        abi: PERP_MANAGER_ABI,
        functionName: 'tradingBounds',
        args: [perpId]
      }),
      this.context.walletClient.readContract({
        address: this.context.deployments().perpManager,
        abi: PERP_MANAGER_ABI,
        functionName: 'fees',
        args: [perpId]
      }),
    ]);

    return {
      tickSpacing,
      mark: sqrtPriceX96ToPrice(sqrtPriceX96),
      bounds: {
        minMargin: Number(bounds[0]),
        minTakerLeverage: marginRatioToLeverage(bounds[5]),
        maxTakerLeverage: marginRatioToLeverage(bounds[4]),
      } as Bounds,
      fees: {
        creatorFee: scaleFrom6Decimals(fees[0]),
        insuranceFee: scaleFrom6Decimals(fees[1]),
        lpFee: scaleFrom6Decimals(fees[2]),
        liquidationFee: scaleFrom6Decimals(fees[3]),
      } as Fees,
    };
  }

  private async fetchUserData(walletAddress: Hex): Promise<UserData> {
    const [usdcBalance, positionsResponse, closedPositionsResponse] = await Promise.all([
      this.context.walletClient.readContract({
        address: this.context.deployments().usdc,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [walletAddress],
      }) as Promise<bigint>,
      this.fetchUserOpenPositions(walletAddress),
      this.fetchUserClosedPositions(walletAddress),
    ]);

    const openPositions = await Promise.all(
      positionsResponse.map(async (pos) => ({
        ...pos,
        liveDetails: await this.fetchPositionLiveDetails(pos.perpId, pos.positionId),
      }))
    );

    const realizedPnl = closedPositionsResponse.reduce((acc, pos) => acc + pos.pnlAtClose, 0);
    const unrealizedPnl = openPositions.reduce((acc, pos) => acc + pos.liveDetails.pnl - pos.liveDetails.fundingPayment, 0);

    const userData: UserData = {
      walletAddress,
      usdcBalance: scaleFrom6Decimals(Number(usdcBalance)),
      openPositions,
      closedPositions: closedPositionsResponse,
      realizedPnl,
      unrealizedPnl,
    };

    return userData;
  }

  private async fetchUserOpenPositions(walletAddress: Hex): Promise<Omit<OpenPositionData, 'liveDetails'>[]> {
    const query: TypedDocumentNode<{
      openPositions: {
        perp: { id: Hex };
        inContractPosId: bigint;
        isLong: boolean;
        isMaker: boolean;
      }[];
    }, { holder: Address }> = parse(`
      query ($holder: Bytes!) {
        openPositions(
          where: { holder: $holder }
        ) {
          perp { id }
          inContractPosId
          isLong
          isMaker
        }
      }
    `);

    const response = await this.context.goldskyClient.request(query, { holder: walletAddress });
    
    return response.openPositions.map((position) => ({
      perpId: position.perp.id,
      positionId: position.inContractPosId,
      isLong: position.isLong,
      isMaker: position.isMaker,
    }));
  }

  private async fetchUserClosedPositions(walletAddress: Hex): Promise<ClosedPosition[]> {
    const query: TypedDocumentNode<{
      closedPositions: {
        perp: { id: Hex };
        wasMaker: boolean;
        wasLong: boolean;
        pnlAtClose: string;
      }[];
    }, { holder: Address }> = parse(`
      query ($holder: Bytes!) {
        closedPositions(
          where: { holder: $holder }
        ) {
          perp { id }
          wasMaker
          wasLong
          pnlAtClose
        }
      }
    `);

    const response = await this.context.goldskyClient.request(query, { holder: walletAddress });
    
    return response.closedPositions.map((position) => ({
      perpId: position.perp.id,
      wasMaker: position.wasMaker,
      wasLong: position.wasLong,
      pnlAtClose: Number(position.pnlAtClose),
    }));
  }

  private async fetchPositionLiveDetails(perpId: Hex, positionId: bigint): Promise<LiveDetails> {
    const { result } = await this.context.walletClient.simulateContract({
      address: this.context.deployments().perpManager,
      abi: PERP_MANAGER_ABI,
      functionName: 'livePositionDetails',
      args: [perpId, positionId],
      account: this.context.walletClient.account,
    });

    return {
      pnl: scaleFrom6Decimals(Number(result[0])),
      fundingPayment: scaleFrom6Decimals(Number(result[1])),
      effectiveMargin: scaleFrom6Decimals(Number(result[2])),
      isLiquidatable: result[3],
    };
  }

  // Public API methods - these are the main entry points
  async getPerpData(perpId: Hex): Promise<PerpData> {
    return await this.fetchPerpData(perpId);
  }

  async getUserData(walletAddress?: Hex): Promise<UserData> {
    const address = walletAddress || this.context.walletClient.account?.address as Hex;
    if (!address) throw new Error("Wallet address not provided and no account found");
    
    return await this.fetchUserData(address);
  }

  async getOpenPositionData(perpId: Hex, positionId: bigint): Promise<OpenPositionData> {
    const liveDetails = await this.fetchPositionLiveDetails(perpId, positionId);
    return {
      perpId,
      positionId,
      liveDetails,
    };
  }

  // Batch operations
  async getMultiplePerpData(perpIds: Hex[]): Promise<PerpData[]> {
    return Promise.all(perpIds.map(id => this.getPerpData(id)));
  }

  // Access to underlying context for write operations
  getContext(): PerpCityContext {
    return this.context;
  }
}