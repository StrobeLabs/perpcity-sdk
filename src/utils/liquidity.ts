import { PerpCityContext } from "../context";
import { PERP_MANAGER_ABI } from "../abis/perp-manager";

export async function estimateLiquidity(context: PerpCityContext, tickLower: number, tickUpper: number, usdScaled: bigint): Promise<bigint> {
  return await context.walletClient.readContract({
    address: context.deployments().perpManager,
    abi: PERP_MANAGER_ABI,
    functionName: 'estimateLiquidityForAmount1',
    args: [tickLower, tickUpper, usdScaled],
  }) as bigint;
}