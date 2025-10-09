import type { Address, Hex } from "viem";
import { OpenInterest, TimeSeries, Bounds, Fees, LiveDetails, ClosedPosition } from "../entities";

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
