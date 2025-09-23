import type { Address, WalletClient } from "viem";

export interface PerpCityDeployments {
  perpManager: Address;
  usdc: Address;
  goldsky: string;
}

export interface PerpCityContextConfig {
  walletClient: WalletClient;
  goldskyEndpoint: string;
}