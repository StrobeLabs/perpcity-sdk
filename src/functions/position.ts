import type { Hex } from "viem";
import { PERP_ABI } from "../abis/perp";
import type { PerpCityContext } from "../context";
import type { PerpAddress } from "../types";
import type {
  ClosePositionParams,
  ClosePositionResult,
  OpenPositionData,
  PositionRawData,
} from "../types/entity-data";
import { scale6Decimals } from "../utils";
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

function toContractAmount(value: number | bigint | undefined): bigint {
  if (value === undefined) return 0n;
  return typeof value === "bigint" ? value : scale6Decimals(value);
}

export async function closePosition(
  context: PerpCityContext,
  perpAddress: PerpAddress,
  positionId: bigint,
  params: ClosePositionParams
): Promise<ClosePositionResult> {
  return withErrorHandling(async () => {
    const rawData = await context.getPositionRawData(perpAddress, positionId);
    let txHash: Hex;

    if (rawData.makerDetails) {
      const makerDetails = await context.publicClient.readContract({
        address: perpAddress,
        abi: PERP_ABI,
        functionName: "makerDetails",
        args: [positionId],
      });
      const result = await adjustMaker(context, perpAddress, {
        posId: positionId,
        marginDelta: 0n,
        liquidityDelta: -makerDetails[2],
        amt0Limit: toContractAmount(params.amt0Limit),
        amt1Limit: toContractAmount(params.amt1Limit),
      });
      txHash = result.txHash;
    } else {
      const result = await adjustTaker(context, perpAddress, {
        posId: positionId,
        marginDelta: 0n,
        perpDelta: -rawData.entryPerpDelta,
        amt1Limit: toContractAmount(params.amt1Limit),
      });
      txHash = result.txHash;
    }

    const receipt = await context.publicClient.waitForTransactionReceipt({ hash: txHash });
    if (receipt.status === "reverted") throw new Error(`Transaction reverted. Hash: ${txHash}`);
    return { position: null, txHash };
  }, `closePosition for position ${positionId}`);
}

export function calculateEntryPrice(rawData: PositionRawData): number {
  const perpDelta = rawData.entryPerpDelta;
  const usdDelta = rawData.entryUsdDelta;
  if (perpDelta === 0n) return 0;
  const absPerpDelta = perpDelta < 0n ? -perpDelta : perpDelta;
  const absUsdDelta = usdDelta < 0n ? -usdDelta : usdDelta;
  return Number(absUsdDelta) / Number(absPerpDelta);
}

export function calculatePositionSize(rawData: PositionRawData): number {
  return Number(rawData.entryPerpDelta) / 1e6;
}

export function calculatePositionValue(rawData: PositionRawData, markPrice: number): number {
  return Math.abs(calculatePositionSize(rawData)) * markPrice;
}

export function calculateLeverage(positionValue: number, effectiveMargin: number): number {
  if (effectiveMargin <= 0) return Infinity;
  return positionValue / effectiveMargin;
}

export function calculateLiquidationPrice(
  rawData: PositionRawData,
  isLong: boolean,
  effectiveMargin?: number
): number | null {
  const entryPrice = calculateEntryPrice(rawData);
  const positionSize = Math.abs(calculatePositionSize(rawData));
  const margin = effectiveMargin ?? rawData.margin;
  if (positionSize === 0 || margin <= 0) return null;

  const liqMarginRatio = rawData.marginRatios.liq / 1e6;
  const entryNotional = positionSize * entryPrice;
  if (isLong) {
    return Math.max(0, entryPrice - (margin - liqMarginRatio * entryNotional) / positionSize);
  }
  return entryPrice + (margin - liqMarginRatio * entryNotional) / positionSize;
}

export function calculatePnlPercentage(pnl: number, funding: number, margin: number): number {
  const totalPnl = pnl + funding;
  const initialMargin = margin - totalPnl;
  if (initialMargin <= 0) return 0;
  return (totalPnl / initialMargin) * 100;
}
