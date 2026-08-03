import type { Address, Hex, PublicClient, WalletClient } from "viem";
import type { PerpCityError } from "./utils/errors";

export type PerpAddress = Address;

/**
 * Optional observability callbacks, invoked around SDK transaction lifecycles
 * and error parsing. Intended as the seam for bot metrics (Prometheus etc.):
 * `onTxConfirmed` carries gas and latency, `onError` carries the stable
 * machine-readable code. Hooks are fire-and-forget - a throwing hook is
 * swallowed and can never break a trade. For RPC-level metrics, inject a
 * `publicClient` with a wrapped transport instead.
 */
export interface PerpCityHooks {
  onTxSubmitted?(event: { operation: string; txHash: Hex; perpAddress?: Address }): void;
  onTxConfirmed?(event: {
    operation: string;
    txHash: Hex;
    perpAddress?: Address;
    status: "success" | "reverted";
    gasUsed: bigint;
    durationMs: number;
  }): void;
  onError?(event: { operation: string; error: PerpCityError }): void;
}

export interface PerpCityDeployments {
  usdc: Address;

  /** PerpFactory address for creating new markets. */
  perpFactory?: Address;

  /** ProtocolFeeManager address. Can also be read from a Perp contract. */
  protocolFeeManager?: Address;

  /** Optional default Perp address for apps that operate on one market. */
  perpAddress?: PerpAddress;

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

  /**
   * Caller-supplied public client for reads and simulations. When given it is
   * used as-is (rpcUrl is ignored for reads), letting metrics-minded callers
   * wrap the transport to count and time every RPC request. When omitted the
   * context builds its own batched client from rpcUrl.
   */
  publicClient?: PublicClient;

  /** Observability callbacks; see PerpCityHooks. */
  hooks?: PerpCityHooks;
}
