import type { Address, WalletClient } from "viem";

export type PerpAddress = Address;

export interface PerpCityDeployments {
  usdc: Address;

  /** PerpFactory address for creating new markets. */
  perpFactory?: Address;

  /** ProtocolFeeManager address. Can also be read from a Perp contract. */
  protocolFeeManager?: Address;

  /** Default Perp address used by approval helpers when no spender is supplied. */
  perpAddress?: Address;

  // Module addresses used as defaults when creating new perps.
  pricingModule?: Address;
  fundingModule?: Address;
  feesModule?: Address;
  marginRatiosModule?: Address;
  priceImpactModule?: Address;
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
