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
  unspecifiedAmountLimit: number | bigint; // Slippage protection (perp token units)
  // - For longs: minimum perp tokens to receive (0 = no minimum)
  // - For shorts: maximum perp tokens to send (use 2n**128n-1n for no limit)
  // Both refer to currency0 (perp tokens), not USD.
  // Can pass number (in human units) or bigint (raw value)
};

export type OpenMakerPositionParams = {
  margin: number; // USDC margin in human units
  priceLower: number; // Lower price bound
  priceUpper: number; // Upper price bound
  liquidity: bigint; // Liquidity amount (calculated externally)
  // Slippage tolerance as a fraction (e.g. 0.01 = 1%). Default 0.01.
  // Used when maxAmt0In/maxAmt1In are not provided — the SDK quotes the position
  // on-chain and applies this tolerance to compute slippage limits automatically.
  slippageTolerance?: number;
  // Manual overrides for slippage limits. If you supply one, you must supply both.
  maxAmt0In?: number | bigint; // Max perp tokens (number = human units, bigint = raw)
  maxAmt1In?: number | bigint; // Max USDC (number = human units, bigint = raw)
};

export type QuoteOpenMakerPositionResult = {
  perpDelta: bigint; // Exact perp tokens needed (negative = tokens sent in)
  usdDelta: bigint; // Exact USDC needed (negative = tokens sent in)
};

export type CreatePerpParams = {
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

export type QuoteTakerPositionResult = {
  perpDelta: bigint;
  usdDelta: bigint;
  fillPrice: number;
};

export type QuoteClosePositionResult = {
  pnl: number;
  funding: number;
  netMargin: number;
  wasLiquidated: boolean;
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
