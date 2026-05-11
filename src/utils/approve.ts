import { type Address, erc20Abi } from "viem";
import type { PerpCityContext } from "../context";

const DEFAULT_CONFIRMATIONS = 2;

export async function getUsdcAllowance(context: PerpCityContext, owner: Address): Promise<bigint> {
  const deployments = context.deployments();
  const spender = deployments.perpManager;
  if (!spender) {
    throw new Error("getUsdcAllowance requires a spender/perp address in v2");
  }
  return context.publicClient.readContract({
    address: deployments.usdc,
    abi: erc20Abi,
    functionName: "allowance",
    args: [owner, spender],
  }) as Promise<bigint>;
}

export async function getUsdcAllowanceForSpender(
  context: PerpCityContext,
  owner: Address,
  spender: Address
): Promise<bigint> {
  return context.publicClient.readContract({
    address: context.deployments().usdc,
    abi: erc20Abi,
    functionName: "allowance",
    args: [owner, spender],
  }) as Promise<bigint>;
}

export async function approveUsdc(
  context: PerpCityContext,
  amount: bigint,
  confirmations: number = DEFAULT_CONFIRMATIONS,
  spender?: Address
) {
  const deployments = context.deployments();
  const approvalSpender = spender ?? deployments.perpManager;
  if (!approvalSpender) {
    throw new Error("approveUsdc requires a spender/perp address in v2");
  }

  const { request } = await context.publicClient.simulateContract({
    address: deployments.usdc,
    abi: erc20Abi,
    functionName: "approve",
    args: [approvalSpender, amount],
    account: context.walletClient.account,
  });

  const hash = await context.walletClient.writeContract(request);

  await context.publicClient.waitForTransactionReceipt({
    confirmations: confirmations,
    hash,
  });
}
