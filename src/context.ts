import { GraphQLClient } from 'graphql-request'
import { publicActions, formatUnits } from "viem";
import { PerpCityContextConfig, PerpCityDeployments } from "./types";
import { TypedDocumentNode } from "@graphql-typed-document-node/core";
import { parse } from "graphql";
import { Address, Hex } from "viem";
import { PerpData, UserData, OpenPositionData, LiveDetails, ClosedPosition, OpenInterest, TimeSeries, Bounds, Fees } from "./types/entity-data";
import { scaleFrom6Decimals, sqrtPriceX96ToPrice, marginRatioToLeverage } from "./utils";
import { withErrorHandling, GraphQLError, RPCError } from "./utils/errors";
import { PERP_MANAGER_ABI } from "./abis/perp-manager";
import { erc20Abi } from "viem";

export class PerpCityContext {
  public readonly walletClient;
  public readonly goldskyClient: GraphQLClient;
  private readonly _deployments: PerpCityDeployments;

  constructor(config: PerpCityContextConfig) {
    this.walletClient = config.walletClient.extend(publicActions);
    this._deployments = config.deployments;

    const headers: Record<string, string> = {};
    
    if (config.goldskyBearerToken) {
      headers.authorization = `Bearer ${config.goldskyBearerToken}`;
    }
    
    this.goldskyClient = new GraphQLClient(config.goldskyEndpoint, {
      headers,
    });
  }

  deployments(): PerpCityDeployments {
    return this._deployments;
  }

  // Optimized batch data fetching methods

  private async fetchPerpData(perpId: Hex): Promise<PerpData> {
    return withErrorHandling(async () => {
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

      let perpResponse: any;
      try {
        // Execute first query to get beacon address
        perpResponse = await this.goldskyClient.request(perpQuery, { perpId });
      } catch (error) {
        throw new GraphQLError(`Failed to fetch perp data for ${perpId}: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error : undefined);
      }

      if (!perpResponse.perp || !perpResponse.perp.beacon) {
        throw new GraphQLError(`Perp ${perpId} not found or has no beacon`);
      }

      let beaconResponse: any;
      let contractData: Awaited<ReturnType<typeof this.fetchPerpContractData>>;

      try {
        // Execute remaining queries in parallel
        [beaconResponse, contractData] = await Promise.all([
          this.goldskyClient.request(beaconQuery, { beaconAddr: perpResponse.perp.beacon.id }),
          this.fetchPerpContractData(perpId),
        ]);
      } catch (error) {
        if (error instanceof GraphQLError || error instanceof RPCError) {
          throw error;
        }
        throw new GraphQLError(`Failed to fetch beacon or contract data: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error : undefined);
      }

      // Guard against empty snapshots for new perps
      if (perpResponse.perpSnapshots.length === 0) {
        throw new GraphQLError(`No perpSnapshots found for perp ${perpId}. This perp may be newly created with no trading activity yet.`);
      }
      if ((beaconResponse as any).beaconSnapshots.length === 0) {
        throw new GraphQLError(`No beaconSnapshots found for perp ${perpId} beacon ${perpResponse.perp.beacon.id}. The beacon may not have any price updates yet.`);
      }

      // Process time series data
      const markTimeSeries: TimeSeries<number>[] = perpResponse.perpSnapshots.map((snapshot: any) => ({
        timestamp: Number(snapshot.timestamp),
        value: Number(formatUnits(BigInt(snapshot.markPrice), 6)),
      }));

      const indexTimeSeries: TimeSeries<number>[] = (beaconResponse as any).beaconSnapshots.map((snapshot: any) => ({
        timestamp: Number(snapshot.timestamp),
        value: Number(formatUnits(BigInt(snapshot.indexPrice), 6)),
      }));

      const openInterestTimeSeries: TimeSeries<OpenInterest>[] = perpResponse.perpSnapshots.map((snapshot: any) => ({
        timestamp: Number(snapshot.timestamp),
        value: {
          takerLongNotional: Number(formatUnits(BigInt(snapshot.takerLongNotional), 6)),
          takerShortNotional: Number(formatUnits(BigInt(snapshot.takerShortNotional), 6)),
        },
      }));

      const fundingRateTimeSeries: TimeSeries<number>[] = perpResponse.perpSnapshots.map((snapshot: any) => ({
        timestamp: Number(snapshot.timestamp),
        value: Number(formatUnits(BigInt(snapshot.fundingRate), 6)),
      }));

      // Get latest values (safe after guard check)
      const latestSnapshot = perpResponse.perpSnapshots[perpResponse.perpSnapshots.length - 1];
      const latestBeaconSnapshot = (beaconResponse as any).beaconSnapshots[(beaconResponse as any).beaconSnapshots.length - 1];

      const perpData: PerpData = {
        id: perpId,
        tickSpacing: contractData.tickSpacing,
        mark: sqrtPriceX96ToPrice(contractData.sqrtPriceX96),
        index: Number(formatUnits(BigInt(latestBeaconSnapshot.indexPrice), 6)),
        beacon: perpResponse.perp.beacon.id as Address,
        lastIndexUpdate: Number(latestBeaconSnapshot.timestamp),
        openInterest: {
          takerLongNotional: Number(formatUnits(BigInt(latestSnapshot.takerLongNotional), 6)),
          takerShortNotional: Number(formatUnits(BigInt(latestSnapshot.takerShortNotional), 6)),
        },
        markTimeSeries,
        indexTimeSeries,
        fundingRate: Number(formatUnits(BigInt(latestSnapshot.fundingRate), 6)),
        bounds: contractData.bounds,
        fees: contractData.fees,
        openInterestTimeSeries,
        fundingRateTimeSeries,
        totalOpenMakerPnl: 0, // These will be calculated by functions
        totalOpenTakerPnl: 0, // These will be calculated by functions
      };

      return perpData;
    }, `fetchPerpData for perp ${perpId}`);
  }

  private async fetchPerpContractData(perpId: Hex): Promise<{
    tickSpacing: number;
    sqrtPriceX96: bigint;
    bounds: Bounds;
    fees: Fees;
  }> {
    return withErrorHandling(async () => {
      const [tickSpacing, sqrtPriceX96, boundsRaw, feesRaw] = await Promise.all([
        this.walletClient.readContract({
          address: this.deployments().perpManager,
          abi: PERP_MANAGER_ABI,
          functionName: 'tickSpacing',
          args: [perpId]
        }),
        this.walletClient.readContract({
          address: this.deployments().perpManager,
          abi: PERP_MANAGER_ABI,
          functionName: 'sqrtPriceX96',
          args: [perpId]
        }),
        this.walletClient.readContract({
          address: this.deployments().perpManager,
          abi: PERP_MANAGER_ABI,
          functionName: 'tradingBounds',
          args: [perpId]
        }),
        this.walletClient.readContract({
          address: this.deployments().perpManager,
          abi: PERP_MANAGER_ABI,
          functionName: 'fees',
          args: [perpId]
        }),
      ]);

      const bounds = boundsRaw as unknown as readonly [bigint, bigint, bigint, bigint, bigint, bigint, bigint];
      const fees = feesRaw as unknown as readonly [bigint, bigint, bigint, bigint];

      return {
        tickSpacing: Number(tickSpacing),
        sqrtPriceX96: sqrtPriceX96 as bigint,
        bounds: {
          minMargin: Number(formatUnits(bounds[0], 6)),
          minTakerLeverage: marginRatioToLeverage(Number(formatUnits(bounds[4], 6))),
          maxTakerLeverage: marginRatioToLeverage(Number(formatUnits(bounds[5], 6))),
        },
        fees: {
          creatorFee: Number(formatUnits(fees[0], 6)),
          insuranceFee: Number(formatUnits(fees[1], 6)),
          lpFee: Number(formatUnits(fees[2], 6)),
          liquidationFee: Number(formatUnits(fees[3], 6)),
        },
      };
    }, `fetchPerpContractData for perp ${perpId}`);
  }

  /**
   * Fetch comprehensive perp data with all related information in a single batched request
   */
  async getPerpData(perpId: Hex): Promise<PerpData> {
    return this.fetchPerpData(perpId);
  }

  /**
   * Fetch data for multiple perps efficiently with true batching
   * This fetches all perps in just 2 Goldsky requests total (not 2N!)
   */
  async getMultiplePerpData(perpIds: Hex[]): Promise<Map<Hex, PerpData>> {
    if (perpIds.length === 0) {
      return new Map();
    }

    // If only one perp, use the single fetch method
    if (perpIds.length === 1) {
      const data = await this.fetchPerpData(perpIds[0]);
      return new Map([[perpIds[0], data]]);
    }

    // Batch query for all perps and their snapshots
    const batchPerpQuery: TypedDocumentNode<{
      perps: {
        id: Hex;
        beacon: { id: Hex };
      }[];
      perpSnapshots: {
        perp: { id: Hex };
        timestamp: BigInt;
        markPrice: string;
        takerLongNotional: string;
        takerShortNotional: string;
        fundingRate: string;
      }[];
    }, { perpIds: Hex[] }> = parse(`
      query ($perpIds: [Bytes!]!) {
        perps(where: { id_in: $perpIds }) {
          id
          beacon { id }
        }
        perpSnapshots(
          orderBy: timestamp
          orderDirection: asc
          where: { perp_in: $perpIds }
        ) {
          perp { id }
          timestamp
          markPrice
          takerLongNotional
          takerShortNotional
          fundingRate
        }
      }
    `);

    // Execute first query to get all perps and snapshots
    const perpResponse: any = await this.goldskyClient.request(batchPerpQuery, { perpIds });

    // Extract unique beacon IDs
    const beaconIds = [...new Set(perpResponse.perps.map((p: any) => p.beacon.id as Address))];

    // Batch query for all unique beacons
    const batchBeaconQuery: TypedDocumentNode<{
      beaconSnapshots: {
        beacon: { id: Hex };
        timestamp: BigInt;
        indexPrice: string;
      }[];
    }, { beaconIds: Address[] }> = parse(`
      query ($beaconIds: [Bytes!]!) {
        beaconSnapshots(
          orderBy: timestamp
          orderDirection: asc
          where: { beacon_in: $beaconIds }
        ) {
          beacon { id }
          timestamp
          indexPrice
        }
      }
    `);

    // Fetch beacon data and contract data in parallel
    const [beaconResponse, contractDataMap] = await Promise.all([
      this.goldskyClient.request(batchBeaconQuery, { beaconIds: beaconIds as any }),
      this.fetchMultiplePerpContractData(perpIds),
    ]);

    // Group snapshots by perp ID
    const snapshotsByPerp = new Map<Hex, any[]>();
    perpResponse.perpSnapshots.forEach((snapshot: any) => {
      const perpId = snapshot.perp.id as Hex;
      if (!snapshotsByPerp.has(perpId)) {
        snapshotsByPerp.set(perpId, []);
      }
      snapshotsByPerp.get(perpId)!.push(snapshot);
    });

    // Group beacon snapshots by beacon ID
    const snapshotsByBeacon = new Map<Address, any[]>();
    (beaconResponse as any).beaconSnapshots.forEach((snapshot: any) => {
      const beaconId = snapshot.beacon.id as Address;
      if (!snapshotsByBeacon.has(beaconId)) {
        snapshotsByBeacon.set(beaconId, []);
      }
      snapshotsByBeacon.get(beaconId)!.push(snapshot);
    });

    // Create perp lookup map with proper typing
    const perpLookup = new Map<Hex, { id: Hex; beacon: { id: Address } }>(
      perpResponse.perps.map((p: any) => [
        p.id as Hex,
        p as { id: Hex; beacon: { id: Address } }
      ])
    );

    // Build PerpData for each perp
    const resultMap = new Map<Hex, PerpData>();

    for (const perpId of perpIds) {
      const perp = perpLookup.get(perpId);
      if (!perp) {
        throw new Error(`Perp ${perpId} not found`);
      }

      // Type-safe beacon access
      const beaconId = perp.beacon.id;
      const snapshots = snapshotsByPerp.get(perpId) || [];
      const beaconSnapshots = snapshotsByBeacon.get(beaconId) || [];
      const contractData = contractDataMap.get(perpId);

      if (!contractData) {
        throw new Error(`Contract data for perp ${perpId} not found`);
      }

      if (snapshots.length === 0) {
        throw new Error(`No snapshots found for perp ${perpId}`);
      }

      if (beaconSnapshots.length === 0) {
        throw new Error(`No beacon snapshots found for perp ${perpId}`);
      }

      // Process time series data
      const markTimeSeries: TimeSeries<number>[] = snapshots.map((snapshot: any) => ({
        timestamp: Number(snapshot.timestamp),
        value: Number(formatUnits(BigInt(snapshot.markPrice), 6)),
      }));

      const indexTimeSeries: TimeSeries<number>[] = beaconSnapshots.map((snapshot: any) => ({
        timestamp: Number(snapshot.timestamp),
        value: Number(formatUnits(BigInt(snapshot.indexPrice), 6)),
      }));

      const openInterestTimeSeries: TimeSeries<OpenInterest>[] = snapshots.map((snapshot: any) => ({
        timestamp: Number(snapshot.timestamp),
        value: {
          takerLongNotional: Number(formatUnits(BigInt(snapshot.takerLongNotional), 6)),
          takerShortNotional: Number(formatUnits(BigInt(snapshot.takerShortNotional), 6)),
        },
      }));

      const fundingRateTimeSeries: TimeSeries<number>[] = snapshots.map((snapshot: any) => ({
        timestamp: Number(snapshot.timestamp),
        value: Number(formatUnits(BigInt(snapshot.fundingRate), 6)),
      }));

      // Get latest values
      const latestSnapshot = snapshots[snapshots.length - 1];
      const latestBeaconSnapshot = beaconSnapshots[beaconSnapshots.length - 1];

      const perpData: PerpData = {
        id: perpId,
        tickSpacing: contractData.tickSpacing,
        mark: sqrtPriceX96ToPrice(contractData.sqrtPriceX96),
        index: Number(formatUnits(BigInt(latestBeaconSnapshot.indexPrice), 6)),
        beacon: beaconId,
        lastIndexUpdate: Number(latestBeaconSnapshot.timestamp),
        openInterest: {
          takerLongNotional: Number(formatUnits(BigInt(latestSnapshot.takerLongNotional), 6)),
          takerShortNotional: Number(formatUnits(BigInt(latestSnapshot.takerShortNotional), 6)),
        },
        markTimeSeries,
        indexTimeSeries,
        fundingRate: Number(formatUnits(BigInt(latestSnapshot.fundingRate), 6)),
        bounds: contractData.bounds,
        fees: contractData.fees,
        openInterestTimeSeries,
        fundingRateTimeSeries,
        totalOpenMakerPnl: 0,
        totalOpenTakerPnl: 0,
      };

      resultMap.set(perpId, perpData);
    }

    return resultMap;
  }

  private async fetchMultiplePerpContractData(perpIds: Hex[]): Promise<Map<Hex, {
    tickSpacing: number;
    sqrtPriceX96: bigint;
    bounds: Bounds;
    fees: Fees;
  }>> {
    // Fetch all contract data in parallel
    const results = await Promise.all(
      perpIds.map(async (perpId) => ({
        perpId,
        data: await this.fetchPerpContractData(perpId),
      }))
    );

    return new Map(results.map(({ perpId, data }) => [perpId, data]));
  }

  private async fetchUserData(userAddress: Hex): Promise<UserData> {
    const [usdcBalance, openPositionsData, closedPositionsData] = await Promise.all([
      this.walletClient.readContract({
        address: this.deployments().usdc,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [userAddress],
      }),
      this.fetchUserOpenPositions(userAddress),
      this.fetchUserClosedPositions(userAddress),
    ]);

    const realizedPnl = closedPositionsData.reduce((acc, position) => acc + position.pnlAtClose, 0);
    const unrealizedPnl = openPositionsData.reduce(
      (acc, position) => acc + position.liveDetails.pnl - position.liveDetails.fundingPayment,
      0
    );

    return {
      walletAddress: userAddress,
      usdcBalance: Number(formatUnits(usdcBalance, 6)),
      openPositions: openPositionsData,
      closedPositions: closedPositionsData,
      realizedPnl,
      unrealizedPnl,
    };
  }

  private async fetchUserOpenPositions(userAddress: Hex): Promise<OpenPositionData[]> {
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

    const response: any = await this.goldskyClient.request(query, { holder: userAddress });

    const positionsWithDetails = await Promise.all(
      response.openPositions.map(async (position: any) => {
        // Normalize inContractPosId to bigint (GraphQL returns it as a string)
        const positionId = typeof position.inContractPosId === 'bigint' 
          ? position.inContractPosId 
          : BigInt(position.inContractPosId);
        
        const liveDetails = await this.fetchPositionLiveDetailsFromContract(
          position.perp.id,
          positionId
        );

        return {
          perpId: position.perp.id as Hex,
          positionId,
          isLong: position.isLong as boolean,
          isMaker: position.isMaker as boolean,
          liveDetails,
        };
      })
    );

    return positionsWithDetails;
  }

  private async fetchUserClosedPositions(userAddress: Hex): Promise<ClosedPosition[]> {
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

    const response: any = await this.goldskyClient.request(query, { holder: userAddress });

    return response.closedPositions.map((position: any) => ({
      perpId: position.perp.id as Hex,
      wasMaker: position.wasMaker as boolean,
      wasLong: position.wasLong as boolean,
      pnlAtClose: Number(position.pnlAtClose),
    }));
  }

  private async fetchPositionLiveDetailsFromContract(perpId: Hex, positionId: bigint): Promise<LiveDetails> {
    return withErrorHandling(async () => {
      const publicClient = this.walletClient.extend(publicActions);
      const { result } = await publicClient.simulateContract({
        address: this.deployments().perpManager,
        abi: PERP_MANAGER_ABI,
        functionName: 'livePositionDetails',
        args: [perpId, positionId],
        account: this.walletClient.account,
      });

      // Use formatUnits to safely convert bigint to decimal, then parse to number
      // The result is a tuple: [pnl, fundingPayment, effectiveMargin, isLiquidatable, newPriceX96]
      return {
        pnl: Number(formatUnits(result[0], 6)),
        fundingPayment: Number(formatUnits(result[1], 6)),
        effectiveMargin: Number(formatUnits(result[2], 6)),
        isLiquidatable: result[3],
      };
    }, `fetchPositionLiveDetailsFromContract for position ${positionId}`);
  }

  /**
   * Fetch comprehensive user data with all positions in a single batched request
   */
  async getUserData(userAddress: Hex): Promise<UserData> {
    return this.fetchUserData(userAddress);
  }

  /**
   * Fetch open position data with live details
   */
  async getOpenPositionData(perpId: Hex, positionId: bigint): Promise<OpenPositionData> {
    // First fetch the position metadata from GraphQL
    const query: TypedDocumentNode<{
      openPositions: {
        isLong: boolean;
        isMaker: boolean;
      }[];
    }, { perpId: Hex; posId: string }> = parse(`
      query ($perpId: Bytes!, $posId: BigInt!) {
        openPositions(
          where: { perp: $perpId, inContractPosId: $posId }
          first: 1
        ) {
          isLong
          isMaker
        }
      }
    `);

    const [positionResponse, liveDetails] = await Promise.all([
      this.goldskyClient.request(query, { perpId, posId: positionId.toString() }),
      this.fetchPositionLiveDetailsFromContract(perpId, positionId),
    ]);

    const position = (positionResponse as any).openPositions[0];

    return {
      perpId,
      positionId,
      isLong: position?.isLong,
      isMaker: position?.isMaker,
      liveDetails,
    };
  }
}