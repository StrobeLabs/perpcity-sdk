import type { Address, Hex } from "viem";

export type Bounds = {
  minMargin: number;
  minTakerLeverage: number;
  maxTakerLeverage: number;
};

export type Fees = {
  creatorFee: number;
  insuranceFee: number;
  lpFee: number;
  liquidationFee: number;
};

export type LiveDetails = {
  pnl: number;
  fundingPayment: number;
  effectiveMargin: number;
  isLiquidatable: boolean;
};

export type ClosePositionParams = {
  minAmt0Out: number;
  minAmt1Out: number;
  maxAmt1In: number;
};

export type ClosePositionResult = {
  position: any | null; // Will be OpenPosition | null, but avoiding circular dependency
  txHash: Hex;
};

export type OpenTakerPositionParams = {
  isLong: boolean; // true = long, false = short
  margin: number; // USDC amount in human units (e.g., 100 = $100)
  leverage: number; // Leverage multiplier (e.g., 2 = 2x)
  unspecifiedAmountLimit: number | bigint; // Slippage protection
  // - For longs: minimum perp tokens to receive (0 = no minimum)
  // - For shorts: maximum perp tokens to send (use 2n**128n-1n for no limit)
  // Can pass number (in human units) or bigint (raw value)
};

export type OpenMakerPositionParams = {
  margin: number; // USDC margin in human units
  priceLower: number; // Lower price bound
  priceUpper: number; // Upper price bound
  liquidity: bigint; // Liquidity amount (calculated externally)
  maxAmt0In: number; // Max perp tokens
  maxAmt1In: number; // Max USDC
};

export type CreatePerpParams = {
  startingPrice: number;
  beacon: Address;
  // Module addresses - optional, will fall back to deployment config if not provided
  fees?: Address;
  marginRatios?: Address;
  lockupPeriod?: Address;
  sqrtPriceImpactLimit?: Address;
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
  liveDetails: LiveDetails;
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
  vault: Address;
  beacon: Address;
  fees: Address;
  marginRatios: Address;
  lockupPeriod: Address;
  sqrtPriceImpactLimit: Address;
};
