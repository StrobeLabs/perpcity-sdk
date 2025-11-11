import { publicActions, formatUnits } from "viem";
import { PerpCityContextConfig, PerpCityDeployments } from "./types";
import { Address, Hex } from "viem";
import { PerpData, UserData, OpenPositionData, LiveDetails, Bounds, Fees, PerpConfig } from "./types/entity-data";
import { scaleFrom6Decimals, sqrtPriceX96ToPrice, marginRatioToLeverage } from "./utils";
import { withErrorHandling } from "./utils/errors";
import { PERP_MANAGER_ABI } from "./abis/perp-manager";
import { erc20Abi } from "viem";

export class PerpCityContext {
  public readonly walletClient;
  private readonly _deployments: PerpCityDeployments;
  private readonly configCache: Map<Hex, PerpConfig>;

  constructor(config: PerpCityContextConfig) {
    this.configCache = new Map();
    this.walletClient = config.walletClient.extend(publicActions);
    this._deployments = config.deployments;
  }

  deployments(): PerpCityDeployments {
    return this._deployments;
  }

  // Optimized batch data fetching methods

  private async fetchPerpData(perpId: Hex): Promise<PerpData> {
    return withErrorHandling(async () => {
      // Fetch contract data only - no historical time series
      const contractData = await this.fetchPerpContractData(perpId);
      const config = await this.getPerpConfig(perpId);

      const perpData: PerpData = {
        id: perpId,
        tickSpacing: contractData.tickSpacing,
        mark: sqrtPriceX96ToPrice(contractData.sqrtPriceX96),
        beacon: config.beacon,
        bounds: contractData.bounds,
        fees: contractData.fees,
      };

      return perpData;
    }, `fetchPerpData for perp ${perpId}`);
  }

  /**
   * Fetches and caches the config for a perpId
   * The config includes module addresses (fees, marginRatios, etc.) and pool settings
   */
  async getPerpConfig(perpId: Hex): Promise<PerpConfig> {
    // Check cache first
    const cached = this.configCache.get(perpId);
    if (cached) {
      return cached;
    }

    // Fetch from contract
    const cfg = await this.walletClient.readContract({
      address: this.deployments().perpManager,
      abi: PERP_MANAGER_ABI,
      functionName: 'cfgs',
      args: [perpId]
    }) as any;

    // Store in cache
    this.configCache.set(perpId, cfg);

    return cfg;
  }

  private async fetchPerpContractData(perpId: Hex, markPrice?: number): Promise<{
    tickSpacing: number;
    sqrtPriceX96: bigint;
    bounds: Bounds;
    fees: Fees;
  }> {
    return withErrorHandling(async () => {
      // Get config from cache or fetch if not cached
      const cfg = await this.getPerpConfig(perpId);

      // Extract tickSpacing from PoolKey
      const tickSpacing = Number(cfg.key.tickSpacing);

      // Calculate sqrtPriceX96 from mark price if available, otherwise use TWAP
      let sqrtPriceX96: bigint;
      if (markPrice) {
        // Convert mark price to sqrtPriceX96 format
        const sqrtPrice = Math.sqrt(markPrice);
        sqrtPriceX96 = BigInt(Math.floor(sqrtPrice * (2 ** 96)));
      } else {
        // Fallback to TWAP with 1 second lookback
        sqrtPriceX96 = await this.walletClient.readContract({
          address: this.deployments().perpManager,
          abi: PERP_MANAGER_ABI,
          functionName: 'timeWeightedAvgSqrtPriceX96',
          args: [perpId, 1]
        }) as bigint;
      }

      // NOTE: Deployed contracts use modular architecture where fees and margin ratios
      // are in separate contracts (cfg.fees, cfg.marginRatios addresses).
      // We don't have ABIs for those modules, so using placeholder values.
      // These will be removed in PR 2 when Goldsky is removed.
      return {
        tickSpacing,
        sqrtPriceX96,
        bounds: {
          minMargin: 10, // Placeholder - would need to call cfg.marginRatios contract
          minTakerLeverage: 1.1,
          maxTakerLeverage: 20,
        },
        fees: {
          creatorFee: 0.0001, // Placeholder - would need to call cfg.fees contract
          insuranceFee: 0.0001,
          lpFee: 0.0003,
          liquidationFee: 0.01,
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


  private async fetchUserData(
    userAddress: Hex,
    positions: Array<{ perpId: Hex; positionId: bigint; isLong: boolean; isMaker: boolean }>
  ): Promise<UserData> {
    const usdcBalance = await this.walletClient.readContract({
      address: this.deployments().usdc,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [userAddress],
    });

    // Fetch live details for all positions in parallel
    const openPositionsData = await Promise.all(
      positions.map(async ({ perpId, positionId, isLong, isMaker }) => {
        const liveDetails = await this.fetchPositionLiveDetailsFromContract(perpId, positionId);
        return {
          perpId,
          positionId,
          isLong,
          isMaker,
          liveDetails,
        };
      })
    );

    return {
      walletAddress: userAddress,
      usdcBalance: Number(formatUnits(usdcBalance, 6)),
      openPositions: openPositionsData,
    };
  }


  private async fetchPositionLiveDetailsFromContract(perpId: Hex, positionId: bigint): Promise<LiveDetails> {
    return withErrorHandling(async () => {
      // Use quoteClosePosition which provides live position details
      const result = (await this.walletClient.readContract({
        address: this.deployments().perpManager,
        abi: PERP_MANAGER_ABI,
        functionName: 'quoteClosePosition' as any,
        args: [positionId],
      }) as unknown) as readonly [boolean, bigint, bigint, bigint, boolean];

      // The result is a tuple: [success, pnl, funding, netMargin, wasLiquidated]
      const [success, pnl, funding, netMargin, wasLiquidated] = result;

      if (!success) {
        throw new Error(`Failed to quote position ${positionId} - position may be invalid or already closed`);
      }

      return {
        pnl: Number(formatUnits(pnl, 6)),
        fundingPayment: Number(formatUnits(funding, 6)),
        effectiveMargin: Number(formatUnits(netMargin, 6)),
        isLiquidatable: wasLiquidated,
      };
    }, `fetchPositionLiveDetailsFromContract for position ${positionId}`);
  }

  /**
   * Fetch comprehensive user data with live details for all positions
   * @param userAddress - The user's wallet address
   * @param positions - Array of position metadata (perpId, positionId, isLong, isMaker) tracked from transaction receipts
   */
  async getUserData(
    userAddress: Hex,
    positions: Array<{ perpId: Hex; positionId: bigint; isLong: boolean; isMaker: boolean }>
  ): Promise<UserData> {
    return this.fetchUserData(userAddress, positions);
  }

  /**
   * Fetch open position data with live details
   * @param perpId - The perpetual market ID
   * @param positionId - The position ID
   * @param isLong - Whether the position is long (true) or short (false)
   * @param isMaker - Whether the position is a maker (LP) position
   */
  async getOpenPositionData(
    perpId: Hex,
    positionId: bigint,
    isLong: boolean,
    isMaker: boolean
  ): Promise<OpenPositionData> {
    const liveDetails = await this.fetchPositionLiveDetailsFromContract(perpId, positionId);

    return {
      perpId,
      positionId,
      isLong,
      isMaker,
      liveDetails,
    };
  }
}