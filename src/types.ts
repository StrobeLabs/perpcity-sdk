import type { Address, WalletClient } from "viem";

export interface PerpCityDeployments {
  perpManager: Address;
  usdc: Address;
}

export interface PerpCityContextConfig {
  walletClient: WalletClient;
  goldskyBearerToken?: string;
  goldskyEndpoint: string;
  deployments: PerpCityDeployments;
}