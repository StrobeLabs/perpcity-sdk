import TTLCache from "@isaacs/ttlcache";
import {
  type Address,
  createPublicClient,
  erc20Abi,
  formatUnits,
  type Hex,
  http,
  type PublicClient,
} from "viem";
import { FEES_ABI } from "./abis/fees";
import { MARGIN_RATIOS_ABI } from "./abis/margin-ratios";
import { PERP_MANAGER_ABI } from "./abis/perp-manager";
import type { PerpCityContextConfig, PerpCityDeployments } from "./types";
import type {
  Bounds,
  Fees,
  LiveDetails,
  OpenPositionData,
  PerpConfig,
  PerpData,
  PositionRawData,
  UserData,
} from "./types/entity-data";
import { marginRatioToLeverage, sqrtPriceX96ToPrice } from "./utils";
import { withErrorHandling } from "./utils/errors";

export class PerpCityContext {
  public readonly walletClient;
  public readonly publicClient: PublicClient;
  private readonly _deployments: PerpCityDeployments;
  private readonly configCache: TTLCache<Hex, PerpConfig>;

  constructor(config: PerpCityContextConfig) {
    this.configCache = new TTLCache({ ttl: 5 * 60 * 1000 });
    this.walletClient = config.walletClient;

    // Validate walletClient.chain exists
    if (!config.walletClient.chain?.id) {
      throw new Error(
        "PerpCityContext: walletClient.chain must be defined with a numeric id. " +
          "Ensure your walletClient was created with a chain parameter."
      );
    }

    // Create publicClient with HTTP transport and batching enabled
    this.publicClient = createPublicClient({
      chain: config.walletClient.chain,
      transport: http(config.rpcUrl, { batch: true }),
    });

    this._deployments = config.deployments;
  }

  /**
   * Validates that the RPC endpoint matches the expected chain.
   * Call this after construction to verify configuration.
   * @throws Error if RPC chain ID doesn't match walletClient chain ID
   */
  async validateChainId(): Promise<void> {
    const rpcChainId = await this.publicClient.getChainId();
    const expectedChainId = this.walletClient.chain!.id;

    if (rpcChainId !== expectedChainId) {
      throw new Error(
        `PerpCityContext: RPC chain mismatch. ` +
          `RPC returned chain ID ${rpcChainId}, but walletClient expects chain ID ${expectedChainId}. ` +
          `Ensure rpcUrl corresponds to the correct network.`
      );
    }
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
    const result = await this.publicClient.readContract({
      address: this.deployments().perpManager,
      abi: PERP_MANAGER_ABI,
      functionName: "cfgs",
      args: [perpId],
    });

    // Viem returns outer tuple as array, inner tuples as objects with named properties
    const resultArray = result as unknown as any[];
    const keyData = resultArray[0];

    // Validate that perpId exists - contract returns empty values for non-existent perps
    if (
      !keyData ||
      keyData.tickSpacing === 0 ||
      keyData.currency0 === "0x0000000000000000000000000000000000000000"
    ) {
      throw new Error(`Perp ID ${perpId} not found or invalid`);
    }

    const cfg: PerpConfig = {
      key: {
        currency0: keyData.currency0 as Address,
        currency1: keyData.currency1 as Address,
        fee: Number(keyData.fee),
        tickSpacing: Number(keyData.tickSpacing),
        hooks: keyData.hooks as Address,
      },
      creator: resultArray[1] as Address,
      vault: resultArray[2] as Address,
      beacon: resultArray[3] as Address,
      fees: resultArray[4] as Address,
      marginRatios: resultArray[5] as Address,
      lockupPeriod: resultArray[6] as Address,
      sqrtPriceImpactLimit: resultArray[7] as Address,
    };

    // Store in cache
    this.configCache.set(perpId, cfg);

    return cfg;
  }

  private async fetchPerpContractData(
    perpId: Hex,
    markPrice?: number
  ): Promise<{
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
        sqrtPriceX96 = BigInt(Math.floor(sqrtPrice * 2 ** 96));
      } else {
        // Fallback to TWAP with 1 second lookback
        sqrtPriceX96 = (await this.publicClient.readContract({
          address: this.deployments().perpManager,
          abi: PERP_MANAGER_ABI,
          functionName: "timeWeightedAvgSqrtPriceX96",
          args: [perpId, 1],
        })) as bigint;
      }

      // Fetch bounds and fees from module contracts in parallel
      const [
        minTakerRatio,
        maxTakerRatio,
        liquidationTakerRatio,
        creatorFee,
        insuranceFee,
        lpFee,
        liquidationFee,
      ] = await Promise.all([
        this.publicClient.readContract({
          address: cfg.marginRatios,
          abi: MARGIN_RATIOS_ABI,
          functionName: "MIN_TAKER_RATIO",
        }),
        this.publicClient.readContract({
          address: cfg.marginRatios,
          abi: MARGIN_RATIOS_ABI,
          functionName: "MAX_TAKER_RATIO",
        }),
        this.publicClient.readContract({
          address: cfg.marginRatios,
          abi: MARGIN_RATIOS_ABI,
          functionName: "LIQUIDATION_TAKER_RATIO",
        }),
        this.publicClient.readContract({
          address: cfg.fees,
          abi: FEES_ABI,
          functionName: "CREATOR_FEE",
        }),
        this.publicClient.readContract({
          address: cfg.fees,
          abi: FEES_ABI,
          functionName: "INSURANCE_FEE",
        }),
        this.publicClient.readContract({
          address: cfg.fees,
          abi: FEES_ABI,
          functionName: "LP_FEE",
        }),
        this.publicClient.readContract({
          address: cfg.fees,
          abi: FEES_ABI,
          functionName: "LIQUIDATION_FEE",
        }),
      ]);

      // Convert margin ratios to leverage bounds
      // Margin ratio is scaled by 1e6, where ratio = margin / notional
      // Leverage = notional / margin = 1 / ratio
      const minTakerLeverage = marginRatioToLeverage(Number(maxTakerRatio)); // Note: max ratio -> min leverage
      const maxTakerLeverage = marginRatioToLeverage(Number(minTakerRatio)); // Note: min ratio -> max leverage

      // Convert fees from scaled uint24 (1e6) to decimal percentages
      const scaleFee = (fee: number) => fee / 1e6;

      return {
        tickSpacing,
        sqrtPriceX96,
        bounds: {
          minMargin: 10, // Still hardcoded - not available from margin ratios module
          minTakerLeverage,
          maxTakerLeverage,
          liquidationTakerRatio: Number(liquidationTakerRatio) / 1e6,
        },
        fees: {
          creatorFee: scaleFee(Number(creatorFee)),
          insuranceFee: scaleFee(Number(insuranceFee)),
          lpFee: scaleFee(Number(lpFee)),
          liquidationFee: scaleFee(Number(liquidationFee)),
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
    const usdcBalance = await this.publicClient.readContract({
      address: this.deployments().usdc,
      abi: erc20Abi,
      functionName: "balanceOf",
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

  private async fetchPositionLiveDetailsFromContract(
    _perpId: Hex,
    positionId: bigint
  ): Promise<LiveDetails> {
    return withErrorHandling(async () => {
      // Use quoteClosePosition which provides live position details
      const result = (await this.publicClient.readContract({
        address: this.deployments().perpManager,
        abi: PERP_MANAGER_ABI,
        functionName: "quoteClosePosition" as any,
        args: [positionId],
      })) as unknown as readonly [Hex, bigint, bigint, bigint, boolean];

      // The result is a tuple: [unexpectedReason, pnl, funding, netMargin, wasLiquidated]
      const [unexpectedReason, pnl, funding, netMargin, wasLiquidated] = result;

      if (unexpectedReason !== "0x") {
        throw new Error(
          `Failed to quote position ${positionId} - position may be invalid or already closed`
        );
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

  /**
   * Fetch raw position data from the contract
   * This includes entry price data, margin, and position size needed for calculations
   * @param positionId - The position ID
   */
  async getPositionRawData(positionId: bigint): Promise<PositionRawData> {
    return withErrorHandling(async () => {
      const result = await this.publicClient.readContract({
        address: this.deployments().perpManager,
        abi: PERP_MANAGER_ABI,
        functionName: "positions",
        args: [positionId],
      });

      // The result is a tuple matching the Position struct:
      // [perpId, margin, entryPerpDelta, entryUsdDelta, entryCumlFundingX96,
      //  entryCumlBadDebtX96, entryCumlUtilizationX96, marginRatios, makerDetails]
      const resultArray = result as unknown as readonly [
        Hex, // perpId
        bigint, // margin
        bigint, // entryPerpDelta
        bigint, // entryUsdDelta
        bigint, // entryCumlFundingX96
        bigint, // entryCumlBadDebtX96
        bigint, // entryCumlUtilizationX96
        { min: number; max: number; liq: number }, // marginRatios
        unknown, // makerDetails (not needed for now)
      ];

      const [perpId, margin, entryPerpDelta, entryUsdDelta, , , , marginRatios] = resultArray;

      // Check if position exists (non-existent positions have zero perpId)
      const zeroPerpId = `0x${"0".repeat(64)}` as Hex;
      if (perpId === zeroPerpId) {
        throw new Error(`Position ${positionId} does not exist`);
      }

      return {
        perpId,
        positionId,
        margin: Number(formatUnits(margin, 6)),
        entryPerpDelta,
        entryUsdDelta,
        marginRatios: {
          min: Number(marginRatios.min),
          max: Number(marginRatios.max),
          liq: Number(marginRatios.liq),
        },
      };
    }, `getPositionRawData for position ${positionId}`);
  }
}
