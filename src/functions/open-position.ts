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

      // Extract the new position ID from transaction events
      // For partial closes, a new PositionOpened event is emitted with the new position ID
      // For full closes, only PositionClosed is emitted
      let newPositionId: bigint | null = null;
      let positionWasClosed = false;

      for (const log of receipt.logs) {
        try {
          // Check for PositionClosed event
          const closedDecoded = decodeEventLog({
            abi: PERP_MANAGER_ABI,
            data: log.data,
            topics: log.topics,
            eventName: 'PositionClosed',
          });

          if (closedDecoded.args.perpId === this.perpId && closedDecoded.args.posId === this.positionId) {
            positionWasClosed = true;
          }
        } catch (e) {
          // Not a PositionClosed event, try PositionOpened
          try {
            const openedDecoded = decodeEventLog({
              abi: PERP_MANAGER_ABI,
              data: log.data,
              topics: log.topics,
              eventName: 'PositionOpened',
            });

            // For partial closes, a new position is opened with a new ID
            if (openedDecoded.args.perpId === this.perpId) {
              newPositionId = openedDecoded.args.posId;
            }
          } catch (e2) {
            // Skip logs that aren't relevant events
            continue;
          }
        }
      }

      // If no new position was opened, this was a full close
      if (!newPositionId || newPositionId === 0n) {
        return null;
      }

      // Return new OpenPosition with the new position from partial close
      return new OpenPosition(this.context, this.perpId, newPositionId, this.isLong, this.isMaker);
    }, `closePosition for ${this.isMaker ? 'maker' : 'taker'} position ${this.positionId}`);
  }

  async liveDetails(): Promise<LiveDetails> {
    return withErrorHandling(async () => {
      // livePositionDetails is marked nonpayable in ABI but can be called read-only
      const result = (await this.context.walletClient.readContract({
        address: this.context.deployments().perpManager,
        abi: PERP_MANAGER_ABI,
        functionName: 'livePositionDetails' as any,
        args: [this.perpId, this.positionId],
      }) as unknown) as readonly [bigint, bigint, bigint, boolean, bigint];

      // Use formatUnits to safely convert bigint to decimal, then parse to number
      // The result is a tuple: [pnl, fundingPayment, effectiveMargin, isLiquidatable, newPriceX96]
      return {
        pnl: Number(formatUnits(result[0], 6)),
        fundingPayment: Number(formatUnits(result[1], 6)),
        effectiveMargin: Number(formatUnits(result[2], 6)),
        isLiquidatable: result[3],
      };
    }, `liveDetails for position ${this.positionId}`);
  }
}
