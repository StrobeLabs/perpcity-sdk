import type { Hex } from "viem";
import { publicActions, formatUnits, decodeEventLog } from "viem";
import { PerpCityContext } from "../context";
import { scale6Decimals, scaleFrom6Decimals } from "../utils";
import { withErrorHandling, parseContractError } from "../utils/errors";
import { PERP_MANAGER_ABI } from "../abis/perp-manager";
import { ClosePositionParams, LiveDetails } from "../types/entity-data";

export class OpenPosition {
  public readonly context: PerpCityContext;
  public readonly perpId: Hex;
  public readonly positionId: bigint;
  public readonly isLong?: boolean;
  public readonly isMaker?: boolean;

  constructor(context: PerpCityContext, perpId: Hex, positionId: bigint, isLong?: boolean, isMaker?: boolean) {
    this.context = context;
    this.perpId = perpId;
    this.positionId = positionId;
    this.isLong = isLong;
    this.isMaker = isMaker;
  }

  async closePosition(params: ClosePositionParams): Promise<OpenPosition | null> {
    return withErrorHandling(async () => {
      const contractParams = {
        posId: this.positionId,
        minAmt0Out: scale6Decimals(params.minAmt0Out),
        minAmt1Out: scale6Decimals(params.minAmt1Out),
        maxAmt1In: scale6Decimals(params.maxAmt1In),
      };

      // Simulate the transaction first - this will catch contract errors early
      const { request } = await this.context.walletClient.extend(publicActions).simulateContract({
        address: this.context.deployments().perpManager,
        abi: PERP_MANAGER_ABI,
        functionName: 'closePosition',
        args: [this.perpId, contractParams],
        account: this.context.walletClient.account,
      });

      // Execute the transaction
      const txHash = await this.context.walletClient.writeContract(request);

      // Wait for transaction confirmation
      const publicClient = this.context.walletClient.extend(publicActions);
      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

      // Check if transaction was successful
      if (receipt.status === 'reverted') {
        throw new Error(`Transaction reverted. Hash: ${txHash}`);
      }

      // Parse the transaction logs to extract the position closed event
      // The closePosition function returns a new position ID (for partial closes) or null (for full closes)
      let newPositionId: bigint | null = null;

      // Decode PositionClosed event from logs
      for (const log of receipt.logs) {
        try {
          // Try to decode as PositionClosed event
          const decoded = decodeEventLog({
            abi: PERP_MANAGER_ABI,
            data: log.data,
            topics: log.topics,
            eventName: 'PositionClosed',
          });

          // Check if this is our position by matching perpId and posId
          if (decoded.args.perpId === this.perpId && decoded.args.posId === this.positionId) {
            // Position was fully closed, there's no new position ID
            newPositionId = null;
            break;
          }
        } catch (e) {
          // Skip logs that aren't the event we're looking for
          continue;
        }
      }

      // If position was fully closed, return null
      if (newPositionId === null || newPositionId === 0n) {
        return null;
      }

      // Return new OpenPosition with the remaining position
      return new OpenPosition(this.context, this.perpId, newPositionId, this.isLong, this.isMaker);
    }, `closePosition for ${this.isMaker ? 'maker' : 'taker'} position ${this.positionId}`);
  }

  async liveDetails(): Promise<LiveDetails> {
    return withErrorHandling(async () => {
      const { result } = await this.context.walletClient.simulateContract({
        address: this.context.deployments().perpManager,
        abi: PERP_MANAGER_ABI,
        functionName: 'livePositionDetails',
        args: [this.perpId, this.positionId],
        account: this.context.walletClient.account,
      });

      // Use formatUnits to safely convert bigint to decimal string, then parse to number
      return {
        pnl: Number(formatUnits(result[0] as bigint, 6)),
        fundingPayment: Number(formatUnits(result[1] as bigint, 6)),
        effectiveMargin: Number(formatUnits(result[2] as bigint, 6)),
        isLiquidatable: result[3] as boolean,
      };
    }, `liveDetails for position ${this.positionId}`);
  }
}
