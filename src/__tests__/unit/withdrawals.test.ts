import {
  ContractFunctionRevertedError,
  decodeFunctionData,
  encodeAbiParameters,
  encodeErrorResult,
  encodeEventTopics,
  zeroAddress,
} from "viem";
import { describe, expect, it, vi } from "vitest";
import { PERP_ABI } from "../../abis/perp";
import { WITHDRAWAL_CONTROLLER_ABI } from "../../abis/withdrawal-controller";
import type { PerpCityContext } from "../../context";
import { buildAdjustTakerCall } from "../../functions/calldata";
import {
  buildReleaseWithdrawalClaimCall,
  decodeWithdrawalPayouts,
  effectiveWithdrawalCapacity,
  releaseWithdrawalClaim,
  type WithdrawalClaim,
  withdrawalEligibility,
} from "../../functions/withdrawals";

import { contractErrorFromRevertData } from "../../utils/errors";

const controller = "0x1111111111111111111111111111111111111111";
const perp = "0x2222222222222222222222222222222222222222";
const recipient = "0x3333333333333333333333333333333333333333";
const claim: WithdrawalClaim = {
  controller,
  id: 1n,
  originalAmount: 100n,
  currentAmount: 80n,
  recipient,
  createdAt: 100n,
  status: 1,
  paused: false,
};
const state = {
  controller,
  timestamp: 200n,
  challengeWindow: 100n,
  releasesPaused: false,
} as const;

describe("withdrawal eligibility", () => {
  it("uses the current window and honors both pauses even after maturity", () => {
    expect(withdrawalEligibility(claim, state).status).toBe("ready");
    expect(withdrawalEligibility(claim, { ...state, challengeWindow: 101n }).status).toBe(
      "pending"
    );
    expect(withdrawalEligibility(claim, { ...state, releasesPaused: true }).status).toBe("paused");
    expect(withdrawalEligibility({ ...claim, paused: true }, state).status).toBe("paused");
  });
  it("does not resurrect cancelled, released or nonexistent claims", () => {
    for (const [status, expected] of [
      [0, "unknown"],
      [2, "released"],
      [3, "cancelled"],
    ] as const) {
      expect(
        withdrawalEligibility({ ...claim, status }, { ...state, releasesPaused: true }).status
      ).toBe(expected);
    }
    expect(() => withdrawalEligibility(claim, { ...state, controller: perp })).toThrow("different");
  });
  it("saturates the shared bucket after long idle periods", () => {
    expect(
      effectiveWithdrawalCapacity({
        capacity: 100n,
        available: 10n,
        refillPerSecond: 1n,
        lastUpdated: 1n,
        timestamp: 1000000n,
      })
    ).toBe(100n);
    expect(
      effectiveWithdrawalCapacity({
        capacity: 0n,
        available: 0n,
        refillPerSecond: 0n,
        lastUpdated: 1n,
        timestamp: 1000000n,
      })
    ).toBe(0n);
  });
});

describe("withdrawal receipt outcomes", () => {
  it("retains multiple queued claims and rejects a spoofed emitter", () => {
    const logs = [1n, 2n].map((id, i) => ({
      address: controller,
      topics: encodeEventTopics({
        abi: WITHDRAWAL_CONTROLLER_ABI,
        eventName: "ClaimCreated",
        args: { claimId: id, recipient },
      }),
      data: encodeAbiParameters([{ type: "uint128" }], [100n]),
      logIndex: i,
      transactionHash: null,
    })) as unknown as Parameters<typeof decodeWithdrawalPayouts>[0];
    const results = decodeWithdrawalPayouts([...logs, { ...logs[0]!, address: recipient }], 42161, [
      { controller, perp },
    ]);
    expect(results.map((r) => [r.kind, r.claimId, r.amount, r.logIndex])).toEqual([
      ["queued", 1n, 100n, 0],
      ["queued", 2n, 100n, 1],
    ]);
  });
  it("builds a recipient-free release call usable by either wallet path", () => {
    const call = buildReleaseWithdrawalClaimCall(controller, 1n);
    expect(decodeFunctionData({ abi: WITHDRAWAL_CONTROLLER_ABI, data: call.data })).toEqual({
      functionName: "release",
      args: [1n],
    });
    expect(() => buildReleaseWithdrawalClaimCall(zeroAddress, 1n)).toThrow();
    expect(() => buildReleaseWithdrawalClaimCall(controller, 0n)).toThrow();
  });
  it("never broadcasts when current on-chain simulation rejects release", async () => {
    const writeContract = vi.fn();
    const ctx = {
      validateChainId: vi.fn(),
      publicClient: {
        simulateContract: vi.fn().mockRejectedValue(
          new ContractFunctionRevertedError({
            abi: WITHDRAWAL_CONTROLLER_ABI,
            functionName: "release",
            data: encodeErrorResult({
              abi: WITHDRAWAL_CONTROLLER_ABI,
              errorName: "ClaimNotReady",
            }),
          })
        ),
      },
      walletClient: { writeContract },
    } as unknown as PerpCityContext;
    await expect(releaseWithdrawalClaim(ctx, controller, 1n)).rejects.toMatchObject({
      code: "WITHDRAWAL_NOT_READY",
    });
    expect(writeContract).not.toHaveBeenCalled();
  });
});

describe("new-generation calls and reverts", () => {
  it("encodes reduce-only closes with the new fee and deadline fields", () => {
    const params = {
      posId: 10n,
      marginDelta: 0n,
      perpDelta: -50n,
      amt1Limit: 20n,
      maxTotalFee: 1n,
      reduceOnly: true,
      deadline: 1000n,
    };
    const call = buildAdjustTakerCall(perp, params);
    expect(decodeFunctionData({ abi: PERP_ABI, data: call.data })).toEqual({
      functionName: "adjustTaker",
      args: [params],
    });
    expect(call.value).toBe(0n);
  });
  it("decodes withdrawal and admission failures without automatic retries", () => {
    for (const [errorName, code] of [
      ["ClaimNotReady", "WITHDRAWAL_NOT_READY"],
      ["ClaimNotPending", "WITHDRAWAL_NOT_PENDING"],
      ["ClaimIsPaused", "WITHDRAWAL_PAUSED"],
      ["ReleasesArePaused", "WITHDRAWAL_PAUSED"],
      ["TvlCapExceeded", "TVL_CAP_EXCEEDED"],
    ] as const) {
      const data = encodeErrorResult({ abi: WITHDRAWAL_CONTROLLER_ABI, errorName });
      const error = contractErrorFromRevertData(data);
      expect(error.code).toBe(code);
    }
  });
});
