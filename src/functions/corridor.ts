import { PRICE_IMPACT_ABI } from "../abis/price-impact";
import type { PerpCityContext } from "../context";
import { type FairPriceOptions, getFairPrice } from "../math/pricing";
import type { PerpAddress } from "../types";

/** The sqrt-price band a swap must end inside, else `PriceImpactTooHigh`. */
export type PriceCorridor = { sqrtMinX96: bigint; sqrtMaxX96: bigint };

/**
 * The perp's price-impact corridor for a swap now: the price-impact module's
 * `sqrtPriceBounds(amm, index, emaAmm, emaIndex)` view with the inputs
 * `PerpLogic.swap` passes (pre-swap spot and the EMAs accrued to now). Asking
 * the module itself keeps every deployed module variant right, including
 * markets whose band is not the default ±10% of the EMA.
 */
export async function getPriceCorridor(
  context: PerpCityContext,
  perpAddress: PerpAddress,
  opts: FairPriceOptions = {}
): Promise<PriceCorridor> {
  const [cfg, mark] = await Promise.all([
    context.getPerpConfig(perpAddress),
    getFairPrice(context, perpAddress, opts),
  ]);
  const [sqrtMinX96, sqrtMaxX96] = await context.publicClient.readContract({
    address: cfg.priceImpact,
    abi: PRICE_IMPACT_ABI,
    functionName: "sqrtPriceBounds",
    args: [mark.spotX96, mark.indexX96, mark.emaAmmX96, mark.emaIndexX96],
    blockNumber: opts.blockNumber,
  });
  return { sqrtMinX96, sqrtMaxX96 };
}

/** True when a swap ending at `endSqrtPriceX96` reverts `PriceImpactTooHigh`. */
export function endsOutsideCorridor(endSqrtPriceX96: bigint, corridor: PriceCorridor): boolean {
  return endSqrtPriceX96 < corridor.sqrtMinX96 || endSqrtPriceX96 > corridor.sqrtMaxX96;
}
