import type { PublicClient } from "viem";

/**
 * Estimate EIP-1559 fees with extra headroom on the cap.
 *
 * The base fee can spike between estimation and inclusion (Arbitrum Sepolia
 * regularly jumps >20% within a block), and embedded wallets estimate with no
 * slack, which surfaces as FeeCapTooLowError on submission. Doubling the cap
 * only raises the ceiling - the chain still charges the actual base fee, so
 * the headroom costs nothing when unused.
 */
export async function estimateFeesWithHeadroom(
  publicClient: PublicClient
): Promise<{ maxFeePerGas: bigint; maxPriorityFeePerGas: bigint }> {
  const { maxFeePerGas, maxPriorityFeePerGas } = await publicClient.estimateFeesPerGas();
  return {
    maxFeePerGas: maxFeePerGas * 2n,
    maxPriorityFeePerGas,
  };
}
