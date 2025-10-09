import { Hex } from "viem";
import { UserData, OpenPositionData, ClosedPosition } from "../types/entity-data";

// Pure functions that operate on UserData
export function getUserUsdcBalance(userData: UserData): number {
  return userData.usdcBalance;
}

export function getUserOpenPositions(userData: UserData): OpenPositionData[] {
  return userData.openPositions;
}

export function getUserClosedPositions(userData: UserData): ClosedPosition[] {
  return userData.closedPositions;
}

export function getUserRealizedPnl(userData: UserData): number {
  return userData.realizedPnl;
}

export function getUserUnrealizedPnl(userData: UserData): number {
  return userData.unrealizedPnl;
}

export function getUserWalletAddress(userData: UserData): Hex {
  return userData.walletAddress;
}
