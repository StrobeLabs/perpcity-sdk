import { formatUnits } from "viem";
import { PERP_ABI } from "../abis/perp";
import { type PerpCityContext, unpackBalanceDelta } from "../context";
import type { PerpAddress } from "../types";
import { Q96 } from "../utils/constants";
import { ValidationError, withErrorHandling } from "../utils/errors";

export type TakerHealthInputs = {
  /** Signed position size, raw 1e6-scaled perp units (Position delta.amount0). */
  perpDelta: bigint;
  /** Signed cumulative cost basis, raw 1e6-scaled USD (Position delta.amount1). */
  usdDelta: bigint;
  /** Position margin, raw 1e6-scaled USD. */
  margin: bigint;
  /** Position liqMarginRatio (1e6-scaled, uint24). */
  liqMarginRatioE6: number | bigint;
  /** Current AMM price, Q96-scaled (poolState.ammPriceX96). */
  ammPriceX96: bigint;
  /** Perp's cumulative funding index (cumulatives.fundingX96). */
  fundingX96: bigint;
  /** Position's funding checkpoint (Position.lastCumlFundingX96). */
  lastCumlFundingX96: bigint;
};

export type TakerPositionHealth = {
  kind: "taker";
  /** Entry margin, USD. */
  margin: number;
  /** Price PnL, USD: mark notional now vs cumulative cost basis. */
  unrealizedPnl: number;
  /** Funding accrued since the last settle, USD (positive = earned). */
  fundingPayment: number;
  /** margin + unrealizedPnl + fundingPayment, USD. */
  effectiveMargin: number;
  /** |size| * mark, USD. */
  notional: number;
  /** effectiveMargin / notional. */
  marginRatio: number;
  /** The position's liquidation threshold as a fraction. */
  liqMarginRatio: number;
  /** marginRatio - liqMarginRatio; negative means liquidatable. */
  distanceToLiquidation: number;
  isLiquidatable: boolean;
  /** Current AMM mark price, USD per perp. */
  mark: number;
};

function toUsd(value1e6: bigint): number {
  return Number(formatUnits(value1e6, 6));
}

/**
 * Pure taker-health calculator over raw on-chain values. Mirrors the
 * bot-api's authoritative position economics:
 *
 * - mark = ammPriceX96 / 2^96 - a single Q96 divide. The field is a price,
 *   NOT a sqrt price; squaring it inflated long PnL ~48x on a market near 47
 *   in a previous off-chain implementation.
 * - price PnL = sign(perpDelta) * (|perpDelta| * mark - |usdDelta|) - mark
 *   notional now vs the position's cumulative cost basis.
 * - funding = -(fundingX96 - lastCumlFundingX96) * perpDelta / 2^96, kept
 *   fractional in the size so small positions do not round to zero.
 *
 * Utilization payment legs are deliberately excluded, matching the bot-api
 * and app-backend economics.
 */
export function computeTakerHealth(inputs: TakerHealthInputs): TakerPositionHealth {
  const { perpDelta, usdDelta, margin, ammPriceX96, fundingX96, lastCumlFundingX96 } = inputs;

  const absPerpDelta = perpDelta < 0n ? -perpDelta : perpDelta;
  const absUsdDelta = usdDelta < 0n ? -usdDelta : usdDelta;
  const direction = perpDelta > 0n ? 1n : perpDelta < 0n ? -1n : 0n;

  const notional1e6 = (absPerpDelta * ammPriceX96) / Q96;
  const pnl1e6 = direction * (notional1e6 - absUsdDelta);
  const funding1e6 = -((fundingX96 - lastCumlFundingX96) * perpDelta) / Q96;
  const effective1e6 = margin + pnl1e6 + funding1e6;

  const liqMarginRatio = Number(inputs.liqMarginRatioE6) / 1e6;
  const marginRatio = notional1e6 === 0n ? 0 : Number(effective1e6) / Number(notional1e6);

  return {
    kind: "taker",
    margin: toUsd(margin),
    unrealizedPnl: toUsd(pnl1e6),
    fundingPayment: toUsd(funding1e6),
    effectiveMargin: toUsd(effective1e6),
    notional: toUsd(notional1e6),
    marginRatio,
    liqMarginRatio,
    distanceToLiquidation: marginRatio - liqMarginRatio,
    isLiquidatable: marginRatio < liqMarginRatio,
    mark: Number(ammPriceX96) / Number(Q96),
  };
}

/**
 * Live health for a taker position: effective margin (entry margin + price
 * PnL + funding), margin ratio, and distance to liquidation, computed
 * client-side from one multicalled round trip (positions, makerDetails,
 * cumulatives, poolState).
 *
 * Taker-only: maker health additionally requires valuing the LP range at the
 * current price and accrued fees, and is not covered here. Maker positions
 * throw ValidationError with code WRONG_POSITION_KIND.
 */
export async function getPositionHealth(
  context: PerpCityContext,
  perpAddress: PerpAddress,
  positionId: bigint
): Promise<TakerPositionHealth> {
  return withErrorHandling(async () => {
    const [position, makerDetails, cumulatives, poolState] = await Promise.all([
      context.publicClient.readContract({
        address: perpAddress,
        abi: PERP_ABI,
        functionName: "positions",
        args: [positionId],
      }),
      context.publicClient.readContract({
        address: perpAddress,
        abi: PERP_ABI,
        functionName: "makerDetails",
        args: [positionId],
      }),
      context.publicClient.readContract({
        address: perpAddress,
        abi: PERP_ABI,
        functionName: "cumulatives",
      }),
      context.publicClient.readContract({
        address: perpAddress,
        abi: PERP_ABI,
        functionName: "poolState",
      }),
    ]);

    // A zero margin + zero delta is indistinguishable on-chain between a
    // position that was closed and one that never existed.
    if (position[1] === 0n && position[0] === 0n) {
      throw new ValidationError(
        `Position ${positionId} does not exist or is closed`,
        undefined,
        "POSITION_NOT_FOUND"
      );
    }

    if (makerDetails[2] !== 0n) {
      throw new ValidationError(
        "getPositionHealth supports taker positions only; maker health needs LP range valuation",
        undefined,
        "WRONG_POSITION_KIND"
      );
    }

    const delta = unpackBalanceDelta(position[0]);
    return computeTakerHealth({
      perpDelta: delta.amount0,
      usdDelta: delta.amount1,
      margin: position[1],
      liqMarginRatioE6: Number(position[2]),
      ammPriceX96: poolState[2],
      fundingX96: cumulatives[0],
      lastCumlFundingX96: position[4],
    });
  }, `getPositionHealth for position ${positionId}`);
}
