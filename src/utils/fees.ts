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

/**
 * Merge headroom fees into a prepared write request.
 *
 * The fees must ride on the write (eth_sendTransaction), NOT on the
 * simulation: fee fields in an eth_call make nodes run the balance check
 * against the RPC gas cap, which is uint64 max on some Arbitrum providers
 * and therefore rejects every call. The cast is contained here because the
 * prepared-request union includes legacy variants that forbid EIP-1559 fee
 * fields; at runtime these chains always produce EIP-1559 requests.
 */
export async function withFeeHeadroom<T>(publicClient: PublicClient, request: T): Promise<T> {
  const fees = await estimateFeesWithHeadroom(publicClient);
  return { ...request, ...fees } as unknown as T;
}
