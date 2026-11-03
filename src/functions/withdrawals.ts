import {
  type Address,
  type ContractFunctionArgs,
  type ContractFunctionName,
  decodeEventLog,
  encodeFunctionData,
  getAddress,
  type Hex,
  type Log,
  type PublicClient,
  zeroAddress,
} from "viem";
import {
  PROTECTED_PERP_ACTION_ABI,
  WITHDRAWAL_CONTROLLER_ABI,
} from "../abis/withdrawal-controller";
import type { PerpCityContext } from "../context";
import { TransactionRevertedError, withErrorHandling } from "../utils/errors";
import { withFeeHeadroom } from "../utils/fees";

export type WithdrawalClaim = {
  id: bigint;
  controller: Address;
  originalAmount: bigint;
  currentAmount: bigint;
  recipient: Address;
  createdAt: bigint;
  status: number;
  paused: boolean;
};

export type WithdrawalControllerState = {
  controller: Address;
  perp: Address;
  blockNumber: bigint;
  timestamp: bigint;
  challengeWindow: bigint;
  releasesPaused: boolean;
  totalReserved: bigint;
  capacity: bigint;
  available: bigint;
  refillPerSecond: bigint;
  lastUpdated: bigint;
};

/** Evaluate using the timestamp and configuration of the same chain snapshot. */
export function withdrawalEligibility(
  claim: WithdrawalClaim,
  state: Pick<
    WithdrawalControllerState,
    "controller" | "timestamp" | "challengeWindow" | "releasesPaused"
  >
): {
  status: "unknown" | "pending" | "ready" | "paused" | "released" | "cancelled";
  readyAt: bigint;
} {
  if (getAddress(claim.controller) !== getAddress(state.controller)) {
    throw new Error("Claim belongs to a different withdrawal controller");
  }
  const readyAt = claim.createdAt + state.challengeWindow;
  if (claim.status === 2) return { status: "released", readyAt };
  if (claim.status === 3) return { status: "cancelled", readyAt };
  if (claim.status !== 1) return { status: "unknown", readyAt };
  if (state.releasesPaused || claim.paused) return { status: "paused", readyAt };
  return { status: state.timestamp >= readyAt ? "ready" : "pending", readyAt };
}

export function effectiveWithdrawalCapacity(
  state: Pick<
    WithdrawalControllerState,
    "capacity" | "available" | "refillPerSecond" | "lastUpdated" | "timestamp"
  >
): bigint {
  const elapsed = state.timestamp > state.lastUpdated ? state.timestamp - state.lastUpdated : 0n;
  const available = state.available + elapsed * state.refillPerSecond;
  return available < state.capacity ? available : state.capacity;
}

export async function readWithdrawalController(
  client: PublicClient,
  controller: Address,
  blockNumber?: bigint
): Promise<WithdrawalControllerState> {
  if (getAddress(controller) === zeroAddress)
    throw new Error("Withdrawal controller is not configured");
  const block = await client.getBlock(blockNumber === undefined ? {} : { blockNumber });
  const base = { address: controller, abi: WITHDRAWAL_CONTROLLER_ABI, blockNumber: block.number };
  const [perp, challengeWindow, releasesPaused, totalReserved, bucket] = await Promise.all([
    client.readContract({ ...base, functionName: "perp" }),
    client.readContract({ ...base, functionName: "challengeWindow" }),
    client.readContract({ ...base, functionName: "releasesPaused" }),
    client.readContract({ ...base, functionName: "totalReserved" }),
    client.readContract({ ...base, functionName: "rateLimit" }),
  ]);
  return {
    controller,
    perp,
    blockNumber: block.number,
    timestamp: block.timestamp,
    challengeWindow: BigInt(challengeWindow),
    releasesPaused,
    totalReserved,
    capacity: bucket[0],
    available: bucket[1],
    refillPerSecond: bucket[2],
    lastUpdated: BigInt(bucket[3]),
  };
}

export async function readWithdrawalClaim(
  client: PublicClient,
  controller: Address,
  id: bigint,
  blockNumber: bigint
): Promise<WithdrawalClaim> {
  if (id <= 0n) throw new Error("Claim id must be positive");
  const [originalAmount, currentAmount, recipient, createdAt, status, paused] =
    await client.readContract({
      address: controller,
      abi: WITHDRAWAL_CONTROLLER_ABI,
      functionName: "claims",
      args: [id],
      blockNumber,
    });
  return {
    controller,
    id,
    originalAmount,
    currentAmount,
    recipient,
    createdAt: BigInt(createdAt),
    status,
    paused,
  };
}

export function buildReleaseWithdrawalClaimCall(controller: Address, claimId: bigint) {
  if (getAddress(controller) === zeroAddress || claimId <= 0n)
    throw new Error("A controller and positive claim id are required");
  return {
    to: getAddress(controller),
    value: 0n,
    data: encodeFunctionData({
      abi: WITHDRAWAL_CONTROLLER_ABI,
      functionName: "release",
      args: [claimId],
    }),
  };
}

export async function releaseWithdrawalClaim(
  context: PerpCityContext,
  controller: Address,
  claimId: bigint
) {
  return withErrorHandling(async () => {
    buildReleaseWithdrawalClaimCall(controller, claimId);
    await context.validateChainId();
    const { request } = await context.publicClient.simulateContract({
      address: controller,
      abi: WITHDRAWAL_CONTROLLER_ABI,
      functionName: "release",
      args: [claimId],
      account: context.walletClient.account,
    });
    const txHash = await context.walletClient.writeContract(
      await withFeeHeadroom(context.publicClient, request)
    );
    const receipt = await context.publicClient.waitForTransactionReceipt({ hash: txHash });
    if (receipt.status === "reverted") throw new TransactionRevertedError(txHash);
    return { txHash, receipt };
  }, `releaseWithdrawalClaim for claim ${claimId}`);
}

export type WithdrawalPayout = {
  kind: "instant" | "queued";
  chainId: number;
  controller: Address;
  perp: Address;
  recipient: Address;
  amount: bigint;
  claimId?: bigint;
  transactionHash: Hex | null;
  logIndex: number | null;
};

/** Only accept logs from caller-verified controller/perp bindings. A receipt can contain many payouts. */
export function decodeWithdrawalPayouts(
  logs: readonly Pick<Log, "address" | "topics" | "data" | "transactionHash" | "logIndex">[],
  chainId: number,
  bindings: readonly { controller: Address; perp: Address }[]
): WithdrawalPayout[] {
  const byController = new Map(bindings.map((b) => [getAddress(b.controller), getAddress(b.perp)]));
  const payouts: WithdrawalPayout[] = [];
  for (const log of logs) {
    const controller = getAddress(log.address);
    const perp = byController.get(controller);
    if (!perp) continue;
    try {
      const decoded = decodeEventLog({
        abi: WITHDRAWAL_CONTROLLER_ABI,
        topics: log.topics,
        data: log.data,
      });
      if (decoded.eventName !== "InstantPayout" && decoded.eventName !== "ClaimCreated") continue;
      payouts.push({
        kind: decoded.eventName === "ClaimCreated" ? "queued" : "instant",
        chainId,
        controller,
        perp,
        recipient: decoded.args.recipient,
        amount: decoded.args.amount,
        ...(decoded.eventName === "ClaimCreated" ? { claimId: decoded.args.claimId } : {}),
        transactionHash: log.transactionHash,
        logIndex: log.logIndex,
      });
    } catch {
      /* Ignore unrelated or malformed logs; never infer a payout from them. */
    }
  }
  return payouts;
}

export type ProtectedPerpAction = ContractFunctionName<typeof PROTECTED_PERP_ACTION_ABI>;
export type ProtectedPerpActionArgs<T extends ProtectedPerpAction> = ContractFunctionArgs<
  typeof PROTECTED_PERP_ACTION_ABI,
  "nonpayable",
  T
>;

/** No version inference or legacy position math. Callers supply reviewed limits. */
export function buildProtectedPerpCall<T extends ProtectedPerpAction>(
  perp: Address,
  action: T,
  args: ProtectedPerpActionArgs<T>
) {
  if (getAddress(perp) === zeroAddress) throw new Error("A Perp address is required");
  // The public generic enforces that arguments match the selected function.
  const data = encodeFunctionData({
    abi: PROTECTED_PERP_ACTION_ABI,
    functionName: action,
    args,
  } as Parameters<typeof encodeFunctionData<typeof PROTECTED_PERP_ACTION_ABI>>[0]);
  return { to: getAddress(perp), data, value: 0n };
}
