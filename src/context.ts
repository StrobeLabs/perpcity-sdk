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
import {
  readMakerDetails,
  readPerpView,
  readPosition,
  readPositionPreview,
  readRates,
} from "./functions/views";
import type { PerpAddress, PerpCityContextConfig, PerpCityDeployments } from "./types";
import type {
  MarginRatiosE6,
  OpenPositionData,
  PerpConfig,
  PerpData,
  PositionPreview,
  PositionRawData,
  UserData,
} from "./types/entity-data";
import { scaleFromX96 } from "./utils/conversions";
import { withErrorHandling } from "./utils/errors";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

function unpackInt128(value: bigint): bigint {
  const mask = (1n << 128n) - 1n;
  const sign = 1n << 127n;
  const raw = value & mask;
  return raw >= sign ? raw - (1n << 128n) : raw;
}

/** Split a Uniswap v4 BalanceDelta into signed amount0 (perp) and amount1 (USD). */
export function unpackBalanceDelta(delta: bigint): { amount0: bigint; amount1: bigint } {
  return {
    amount0: unpackInt128(delta >> 128n),
    amount1: unpackInt128(delta),
  };
}

const ratios = ([init, liq, backstop]: readonly [number, number, number]): MarginRatiosE6 => ({
  init,
  liq,
  backstop,
});

export class PerpCityContext {
  public readonly walletClient;
  public readonly publicClient: PublicClient;
  public readonly rpcUrl: string;
  private readonly _deployments: PerpCityDeployments;
  private readonly configCache: TTLCache<Address, PerpConfig>;

  constructor(config: PerpCityContextConfig) {
    this.configCache = new TTLCache({ ttl: 5 * 60 * 1000 });
    this.walletClient = config.walletClient;
    this.rpcUrl = config.rpcUrl;

    if (!config.walletClient.chain?.id) {
      throw new Error(
        "PerpCityContext: walletClient.chain must be defined with a numeric id. " +
          "Ensure your walletClient was created with a chain parameter."
      );
    }

    // batch.multicall aggregates concurrent readContract/call requests into a
    // single Multicall3 aggregate3 eth_call (one billed RPC request). The
    // transport-level batch stays for the requests multicall cannot aggregate
    // (simulateContract, calls with an account/value, opted-out probes).
    this.publicClient = createPublicClient({
      chain: config.walletClient.chain,
      transport: http(config.rpcUrl, { batch: true }),
      batch: { multicall: true },
    });

    this._deployments = config.deployments;
  }

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

  /**
   * Static market configuration. Cached for 5 minutes: the governor can swap
   * modules and the owner can change latency, so do not cache it longer.
   */
  async getPerpConfig(perpAddress: PerpAddress): Promise<PerpConfig> {
    const cached = this.configCache.get(perpAddress);
    if (cached) return cached;

    return withErrorHandling(async () => {
      const c = this.publicClient;
      // One Multicall3 eth_call (batch.multicall), not ten requests.
      const [
        key,
        modules,
        protocolFeeManager,
        protocolFee,
        emaWindow,
        latency,
        poolId,
        owner,
        governor,
        withdrawalController,
      ] = await Promise.all([
        readPerpView(c, perpAddress, "poolKey"),
        readPerpView(c, perpAddress, "modules"),
        readPerpView(c, perpAddress, "protocolFeeManager"),
        readPerpView(c, perpAddress, "protocolFee"),
        readPerpView(c, perpAddress, "emaWindow"),
        readPerpView(c, perpAddress, "latency"),
        readPerpView(c, perpAddress, "poolId"),
        readPerpView(c, perpAddress, "owner"),
        readPerpView(c, perpAddress, "governor"),
        readPerpView(c, perpAddress, "withdrawalController"),
      ]);

      if (!key || key.currency0 === ZERO_ADDRESS) {
        throw new Error(`Perp address ${perpAddress} not found or invalid`);
      }

      const cfg: PerpConfig = {
        key: {
          currency0: key.currency0,
          currency1: key.currency1,
          fee: Number(key.fee),
          tickSpacing: Number(key.tickSpacing),
          hooks: key.hooks,
        },
        owner,
        governor,
        beacon: modules.beacon,
        fees: modules.fees,
        funding: modules.funding,
        marginRatios: modules.marginRatios,
        priceImpact: modules.priceImpact,
        pricing: modules.pricing,
        protocolFeeManager,
        withdrawalController: withdrawalController as Address,
        protocolFeeE6: protocolFee,
        emaWindow: Number(emaWindow),
        latency: Number(latency),
        poolId: poolId as Hex,
      };

      this.configCache.set(perpAddress, cfg);
      return cfg;
    }, `getPerpConfig for perp ${perpAddress}`);
  }

  /** Live market state: pool, cached rates, margin ratios, fee bounds, OI and TVL. */
  async getPerpData(perpAddress: PerpAddress): Promise<PerpData> {
    return withErrorHandling(async () => {
      const cfg = await this.getPerpConfig(perpAddress);
      const c = this.publicClient;
      const [
        poolState,
        rates,
        takerRatios,
        makerRatios,
        liqFee,
        maxSwapFee,
        oi,
        tvlCap,
        accountedTvl,
      ] = await Promise.all([
        readPerpView(c, perpAddress, "poolState"),
        readRates(c, perpAddress),
        c.readContract({
          address: cfg.marginRatios,
          abi: MARGIN_RATIOS_ABI,
          functionName: "takerMarginRatios",
        }),
        c.readContract({
          address: cfg.marginRatios,
          abi: MARGIN_RATIOS_ABI,
          functionName: "makerMarginRatios",
        }),
        c.readContract({ address: cfg.fees, abi: FEES_ABI, functionName: "liqFee" }),
        c.readContract({ address: cfg.fees, abi: FEES_ABI, functionName: "maxSwapFee" }),
        readPerpView(c, perpAddress, "openInterest"),
        readPerpView(c, perpAddress, "tvlCap"),
        readPerpView(c, perpAddress, "accountedTvl"),
      ]);
      const [tick, sqrtPriceX96, ammPriceX96, liquidity] = poolState;

      return {
        id: perpAddress,
        tickSpacing: cfg.key.tickSpacing,
        tick: Number(tick),
        sqrtPriceX96,
        ammPrice: scaleFromX96(ammPriceX96),
        lastMark: scaleFromX96(rates.lastMark),
        liquidity,
        beacon: cfg.beacon,
        rates,
        takerMarginRatios: ratios(takerRatios),
        makerMarginRatios: ratios(makerRatios),
        fees: {
          liquidationFee: Number(liqFee) / 1e6,
          protocolFee: Number(cfg.protocolFeeE6) / 1e6,
          maxSwapFee: Number(maxSwapFee) / 1e6,
        },
        openInterest: { long: oi.long, short: oi.short },
        tvlCap,
        accountedTvl,
      };
    }, `getPerpData for perp ${perpAddress}`);
  }

  async getUserData(
    userAddress: Address,
    positions: Array<{ perpId: PerpAddress; positionId: bigint; isLong: boolean; isMaker: boolean }>
  ): Promise<UserData> {
    const usdcBalance = await this.publicClient.readContract({
      address: this.deployments().usdc,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [userAddress],
    });
    return {
      walletAddress: userAddress as Hex,
      usdcBalance: Number(formatUnits(usdcBalance, 6)),
      openPositions: positions.map(({ perpId, positionId, isLong, isMaker }) => ({
        perpId,
        positionId,
        isLong,
        isMaker,
      })),
    };
  }

  async getOpenPositionData(
    perpAddress: PerpAddress,
    positionId: bigint,
    isLong: boolean,
    isMaker: boolean
  ): Promise<OpenPositionData> {
    // Existence guard: throws when no active owner is recorded.
    await this.getPositionRawData(perpAddress, positionId);
    return { perpId: perpAddress, positionId, isLong, isMaker };
  }

  /**
   * Position balances and range. Throws when the position has no active owner
   * (never opened, closed, or fully liquidated): v1 clears `positionOwner` on
   * a full close.
   */
  async getPositionRawData(perpAddress: PerpAddress, positionId: bigint): Promise<PositionRawData> {
    return withErrorHandling(async () => {
      const c = this.publicClient;
      const [owner, position, maker] = await Promise.all([
        readPerpView(c, perpAddress, "positionOwner", [positionId]),
        readPosition(c, perpAddress, positionId),
        readMakerDetails(c, perpAddress, positionId),
      ]);
      if (owner === ZERO_ADDRESS) {
        throw new Error(`Position ${positionId} does not exist or is closed`);
      }

      const delta = unpackBalanceDelta(position.delta);
      return {
        perpId: perpAddress,
        positionId,
        owner,
        margin: Number(formatUnits(position.margin, 6)),
        perpDelta: delta.amount0,
        usdDelta: delta.amount1,
        makerDetails:
          maker.liquidity !== 0n
            ? {
                tickLower: maker.tickLower,
                tickUpper: maker.tickUpper,
                liquidity: maker.liquidity,
              }
            : null,
      };
    }, `getPositionRawData for position ${positionId}`);
  }

  /** The contract's `previewPosition`: equity, PnL, pending funding and health now. */
  async getPositionPreview(perpAddress: PerpAddress, positionId: bigint): Promise<PositionPreview> {
    return withErrorHandling(
      () => readPositionPreview(this.publicClient, perpAddress, positionId),
      `getPositionPreview for position ${positionId}`
    );
  }
}
