import { Hex } from "viem";
import { UserData, OpenPositionData } from "../types/entity-data";
import { ClosedPosition } from "../entities/user";

// Re-export the User class from entities for convenience
export { User } from "../entities/user";

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
