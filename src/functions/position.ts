import type { PerpCityContext } from "../context";
import type { PerpAddress } from "../types";
import type {
  ClosePositionParams,
  ClosePositionResult,
  OpenPositionData,
  PositionPreview,
  PositionRawData,
} from "../types/entity-data";
import { scaleFromX96 } from "../utils/conversions";
import { withErrorHandling } from "../utils/errors";
import { buildClosePositionCall } from "./calldata";
import { makerConvertedFromReceipt } from "./perp-actions";
import { sendCall } from "./send-call";

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
 * Close a position.
 *
 * Taker: trades out the whole inventory with `reduceOnly: true` and needs
 * `maxTotalFee`. `amt1Limit` is the min USD received on a long close and the
 * max USD paid on a short close, so `amt1Limit: 0` fails a short close
 * (`MaxAmtExceeded`).
 *
 * Maker: removes all liquidity. With no perp inventory left the position
 * closes. With perp inventory left the contract converts it to a taker
 * (`MakerConverted`) and the result has `converted: true`; call
 * `closePosition` again (with `maxTotalFee`) for the reduce-only taker close.
 * The conversion reverts `MarginTooLow` or `MarginRatioTooLow` when the margin
 * is too small for a taker. To add margin in the same transaction, call
 * `adjustMaker` with a positive `marginDelta` and the full negative
 * `liquidityDelta`.
 */
export async function closePosition(
  context: PerpCityContext,
  perpAddress: PerpAddress,
  positionId: bigint,
  params: ClosePositionParams
): Promise<ClosePositionResult> {
  return withErrorHandling(async () => {
    const call = await buildClosePositionCall(context, perpAddress, positionId, params);
    const { txHash, receipt } = await sendCall(context, call);
    return { txHash, converted: makerConvertedFromReceipt(receipt, perpAddress, positionId) };
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
