import type { Address, Hex, TransactionReceipt } from "viem";
import { decodeFunctionData } from "viem";
import { PERP_ABI } from "../abis/perp";
import type { PerpCityContext } from "../context";
import { TransactionRevertedError } from "../utils/errors";
import { withFeeHeadroom } from "../utils/fees";

/**
 * Simulate, send and wait. The call is built by the matching `build*Call`
 * function, so an executed write and a batched userOperation encode the same
 * bytes.
 */
export async function sendCall(
  context: PerpCityContext,
  call: { to: Address; data: Hex }
): Promise<{ txHash: Hex; receipt: TransactionReceipt }> {
  // Decode the built bytes back into a typed call so the simulation decodes
  // reverts with PERP_ABI, then send exactly the simulated request.
  const { functionName, args } = decodeFunctionData({ abi: PERP_ABI, data: call.data });
  const { request } = await context.publicClient.simulateContract({
    address: call.to,
    abi: PERP_ABI,
    functionName,
    args,
    account: context.walletClient.account,
  } as Parameters<typeof context.publicClient.simulateContract>[0]);
  const txHash = await context.walletClient.writeContract(
    (await withFeeHeadroom(context.publicClient, request)) as Parameters<
      typeof context.walletClient.writeContract
    >[0]
  );
  const receipt = await context.publicClient.waitForTransactionReceipt({ hash: txHash });
  if (receipt.status === "reverted") throw new TransactionRevertedError(txHash);
  return { txHash, receipt };
}
