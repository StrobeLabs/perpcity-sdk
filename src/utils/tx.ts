import type { Hex, TransactionReceipt } from "viem";
import type { PerpCityContext } from "../context";
import { TransactionRevertedError } from "./errors";
import { withFeeHeadroom } from "./fees";

/** Invoke an observability hook so that a throwing hook can never break a trade. */
export function invokeHook(fn: () => void): void {
  try {
    fn();
  } catch (_hookError) {
    // Hooks are fire-and-forget by contract; see PerpCityHooks.
  }
}

/**
 * Submit a prepared (already simulated) write and wait for its receipt,
 * firing the context's observability hooks around the lifecycle:
 * onTxSubmitted after the hash is known, onTxConfirmed with status, gasUsed,
 * and wall-clock duration once mined. Throws TransactionRevertedError when
 * the transaction mined but reverted (after firing onTxConfirmed).
 */
export async function sendAndConfirm(
  context: PerpCityContext,
  operation: string,
  request: unknown,
  opts: { perpAddress?: `0x${string}` } = {}
): Promise<{ txHash: Hex; receipt: TransactionReceipt }> {
  const startedAt = Date.now();

  const txHash = await context.walletClient.writeContract(
    (await withFeeHeadroom(context.publicClient, request)) as never
  );
  invokeHook(() =>
    context.hooks?.onTxSubmitted?.({ operation, txHash, perpAddress: opts.perpAddress })
  );

  const receipt = await context.publicClient.waitForTransactionReceipt({ hash: txHash });
  invokeHook(() =>
    context.hooks?.onTxConfirmed?.({
      operation,
      txHash,
      perpAddress: opts.perpAddress,
      status: receipt.status,
      gasUsed: receipt.gasUsed,
      durationMs: Date.now() - startedAt,
    })
  );

  if (receipt.status === "reverted") throw new TransactionRevertedError(txHash);
  return { txHash, receipt };
}
