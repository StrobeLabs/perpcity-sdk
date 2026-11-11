import type { Address, WalletClient } from "viem";

export type PerpAddress = Address;

export interface PerpCityDeployments {
  usdc: Address;

  perpFactory?: Address;

  perpGuardHook?: Address;

  protocolFeeManager?: Address;

  moduleRegistry?: Address;

  perpAddress?: PerpAddress;

  // Module addresses used as defaults when creating new perps.
  pricingModule?: Address;
  fundingModule?: Address;
  feesModule?: Address;
  marginRatiosModule?: Address;
  priceImpactModule?: Address;
}

export interface PerpCityContextConfig {
  walletClient: WalletClient;

  rpcUrl: string;

  deployments: PerpCityDeployments;
}
