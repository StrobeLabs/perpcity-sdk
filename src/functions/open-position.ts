import type { Hex } from "viem";
import type { PerpCityContext } from "../context";
import type { PerpAddress } from "../types";
import type { ClosePositionParams, ClosePositionResult } from "../types/entity-data";
import { closePosition } from "./position";

export class OpenPosition {
  public readonly context: PerpCityContext;
  public readonly perpId: PerpAddress;
  public readonly positionId: bigint;
  public readonly isLong?: boolean;
  public readonly isMaker?: boolean;
  public readonly txHash?: Hex;

  constructor(
    context: PerpCityContext,
    perpId: PerpAddress,
    positionId: bigint,
    isLong?: boolean,
    isMaker?: boolean,
    txHash?: Hex
  ) {
    this.context = context;
    this.perpId = perpId;
    this.positionId = positionId;
    this.isLong = isLong;
    this.isMaker = isMaker;
    this.txHash = txHash;
  }

  async closePosition(params: ClosePositionParams): Promise<ClosePositionResult> {
    return closePosition(this.context, this.perpId, this.positionId, params);
  }
}
