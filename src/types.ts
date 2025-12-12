import type { Address, WalletClient } from "viem";

export interface PerpCityDeployments {
  perpManager: Address;
  usdc: Address;
  // Module addresses - optional for now, can be fetched dynamically from perpId configs
  // These are used as defaults when creating new perps
  feesModule?: Address;
  marginRatiosModule?: Address;
  lockupPeriodModule?: Address;
  sqrtPriceImpactLimitModule?: Address;
}

export interface PerpCityContextConfig {
  walletClient: WalletClient;
  rpcUrl: string;
  deployments: PerpCityDeployments;
}
