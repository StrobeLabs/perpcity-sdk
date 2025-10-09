import type { Hex } from "viem";
import { publicActions, formatUnits } from "viem";
import { PerpCityContext } from "../context";
import { scale6Decimals, scaleFrom6Decimals } from "../utils";
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
    const contractParams = {
      posId: this.positionId,
      minAmt0Out: scale6Decimals(params.minAmt0Out),
      minAmt1Out: scale6Decimals(params.minAmt1Out),
      maxAmt1In: scale6Decimals(params.maxAmt1In),
    };
    
    // Simulate the transaction first
    const { request } = await this.context.walletClient.extend(publicActions).simulateContract({
      address: this.context.deployments().perpManager,
      abi: PERP_MANAGER_ABI,
      functionName: 'closePosition',
      args: [this.perpId, contractParams],
      account: this.context.walletClient.account,
    });

    let txHash: Hex;
    try {
      // Execute the transaction
      txHash = await this.context.walletClient.writeContract(request);
    } catch (error: any) {
      // Handle user rejection, gas errors, etc.
      if (error.message?.includes('User rejected') || error.code === 4001) {
        throw new Error('Transaction rejected by user');
      }
      if (error.message?.includes('insufficient funds')) {
        throw new Error('Insufficient funds for transaction');
      }
      throw new Error(`Transaction failed: ${error.message || 'Unknown error'}`);
    }

    // Wait for transaction confirmation
    const publicClient = this.context.walletClient.extend(publicActions);
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

    // Check if transaction was successful
    if (receipt.status === 'reverted') {
      throw new Error(`Transaction reverted. Hash: ${txHash}`);
    }

    // Parse the transaction logs to extract the actual returned position ID
    // The closePosition function returns a new position ID or null
    let newPositionId: bigint | null = null;
    
    // Look for PositionClosed or similar event in logs
    for (const log of receipt.logs) {
      try {
        // Attempt to decode the log - this is a simplified approach
        // In a real implementation, you'd decode specific events
        if (log.topics.length > 0 && log.data !== '0x') {
          // The contract returns the new position ID in the event or as a return value
          // For now, we'll extract it from the receipt (implementation depends on contract ABI)
          // This is a placeholder - adjust based on your actual contract event structure
          const dataWithoutPrefix = log.data.slice(2);
          if (dataWithoutPrefix.length >= 64) {
            const potentialPositionId = BigInt('0x' + dataWithoutPrefix.slice(0, 64));
            if (potentialPositionId > 0n) {
              newPositionId = potentialPositionId;
              break;
            }
          }
        }
      } catch (e) {
        // Skip logs that can't be decoded
        continue;
      }
    }

    // If no position ID found in logs, position was fully closed
    if (newPositionId === null || newPositionId === 0n) {
      return null;
    }

    // Return new OpenPosition with confirmed on-chain data
    return new OpenPosition(this.context, this.perpId, newPositionId, this.isLong, this.isMaker);
  }

  async liveDetails(): Promise<LiveDetails> {
    const { result, request } = await this.context.walletClient.simulateContract({
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
  }
}
