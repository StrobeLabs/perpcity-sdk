import type { Address, Hex } from "viem";

export type OpenInterest = {
  takerLongNotional: number,
  takerShortNotional: number,
}

export type TimeSeries<T extends number | OpenInterest> = {
  timestamp: number,
  value: T,
}

export type Bounds = {
  minMargin: number,
  minTakerLeverage: number,
  maxTakerLeverage: number,
}

export type Fees = {
  creatorFee: number,
  insuranceFee: number,
  lpFee: number,
  liquidationFee: number,
}

export type LiveDetails = {
  pnl: number;
  fundingPayment: number;
  effectiveMargin: number;
  isLiquidatable: boolean;
}

export type ClosedPosition = {
  perpId: Hex;
  wasMaker: boolean;
  wasLong: boolean;
  pnlAtClose: number;
}

export type ClosePositionParams = {
  minAmt0Out: number;
  minAmt1Out: number;
  maxAmt1In: number;
}

export type OpenTakerPositionParams = {
  isLong: boolean;          // true = long, false = short
  margin: number;           // USDC amount in human units (e.g., 100 = $100)
  leverage: number;         // Leverage multiplier (e.g., 2 = 2x)
  unspecifiedAmountLimit: number; // Slippage protection
}

export type OpenMakerPositionParams = {
  margin: number;           // USDC margin in human units
  priceLower: number;       // Lower price bound
  priceUpper: number;       // Upper price bound
  liquidity: bigint;        // Liquidity amount (calculated externally)
  maxAmt0In: number;        // Max perp tokens
  maxAmt1In: number;        // Max USDC
}

export type CreatePerpParams = {
  startingPrice: number;
  beacon: Address;
}

export type PerpData = {
  id: Hex;
  tickSpacing: number;
  mark: number;
  index: number;
  beacon: Address;
  lastIndexUpdate: number;
  openInterest: OpenInterest;
  markTimeSeries: TimeSeries<number>[];
  indexTimeSeries: TimeSeries<number>[];
  fundingRate: number;
  bounds: Bounds;
  fees: Fees;
  openInterestTimeSeries: TimeSeries<OpenInterest>[];
  fundingRateTimeSeries: TimeSeries<number>[];
  totalOpenMakerPnl: number;
  totalOpenTakerPnl: number;
}

export type UserData = {
  walletAddress: Hex;
  usdcBalance: number;
  openPositions: OpenPositionData[];
  closedPositions: ClosedPosition[];
  realizedPnl: number;
  unrealizedPnl: number;
}

export type OpenPositionData = {
  perpId: Hex;
  positionId: bigint;
  isLong?: boolean;
  isMaker?: boolean;
  liveDetails: LiveDetails;
}

export type CacheConfig = {
  ttl: number; // Time to live in milliseconds
  maxSize: number; // Maximum cache size
}
