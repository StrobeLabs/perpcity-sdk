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
  /**
   * Wallet client for signing transactions.
   * MUST have a chain property defined (e.g., created with `chain: baseSepolia`).
   */
  walletClient: WalletClient;

  /**
   * RPC endpoint URL for read operations (e.g., Alchemy, Infura).
   * MUST correspond to the same network as walletClient.chain.
   * Use validateChainId() after construction to verify.
   */
  rpcUrl: string;

  deployments: PerpCityDeployments;
}
