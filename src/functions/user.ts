import { Hex } from "viem";
import { UserData, OpenPositionData } from "../types/entity-data";

// Pure functions that operate on UserData
export function getUserUsdcBalance(userData: UserData): number {
  return userData.usdcBalance;
}

export function getUserOpenPositions(userData: UserData): OpenPositionData[] {
  return userData.openPositions;
}

export function getUserWalletAddress(userData: UserData): Hex {
  return userData.walletAddress;
}
