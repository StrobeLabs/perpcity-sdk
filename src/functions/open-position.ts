import type { Hex } from "viem";
import type { PerpCityContext } from "../context";
import type { ClosePositionParams, ClosePositionResult, LiveDetails } from "../types/entity-data";
import { withErrorHandling } from "../utils/errors";
import { closePosition, getPositionLiveDetailsFromContract } from "./position";

export class OpenPosition {
  public readonly context: PerpCityContext;
  public readonly perpId: Hex;
  public readonly positionId: bigint;
  public readonly isLong?: boolean;
  public readonly isMaker?: boolean;
  public readonly txHash?: Hex;

  constructor(
    context: PerpCityContext,
    perpId: Hex,
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

  async liveDetails(): Promise<LiveDetails> {
    return withErrorHandling(
      () => getPositionLiveDetailsFromContract(this.context, this.perpId, this.positionId),
      `liveDetails for position ${this.positionId}`
    );
  }
}
