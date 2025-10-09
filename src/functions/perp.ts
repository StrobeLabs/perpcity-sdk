import { Hex } from "viem";
import { PerpCityContext } from "../context";
import { PerpData } from "../types/entity-data";
import { OpenPosition } from "./open-position";

// Pure functions that operate on PerpData
export function getPerpMark(perpData: PerpData): number {
  return perpData.mark;
}

export function getPerpIndex(perpData: PerpData): number {
  return perpData.index;
}

export function getPerpBeacon(perpData: PerpData): string {
  return perpData.beacon;
}

export function getPerpLastIndexUpdate(perpData: PerpData): number {
  return perpData.lastIndexUpdate;
}

export function getPerpOpenInterest(perpData: PerpData) {
  return perpData.openInterest;
}

export function getPerpMarkTimeSeries(perpData: PerpData) {
  return perpData.markTimeSeries;
}

export function getPerpIndexTimeSeries(perpData: PerpData) {
  return perpData.indexTimeSeries;
}

export function getPerpFundingRate(perpData: PerpData): number {
  return perpData.fundingRate;
}

export function getPerpBounds(perpData: PerpData) {
  return perpData.bounds;
}

export function getPerpFees(perpData: PerpData) {
  return perpData.fees;
}

export function getPerpOpenInterestTimeSeries(perpData: PerpData) {
  return perpData.openInterestTimeSeries;
}

export function getPerpFundingRateTimeSeries(perpData: PerpData) {
  return perpData.fundingRateTimeSeries;
}

export function getPerpTickSpacing(perpData: PerpData): number {
  return perpData.tickSpacing;
}

// Functions that require context for read operations

export async function getAllMakerPositions(
  context: PerpCityContext,
  perpId: Hex
): Promise<OpenPosition[]> {
  const query = `
    query ($perpId: Bytes!) {
      openPositions(
        where: { perp: $perpId, isMaker: true }
      ) {
        perp { id }
        inContractPosId
      }
    }
  `;

  const response: any = await context.goldskyClient.request(query, { perpId });
  
  return response.openPositions.map((position: any) => 
    new OpenPosition(context, position.perp.id, position.inContractPosId)
  );
}

export async function getAllTakerPositions(
  context: PerpCityContext,
  perpId: Hex
): Promise<OpenPosition[]> {
  const query = `
    query ($perpId: Bytes!) {
      openPositions(
        where: { perp: $perpId, isMaker: false }
      ) {
        perp { id }
        inContractPosId
      }
    }
  `;

  const response: any = await context.goldskyClient.request(query, { perpId });
  
  return response.openPositions.map((position: any) => 
    new OpenPosition(context, position.perp.id, position.inContractPosId)
  );
}

export async function getTotalOpenMakerPnl(
  context: PerpCityContext,
  perpId: Hex
): Promise<number> {
  const positions = await getAllMakerPositions(context, perpId);
  const liveDetails = await Promise.all(positions.map((position) => position.liveDetails()));
  return liveDetails.reduce((acc, detail) => acc + detail.pnl - detail.fundingPayment, 0);
}

export async function getTotalOpenTakerPnl(
  context: PerpCityContext,
  perpId: Hex
): Promise<number> {
  const positions = await getAllTakerPositions(context, perpId);
  const liveDetails = await Promise.all(positions.map((position) => position.liveDetails()));
  return liveDetails.reduce((acc, detail) => acc + detail.pnl - detail.fundingPayment, 0);
}

