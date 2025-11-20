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
  public readonly txHash?: Hex;

  constructor(context: PerpCityContext, perpId: Hex, positionId: bigint, isLong?: boolean, isMaker?: boolean, txHash?: Hex) {
    this.context = context;
    this.perpId = perpId;
    this.positionId = positionId;
    this.isLong = isLong;
    this.isMaker = isMaker;
    this.txHash = txHash;
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
        args: [contractParams],
        account: this.context.walletClient.account,
        gas: 500000n, // Provide explicit gas limit to avoid estimation issues
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

      // Scan transaction events to determine if this was a partial or full close
      // For partial closes, a PositionOpened event is emitted with the new position ID
      // For full closes, a PositionClosed event is emitted
      let newPositionId: bigint | null = null;
      let wasFullyClosed = false;

      for (const log of receipt.logs) {
        try {
          // Check for PositionOpened event (partial close)
          const openedDecoded = decodeEventLog({
            abi: PERP_MANAGER_ABI,
            data: log.data,
            topics: log.topics,
            eventName: 'PositionOpened',
          });

          // Match the perpId and extract the new position ID
          if (openedDecoded.args.perpId === this.perpId) {
            newPositionId = openedDecoded.args.posId as bigint;
            break;
          }
        } catch (e) {
          // Not a PositionOpened event, try PositionClosed
          try {
            const closedDecoded = decodeEventLog({
              abi: PERP_MANAGER_ABI,
              data: log.data,
              topics: log.topics,
              eventName: 'PositionClosed',
            });

            // If this position was fully closed, mark it
            if (closedDecoded.args.perpId === this.perpId && closedDecoded.args.posId === this.positionId) {
              wasFullyClosed = true;
              break;
            }
          } catch (e2) {
            // Neither event, skip
            continue;
          }
        }
      }

      // If no new position ID, this was a full close
      if (!newPositionId) {
        return null;
      }

      // Return new OpenPosition with the new position from partial close
      return new OpenPosition(this.context, this.perpId, newPositionId, this.isLong, this.isMaker, txHash);
    }, `closePosition for ${this.isMaker ? 'maker' : 'taker'} position ${this.positionId}`);
  }

  async liveDetails(): Promise<LiveDetails> {
    return withErrorHandling(async () => {
      // Use quoteClosePosition which provides live position details
      const result = (await this.context.walletClient.readContract({
        address: this.context.deployments().perpManager,
        abi: PERP_MANAGER_ABI,
        functionName: 'quoteClosePosition' as any,
        args: [this.positionId],
      }) as unknown) as readonly [boolean, bigint, bigint, bigint, boolean];

      // The result is a tuple: [success, pnl, funding, netMargin, wasLiquidated]
      const [success, pnl, funding, netMargin, wasLiquidated] = result;

      if (!success) {
        throw new Error(`Failed to quote position ${this.positionId} - position may be invalid or already closed`);
      }

      return {
        pnl: Number(formatUnits(pnl, 6)),
        fundingPayment: Number(formatUnits(funding, 6)),
        effectiveMargin: Number(formatUnits(netMargin, 6)),
        isLiquidatable: wasLiquidated,
      };
    }, `liveDetails for position ${this.positionId}`);
  }
}
