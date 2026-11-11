import type { PerpCityContext } from "../context";
import type { PerpAddress } from "../types";
import type {
  ClosePositionParams,
  ClosePositionResult,
  OpenPositionData,
  PositionPreview,
  PositionRawData,
} from "../types/entity-data";
import { scale6Decimals, scaleFromX96 } from "../utils/conversions";
import { withErrorHandling } from "../utils/errors";
import { adjustMaker, adjustTaker } from "./perp-actions";

export function getPositionPerpId(positionData: OpenPositionData): PerpAddress {
  return positionData.perpId;
}

export function getPositionId(positionData: OpenPositionData): bigint {
  return positionData.positionId;
}

export function getPositionIsLong(positionData: OpenPositionData): boolean | undefined {
  return positionData.isLong;
}

export function getPositionIsMaker(positionData: OpenPositionData): boolean | undefined {
  return positionData.isMaker;
}

/**
 * Fully close a position. A taker sells its whole inventory with
 * `reduceOnly: true` and needs `maxTotalFee`; a maker removes all liquidity.
 */
export async function closePosition(
  context: PerpCityContext,
  perpAddress: PerpAddress,
  positionId: bigint,
  params: ClosePositionParams
): Promise<ClosePositionResult> {
  return withErrorHandling(async () => {
    const rawData = await context.getPositionRawData(perpAddress, positionId);
    const amount = (v: number | bigint | undefined) =>
      v === undefined ? 0n : typeof v === "bigint" ? v : scale6Decimals(v);

    if (rawData.makerDetails) {
      return adjustMaker(context, perpAddress, {
        posId: positionId,
        marginDelta: 0n,
        liquidityDelta: -rawData.makerDetails.liquidity,
        amt0Limit: amount(params.amt0Limit),
        amt1Limit: amount(params.amt1Limit),
        deadline: params.deadline,
      });
    }
    if (params.maxTotalFee === undefined) {
      throw new Error("maxTotalFee is required to close a taker position");
    }
    return adjustTaker(context, perpAddress, {
      posId: positionId,
      marginDelta: 0n,
      perpDelta: -rawData.perpDelta,
      amt1Limit: amount(params.amt1Limit),
      maxTotalFee: params.maxTotalFee,
      reduceOnly: true,
      deadline: params.deadline,
    });
  }, `closePosition for position ${positionId}`);
}

/** Signed size in whole perps (6-decimal perp atoms). */
export function calculatePositionSize(rawData: Pick<PositionRawData, "perpDelta">): number {
  return Number(rawData.perpDelta) / 1e6;
}

/** Display values from a `previewPosition` result, in USD and whole units. */
export type PositionSummary = {
  markPrice: number;
  value: number;
  unrealizedPnl: number;
  equity: number;
  settledMargin: number;
  pendingFunding: number;
  pendingUtil: number;
  pendingLpFees: number;
  /** value / equity; Infinity when equity <= 0. */
  leverage: number;
  liquidatable: boolean;
  meetsInitialMargin: boolean;
};

const usd = (x: bigint) => Number(x) / 1e6;

export function summarizePreview(preview: PositionPreview): PositionSummary {
  const equity = usd(preview.equity);
  const value = usd(preview.value);
  return {
    markPrice: scaleFromX96(preview.markPrice),
    value,
    unrealizedPnl: usd(preview.unrealizedPnl),
    equity,
    settledMargin: usd(preview.settledMargin),
    pendingFunding: usd(preview.pendingFunding),
    pendingUtil: usd(preview.pendingUtil),
    pendingLpFees: usd(preview.pendingLpFees),
    leverage: equity > 0 ? value / equity : Infinity,
    liquidatable: preview.liquidatable,
    meetsInitialMargin: preview.meetsInitialMargin,
  };
}

export function calculatePnlPercentage(pnl: number, funding: number, margin: number): number {
  const totalPnl = pnl + funding;
  const initialMargin = margin - totalPnl;
  if (initialMargin <= 0) return 0;
  return (totalPnl / initialMargin) * 100;
}
