import { PERP_ABI } from "../abis/perp";
import type { PerpCityContext } from "../context";
import { BUILD_RULES } from "../math/buildRules";
import { mulDiv, mulDivUp } from "../math/fixedPoint";
import type { PerpAddress } from "../types";
import type { PerpBuild } from "../utils/build";

/** Taker open interest and maker capacity per side, raw micro perp units. */
export type Utilization = {
  oiLong: bigint;
  oiShort: bigint;
  capLong: bigint;
  capShort: bigint;
};

export async function getUtilization(
  context: PerpCityContext,
  perpAddress: PerpAddress,
  blockNumber?: bigint
): Promise<Utilization> {
  const [oi, cap] = await Promise.all([
    context.publicClient.readContract({
      address: perpAddress,
      abi: PERP_ABI,
      functionName: "openInterest",
      blockNumber,
    }),
    context.publicClient.readContract({
      address: perpAddress,
      abi: PERP_ABI,
      functionName: "capacity",
      blockNumber,
    }),
  ]);
  return { oiLong: oi[0], oiShort: oi[1], capLong: cap[0], capShort: cap[1] };
}

/**
 * Largest perp size a taker can trade toward `side` before
 * `checkUtilization` (both builds: revert when oi > cap, on EITHER side)
 * fails. `existingOpposite` is the size of the trader's own position on the
 * other side, which the trade nets off first. 0 when the other side is
 * already over its cap after that netting (every trade reverts then).
 */
export function takerHeadroom(
  side: "long" | "short",
  u: Utilization,
  existingOpposite = 0n
): bigint {
  const [oi, cap, otherOi, otherCap] =
    side === "long"
      ? [u.oiLong, u.capLong, u.oiShort, u.capShort]
      : [u.oiShort, u.capShort, u.oiLong, u.capLong];
  const otherAfterNetting = otherOi > existingOpposite ? otherOi - existingOpposite : 0n;
  if (otherAfterNetting > otherCap) return 0n;
  const free = cap > oi ? cap - oi : 0n;
  return free + existingOpposite;
}

export type MakerRemovable = {
  /** Largest removable share of the position's liquidity, 0-1. */
  fraction: number;
  /** Largest whole percentage that passes, 0-100. */
  maxRemovablePct: number;
  /** The side whose open interest binds, or null when 100% is removable. */
  limitedBy: "long" | "short" | null;
};

/**
 * How much of a maker position can be removed before `updateCapacity`
 * reverts Long/ShortUtilizationExceeded. Removing a share of the liquidity
 * removes that share of the position's capacity (58b42b7 rounds the removed
 * capacity down, v0.2.2 up); the remove passes while oi <= cap afterwards on
 * both sides. A 100% remove that leaves residual inventory also re-adds it
 * as taker OI, which this does not model; the transaction preflight is the
 * final check.
 */
export function makerRemovableFraction(p: {
  utilization: Utilization;
  positionCapLong: bigint;
  positionCapShort: bigint;
  build: PerpBuild;
}): MakerRemovable {
  const { utilization: u } = p;
  const roundUp = BUILD_RULES[p.build].removedCapacityRoundsUp;
  const removed = (posCap: bigint, pct: bigint) =>
    pct === 100n ? posCap : roundUp ? mulDivUp(posCap, pct, 100n) : mulDiv(posCap, pct, 100n);
  const passes = (pct: bigint) =>
    u.oiLong + removed(p.positionCapLong, pct) <= u.capLong &&
    u.oiShort + removed(p.positionCapShort, pct) <= u.capShort;

  const share = (oi: bigint, cap: bigint, posCap: bigint) => {
    if (posCap === 0n) return 1;
    if (oi >= cap) return 0;
    return Math.min(1, Number(cap - oi) / Number(posCap));
  };
  const longShare = share(u.oiLong, u.capLong, p.positionCapLong);
  const shortShare = share(u.oiShort, u.capShort, p.positionCapShort);
  const fraction = Math.min(longShare, shortShare);

  let maxRemovablePct = 0;
  for (let pct = 100; pct > 0; pct--) {
    if (passes(BigInt(pct))) {
      maxRemovablePct = pct;
      break;
    }
  }

  const limitedBy =
    maxRemovablePct === 100
      ? null
      : longShare <= shortShare
        ? ("long" as const)
        : ("short" as const);
  return { fraction, maxRemovablePct, limitedBy };
}
