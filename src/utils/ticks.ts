import { priceToTick } from "./conversions";
import { PERP_MAX_TICK, PERP_MIN_TICK } from "./tickMath";

/**
 * Maker range ticks for a price range, aligned outward to `tickSpacing` and
 * checked against the v1 maker tick domain (`MIN_TICK`/`MAX_TICK` = -/+138180
 * in perpcity-contracts v1.0.0 Constants.sol; outside it reverts
 * `TicksOutOfBounds`).
 */
export function calculateAlignedTicks(
  priceLower: number,
  priceUpper: number,
  tickSpacing: number
): { alignedTickLower: number; alignedTickUpper: number } {
  const alignedTickLower = Math.floor(priceToTick(priceLower, true) / tickSpacing) * tickSpacing;
  const alignedTickUpper = Math.ceil(priceToTick(priceUpper, false) / tickSpacing) * tickSpacing;

  if (alignedTickLower < PERP_MIN_TICK) {
    throw new Error(
      `Lower tick ${alignedTickLower} is below the perp minimum (${PERP_MIN_TICK}). Increase priceLower.`
    );
  }
  if (alignedTickUpper > PERP_MAX_TICK) {
    throw new Error(
      `Upper tick ${alignedTickUpper} exceeds the perp maximum (${PERP_MAX_TICK}). Decrease priceUpper.`
    );
  }
  if (alignedTickLower === alignedTickUpper) {
    throw new Error(
      "Price range too narrow: lower and upper ticks are equal after alignment. Widen the range."
    );
  }
  return { alignedTickLower, alignedTickUpper };
}
