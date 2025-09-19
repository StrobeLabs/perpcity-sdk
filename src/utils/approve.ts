import { PerpCityContext } from "../context";
import { erc20Abi, publicActions } from "viem";
import type { Address } from "viem";

export async function approveUsdc(context: PerpCityContext, amount: bigint) {
  const usdcAddress = await getUsdcAddress(context);

  const { request } = await context.walletClient.extend(publicActions).simulateContract({
    address: usdcAddress,
    abi: erc20Abi,
    functionName: 'approve',
    args: [context.perpManagerAddress, amount],
    account: context.walletClient.account,
  });

  const hash = await context.walletClient.writeContract(request);

  await context.walletClient.extend(publicActions).waitForTransactionReceipt({ 
    confirmations: 2, 
    hash 
  });
}

export async function getUsdcAddress(context: PerpCityContext): Promise<Address>{
  return await context.walletClient.extend(publicActions).readContract({
    address: context.perpManagerAddress,
    abi: context.perpManagerAbi,
    functionName: 'USDC',
  }) as Address;
}