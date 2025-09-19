import { PerpCityContext } from "../context";
import { publicActions } from "viem";

export async function estimateLiquidity(context: PerpCityContext, tickLower: bigint, tickUpper: bigint, usdScaled: bigint): Promise<bigint> {
  return await context.walletClient.extend(publicActions).readContract({
    address: context.perpManagerAddress,
    abi: context.perpManagerAbi,
    functionName: 'estimateLiquidityForAount1',
    args: [tickLower, tickUpper, usdScaled],
  }) as bigint;
}