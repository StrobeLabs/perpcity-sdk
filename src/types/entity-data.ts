import type { Address, Hex } from "viem";
import type { PerpAddress } from "../types";

export type Bounds = {
  minMargin: number;
  minTakerLeverage: number;
  maxTakerLeverage: number;
  liquidationTakerRatio: number;
};

export type Fees = {
  creatorFee: number;
  insuranceFee: number;
  lpFee: number;
  liquidationFee: number;
};

export type ClosePositionParams = {
  amt0Limit?: number | bigint;
  amt1Limit: number | bigint;
};

export type ClosePositionResult = {
  txHash: Hex;
};

/**
 * A single contract call as raw calldata, for callers that submit transactions
 * themselves (e.g. batching into an ERC-4337 userOperation) instead of letting
 * the SDK execute via `walletClient.writeContract`.
 */
export type CallData = {
  to: Address;
  data: Hex;
  value: bigint;
};

export type OpenTakerPositionParams = {
  margin: number; // USDC amount in human units (e.g., 100 = $100)
  perpDelta: bigint;
  /** Contract-native amount1 limit. */
  amt1Limit: bigint;
};

export type OpenMakerPositionParams = {
  margin: number; // USDC margin in human units
  priceLower: number; // Lower price bound
  priceUpper: number; // Upper price bound
  liquidity: bigint; // Liquidity amount (calculated externally)
  maxAmt0In: number | bigint; // Max perp tokens (number = human units, bigint = raw)
  maxAmt1In: number | bigint; // Max USDC (number = human units, bigint = raw)
};

export type CreatePerpParams = {
  owner: Address;
  name: string;
  symbol: string;
  tokenUri: string;
  beacon: Address;
  emaWindow: number;
  salt: Hex;
  pricing?: Address;
  funding?: Address;
  fees?: Address;
  marginRatios?: Address;
  priceImpact?: Address;
};

export type PerpData = {
  id: PerpAddress;
  tickSpacing: number;
  mark: number;
  /** Current pool sqrt price (X96), from `poolState`. Drives swap simulation. */
  sqrtPriceX96: bigint;
  /** Current active liquidity, from `poolState`. Drives swap simulation. */
  liquidity: bigint;
  beacon: Address;
  bounds: Bounds;
  fees: Fees;
};

export type UserData = {
  walletAddress: Hex;
  usdcBalance: number;
  openPositions: OpenPositionData[];
};

export type OpenPositionData = {
  perpId: PerpAddress;
  positionId: bigint;
  isLong?: boolean;
  isMaker?: boolean;
};

export type MarginRatios = {
  // Mirrors the on-chain Position struct (liqMarginRatio, backstopMarginRatio).
  liq: number; // Liquidation margin ratio (scaled by 1e6)
  backstop: number; // Backstop margin ratio (scaled by 1e6)
};

export type MakerDetails = {
  tickLower: number;
  tickUpper: number;
  liquidity: bigint; // Active range liquidity (Maker.liquidity, uint128)
};

export type PositionRawData = {
  perpId: PerpAddress;
  positionId: bigint;
  margin: number; // Current margin in USDC
  entryPerpDelta: bigint; // Position size in perp tokens (raw)
  entryUsdDelta: bigint; // Entry notional value in USDC (raw)
  marginRatios: MarginRatios;
  makerDetails: MakerDetails | null;
};

export type EstimateTakerPositionResult = {
  perpDelta: bigint;
  /** Signed USD delta, price impact only (fees excluded). Negative for longs. */
  usdDelta: bigint;
  /** Average fill price, price impact only (fees excluded). */
  fillPrice: number;
  /** Total taker fee rate folded into the effective fields (fraction, e.g. 0.003). */
  feeRate: number;
  /** Fee-inclusive signed USD delta — the true USD the user pays/receives. */
  effectiveUsdDelta: bigint;
  /**
   * Fee-inclusive average fill price — the true per-unit cost. Derive the
   * displayed "Est %" price impact from this so fees are reflected.
   */
  effectiveFillPrice: number;
  /**
   * True when the order is larger than the pool's current active-liquidity
   * region can fill. A strong signal the on-chain swap would revert with
   * `PriceImpactTooHigh`; callers should surface this before submitting.
   */
  exceedsLiquidity: boolean;
  /**
   * True when the order moves the pool price enough that it very likely crosses
   * an initialized tick, so the single-region impact estimate is an
   * underestimate. The UI should warn on this.
   */
  liquidityLimited: boolean;
};

export type EstimateTakerAdjustResult = {
  /** Signed USD delta, price impact only (fees excluded). */
  usdDelta: bigint;
  /** Average fill price, price impact only (fees excluded). */
  fillPrice: number;
  /** Total taker fee rate folded into the effective fields (fraction, e.g. 0.003). */
  feeRate: number;
  /** Fee-inclusive signed USD delta — the true USD the user pays/receives. */
  effectiveUsdDelta: bigint;
  /** Fee-inclusive average fill price — the true per-unit cost. */
  effectiveFillPrice: number;
  /** See {@link EstimateTakerPositionResult.exceedsLiquidity}. */
  exceedsLiquidity: boolean;
  /** See {@link EstimateTakerPositionResult.liquidityLimited}. */
  liquidityLimited: boolean;
};

export type CacheConfig = {
  ttl: number; // Time to live in milliseconds
  maxSize: number; // Maximum cache size
};

export type PerpConfig = {
  key: {
    currency0: Address;
    currency1: Address;
    fee: number;
    tickSpacing: number;
    hooks: Address;
  };
  creator: Address;
  beacon: Address;
  pricing: Address;
  funding: Address;
  fees: Address;
  marginRatios: Address;
  priceImpact: Address;
  protocolFeeManager: Address;
  protocolFee: number;
  emaWindow: number;
  poolId: Hex;
};
