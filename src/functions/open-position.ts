import type { Hex } from "viem";
import { decodeEventLog, formatUnits } from "viem";
import { PERP_MANAGER_ABI } from "../abis/perp-manager";
import type { PerpCityContext } from "../context";
import type { ClosePositionParams, ClosePositionResult, LiveDetails } from "../types/entity-data";
import { scale6Decimals } from "../utils";
import { withErrorHandling } from "../utils/errors";

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
    return withErrorHandling(
      async () => {
        const contractParams = {
          posId: this.positionId,
          minAmt0Out: scale6Decimals(params.minAmt0Out),
          minAmt1Out: scale6Decimals(params.minAmt1Out),
          maxAmt1In: scale6Decimals(params.maxAmt1In),
        };

        // Simulate the transaction first - this will catch contract errors early
        const { request } = await this.context.publicClient.simulateContract({
          address: this.context.deployments().perpManager,
          abi: PERP_MANAGER_ABI,
          functionName: "closePosition",
          args: [contractParams],
          account: this.context.walletClient.account,
          gas: 500000n, // Provide explicit gas limit to avoid estimation issues
        });

        // Execute the transaction
        const txHash = await this.context.walletClient.writeContract(request);

        // Wait for transaction confirmation
        const receipt = await this.context.publicClient.waitForTransactionReceipt({ hash: txHash });

        // Check if transaction was successful
        if (receipt.status === "reverted") {
          throw new Error(`Transaction reverted. Hash: ${txHash}`);
        }

        // Scan transaction events to determine if this was a partial or full close
        // For partial closes, a PositionOpened event is emitted with the new position ID
        // For full closes, a PositionClosed event is emitted
        let newPositionId: bigint | null = null;
        let _wasFullyClosed = false;

        for (const log of receipt.logs) {
          try {
            // Check for PositionOpened event (partial close)
            const openedDecoded = decodeEventLog({
              abi: PERP_MANAGER_ABI,
              data: log.data,
              topics: log.topics,
              eventName: "PositionOpened",
            });

            // Match the perpId (case-insensitive) and extract the new position ID
            // For partial closes, a NEW position is created with a DIFFERENT posId
            const eventPerpId = (openedDecoded.args.perpId as string).toLowerCase();
            const eventPosId = openedDecoded.args.posId as bigint;

            if (eventPerpId === this.perpId.toLowerCase() && eventPosId !== this.positionId) {
              newPositionId = eventPosId;
              break;
            }
          } catch (_e) {
            // Not a PositionOpened event, try PositionClosed
            try {
              const closedDecoded = decodeEventLog({
                abi: PERP_MANAGER_ABI,
                data: log.data,
                topics: log.topics,
                eventName: "PositionClosed",
              });

              // If this position was fully closed, mark it (case-insensitive perpId comparison)
              const closedPerpId = (closedDecoded.args.perpId as string).toLowerCase();
              if (
                closedPerpId === this.perpId.toLowerCase() &&
                closedDecoded.args.posId === this.positionId
              ) {
                _wasFullyClosed = true;
                break;
              }
            } catch (_e2) {}
          }
        }

        // If no new position ID, this was a full close
        if (!newPositionId) {
          return { position: null, txHash };
        }

        // Return new OpenPosition with the new position from partial close
        return {
          position: new OpenPosition(
            this.context,
            this.perpId,
            newPositionId,
            this.isLong,
            this.isMaker,
            txHash
          ),
          txHash,
        };
      },
      `closePosition for ${this.isMaker ? "maker" : "taker"} position ${this.positionId}`
    );
  }

  async liveDetails(): Promise<LiveDetails> {
    return withErrorHandling(async () => {
      // Use quoteClosePosition which provides live position details
      const result = (await this.context.publicClient.readContract({
        address: this.context.deployments().perpManager,
        abi: PERP_MANAGER_ABI,
        functionName: "quoteClosePosition" as any,
        args: [this.positionId],
      })) as unknown as readonly [boolean, bigint, bigint, bigint, boolean];

      // The result is a tuple: [success, pnl, funding, netMargin, wasLiquidated]
      const [success, pnl, funding, netMargin, wasLiquidated] = result;

      if (!success) {
        throw new Error(
          `Failed to quote position ${this.positionId} - position may be invalid or already closed`
        );
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
