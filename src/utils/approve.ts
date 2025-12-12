import { erc20Abi } from "viem";
import type { PerpCityContext } from "../context";

const DEFAULT_CONFIRMATIONS = 2;

export async function approveUsdc(
  context: PerpCityContext,
  amount: bigint,
  confirmations: number = DEFAULT_CONFIRMATIONS
) {
  const deployments = context.deployments();

  const { request } = await context.publicClient.simulateContract({
    address: deployments.usdc,
    abi: erc20Abi,
    functionName: "approve",
    args: [deployments.perpManager, amount],
    account: context.walletClient.account,
  });

  const hash = await context.walletClient.writeContract(request);

  await context.publicClient.waitForTransactionReceipt({
    confirmations: confirmations,
    hash,
  });
}
