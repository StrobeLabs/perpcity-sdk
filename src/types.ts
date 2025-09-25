import type { Address, WalletClient } from "viem";

export interface PerpCityDeployments {
  perpManager: Address;
  usdc: Address;
  goldskyPublic: string;
  goldskyPrivate: string;
}

export interface PerpCityContextConfig {
  walletClient: WalletClient;
  goldskyBearerToken?: string;
}