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
import { PERP_ABI } from "./abis/perp";
import type { PerpAddress, PerpCityContextConfig, PerpCityDeployments } from "./types";
import type {
  Bounds,
  Fees,
  OpenPositionData,
  PerpConfig,
  PerpData,
  PositionRawData,
  UserData,
} from "./types/entity-data";
import { marginRatioToLeverage, scaleFromX96 } from "./utils";
import { withErrorHandling } from "./utils/errors";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

function unpackInt128(value: bigint): bigint {
  const mask = (1n << 128n) - 1n;
  const sign = 1n << 127n;
  const raw = value & mask;
  return raw >= sign ? raw - (1n << 128n) : raw;
}

export function unpackBalanceDelta(delta: bigint): { amount0: bigint; amount1: bigint } {
  return {
    amount0: unpackInt128(delta >> 128n),
    amount1: unpackInt128(delta),
  };
}

export class PerpCityContext {
  public readonly walletClient;
  public readonly publicClient: PublicClient;
  private readonly _deployments: PerpCityDeployments;
  private readonly configCache: TTLCache<Address, PerpConfig>;

  constructor(config: PerpCityContextConfig) {
    this.configCache = new TTLCache({ ttl: 5 * 60 * 1000 });
    this.walletClient = config.walletClient;

    if (!config.walletClient.chain?.id) {
      throw new Error(
        "PerpCityContext: walletClient.chain must be defined with a numeric id. " +
          "Ensure your walletClient was created with a chain parameter."
      );
    }

    this.publicClient = createPublicClient({
      chain: config.walletClient.chain,
      transport: http(config.rpcUrl, { batch: true }),
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

  async getPerpConfig(perpAddress: PerpAddress): Promise<PerpConfig> {
    const cached = this.configCache.get(perpAddress);
    if (cached) return cached;

    const [key, modules, protocolFeeManager, protocolFee, emaWindow, poolId, owner] =
      await Promise.all([
        this.publicClient.readContract({
          address: perpAddress,
          abi: PERP_ABI,
          functionName: "poolKey",
        }),
        this.publicClient.readContract({
          address: perpAddress,
          abi: PERP_ABI,
          functionName: "modules",
        }),
        this.publicClient.readContract({
          address: perpAddress,
          abi: PERP_ABI,
          functionName: "PROTOCOL_FEE_MANAGER",
        }),
        this.publicClient.readContract({
          address: perpAddress,
          abi: PERP_ABI,
          functionName: "protocolFee",
        }),
        this.publicClient.readContract({
          address: perpAddress,
          abi: PERP_ABI,
          functionName: "EMA_WINDOW",
        }),
        this.publicClient.readContract({
          address: perpAddress,
          abi: PERP_ABI,
          functionName: "POOL_ID",
        }),
        this.publicClient.readContract({
          address: perpAddress,
          abi: PERP_ABI,
          functionName: "owner",
        }),
      ]);

    if (!key || key.currency0 === ZERO_ADDRESS) {
      throw new Error(`Perp address ${perpAddress} not found or invalid`);
    }

    const cfg: PerpConfig = {
      key: {
        currency0: key.currency0 as Address,
        currency1: key.currency1 as Address,
        fee: Number(key.fee),
        tickSpacing: Number(key.tickSpacing),
        hooks: key.hooks as Address,
      },
      creator: owner as Address,
      beacon: modules[0] as Address,
      fees: modules[1] as Address,
      funding: modules[2] as Address,
      marginRatios: modules[3] as Address,
      priceImpact: modules[4] as Address,
      pricing: modules[5] as Address,
      protocolFeeManager: protocolFeeManager as Address,
      protocolFee: Number(protocolFee) / 1e6,
      emaWindow: Number(emaWindow),
      poolId: poolId as Hex,
    };

    this.configCache.set(perpAddress, cfg);
    return cfg;
  }

  private async fetchPerpContractData(perpAddress: PerpAddress): Promise<{
    tickSpacing: number;
    mark: number;
    bounds: Bounds;
    fees: Fees;
  }> {
    return withErrorHandling(async () => {
      const cfg = await this.getPerpConfig(perpAddress);

      const [poolState, takerRatios, feeRates, liquidationFee] = await Promise.all([
        this.publicClient.readContract({
          address: perpAddress,
          abi: PERP_ABI,
          functionName: "poolState",
        }),
        this.publicClient.readContract({
          address: cfg.marginRatios,
          abi: MARGIN_RATIOS_ABI,
          functionName: "takerMarginRatios",
        }),
        this.publicClient.readContract({
          address: cfg.fees,
          abi: FEES_ABI,
          functionName: "fees",
        }),
        this.publicClient.readContract({
          address: cfg.fees,
          abi: FEES_ABI,
          functionName: "liqFee",
        }),
      ]);

      const [initialRatio, liquidationTakerRatio] = takerRatios;
      const [creatorFee, insuranceFee, lpFee] = feeRates;

      return {
        tickSpacing: Number(cfg.key.tickSpacing),
        mark: scaleFromX96(poolState[2]),
        bounds: {
          minMargin: 10,
          minTakerLeverage: 1,
          maxTakerLeverage: marginRatioToLeverage(Number(initialRatio)),
          liquidationTakerRatio: Number(liquidationTakerRatio) / 1e6,
        },
        fees: {
          creatorFee: Number(creatorFee) / 1e6,
          insuranceFee: Number(insuranceFee) / 1e6,
          lpFee: Number(lpFee) / 1e6,
          liquidationFee: Number(liquidationFee) / 1e6,
        },
      };
    }, `fetchPerpContractData for perp ${perpAddress}`);
  }

  async getPerpData(perpAddress: PerpAddress): Promise<PerpData> {
    return withErrorHandling(async () => {
      const [contractData, config] = await Promise.all([
        this.fetchPerpContractData(perpAddress),
        this.getPerpConfig(perpAddress),
      ]);

      return {
        id: perpAddress,
        tickSpacing: contractData.tickSpacing,
        mark: contractData.mark,
        beacon: config.beacon,
        bounds: contractData.bounds,
        fees: contractData.fees,
      };
    }, `getPerpData for perp ${perpAddress}`);
  }

  private async fetchUserData(
    userAddress: Address,
    positions: Array<{ perpId: PerpAddress; positionId: bigint; isLong: boolean; isMaker: boolean }>
  ): Promise<UserData> {
    const usdcBalance = await this.publicClient.readContract({
      address: this.deployments().usdc,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [userAddress],
    });

    const openPositionsData = await Promise.all(
      positions.map(async ({ perpId, positionId, isLong, isMaker }) => ({
        perpId,
        positionId,
        isLong,
        isMaker,
      }))
    );

    return {
      walletAddress: userAddress as Hex,
      usdcBalance: Number(formatUnits(usdcBalance, 6)),
      openPositions: openPositionsData,
    };
  }

  async getUserData(
    userAddress: Address,
    positions: Array<{ perpId: PerpAddress; positionId: bigint; isLong: boolean; isMaker: boolean }>
  ): Promise<UserData> {
    return this.fetchUserData(userAddress, positions);
  }

  async getOpenPositionData(
    perpAddress: PerpAddress,
    positionId: bigint,
    isLong: boolean,
    isMaker: boolean
  ): Promise<OpenPositionData> {
    await this.getPositionRawData(perpAddress, positionId);
    return {
      perpId: perpAddress,
      positionId,
      isLong,
      isMaker,
    };
  }

  async getPositionRawData(perpAddress: PerpAddress, positionId: bigint): Promise<PositionRawData> {
    return withErrorHandling(async () => {
      const [position, makerDetails] = await Promise.all([
        this.publicClient.readContract({
          address: perpAddress,
          abi: PERP_ABI,
          functionName: "positions",
          args: [positionId],
        }),
        this.publicClient.readContract({
          address: perpAddress,
          abi: PERP_ABI,
          functionName: "makerDetails",
          args: [positionId],
        }),
      ]);

      if (position[1] === 0n && position[0] === 0n) {
        throw new Error(`Position ${positionId} does not exist or is closed`);
      }

      const delta = unpackBalanceDelta(position[0]);
      const isMaker = makerDetails[2] !== 0n;

      return {
        perpId: perpAddress,
        positionId,
        margin: Number(formatUnits(position[1], 6)),
        entryPerpDelta: delta.amount0,
        entryUsdDelta: delta.amount1,
        marginRatios: {
          min: Number(position[2]),
          max: 1000000,
          liq: Number(position[2]),
        },
        makerDetails: isMaker
          ? {
              unlockTimestamp: 0,
              tickLower: Number(makerDetails[0]),
              tickUpper: Number(makerDetails[1]),
            }
          : null,
      };
    }, `getPositionRawData for position ${positionId}`);
  }
}
