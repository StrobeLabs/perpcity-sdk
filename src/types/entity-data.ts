import type { Address, Hex } from "viem";

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
  position: any | null; // Will be OpenPosition | null, but avoiding circular dependency
  txHash: Hex;
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
  id: Hex;
  tickSpacing: number;
  mark: number;
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
  perpId: Hex;
  positionId: bigint;
  isLong?: boolean;
  isMaker?: boolean;
};

export type MarginRatios = {
  min: number; // Minimum margin ratio (scaled by 1e6)
  max: number; // Maximum margin ratio (scaled by 1e6)
  liq: number; // Liquidation margin ratio (scaled by 1e6)
};

export type MakerDetails = {
  unlockTimestamp: number;
  tickLower: number;
  tickUpper: number;
};

export type PositionRawData = {
  perpId: Hex;
  positionId: bigint;
  margin: number; // Current margin in USDC
  entryPerpDelta: bigint; // Position size in perp tokens (raw)
  entryUsdDelta: bigint; // Entry notional value in USDC (raw)
  marginRatios: MarginRatios;
  makerDetails: MakerDetails | null;
};

export type EstimateTakerPositionResult = {
  perpDelta: bigint;
  usdDelta: bigint;
  fillPrice: number;
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
