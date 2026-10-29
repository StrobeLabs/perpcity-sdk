import {
  createPublicClient,
  custom,
  encodeAbiParameters,
  encodeErrorResult,
  type Hex,
  HttpRequestError,
  keccak256,
  toBytes,
} from "viem";
import { arbitrum } from "viem/chains";
import { describe, expect, it, vi } from "vitest";
import { PERP_ABI } from "../../abis/perp";
import type { PerpCityContext } from "../../context";
import { simulateCalls, unwrapRevertData } from "../../functions/simulate";

const ACCOUNT = "0x925e000000000000000000000000000000000001";
const USDC = "0xaf88d065e77c8cc2239327c5edb3a432268e5831";
const PERP = "0x796f000000000000000000000000000000000002";

const CALLS = [
  { to: USDC, data: "0x095ea7b3" as Hex },
  { to: PERP, data: "0x12345678" as Hex },
] as const;

const LONG_UTIL_EXCEEDED = keccak256(toBytes("LongUtilizationExceeded()")).slice(0, 10) as Hex;

type FakeCall = { status: "0x1" | "0x0"; returnData: Hex; gasUsed: Hex; error?: { data: Hex } };

// viem appends a trailing zero-address call to every batch and drops its result.
function block(calls: FakeCall[]) {
  const sentinel: FakeCall = { status: "0x1", returnData: "0x", gasUsed: "0x0" };
  return {
    number: "0x1",
    hash: `0x${"11".repeat(32)}`,
    parentHash: `0x${"22".repeat(32)}`,
    timestamp: "0x1",
    gasLimit: "0x1c9c380",
    gasUsed: "0x0",
    baseFeePerGas: "0x0",
    transactions: [],
    logs: [],
    calls: [...calls, sentinel],
  };
}

function contextWith(request: (args: { method: string; params: unknown }) => Promise<unknown>) {
  const publicClient = createPublicClient({
    chain: arbitrum,
    transport: custom({ request: request as never }, { retryCount: 0 }),
  });
  return { publicClient } as unknown as PerpCityContext;
}

describe("simulateCalls", () => {
  it("returns ok with summed gas when every call succeeds", async () => {
    const request = vi.fn(async ({ method }: { method: string; params?: unknown }) => {
      expect(method).toBe("eth_simulateV1");
      return [
        block([
          { status: "0x1", returnData: "0x", gasUsed: "0x5208" },
          { status: "0x1", returnData: "0x", gasUsed: "0x100" },
        ]),
      ];
    });

    const result = await simulateCalls(contextWith(request), ACCOUNT, CALLS);

    expect(result).toEqual({ ok: true, gasUsed: 0x5208n + 0x100n });
    const params = request.mock.calls[0]?.[0].params as [
      { blockStateCalls: { calls: { from: string }[] }[]; validation?: boolean },
    ];
    // Two real calls plus viem's trailing sentinel, all sent from the account.
    expect(params[0].blockStateCalls[0]?.calls.map((c) => c.from)).toEqual([
      ACCOUNT,
      ACCOUNT,
      ACCOUNT,
    ]);
    expect(params[0].validation).toBeFalsy();
  });

  it("decodes a revert at index 1 to LongUtilizationExceeded / UTILIZATION_EXCEEDED", async () => {
    const result = await simulateCalls(
      contextWith(async () => [
        block([
          { status: "0x1", returnData: "0x", gasUsed: "0x5208" },
          {
            status: "0x0",
            returnData: "0x",
            gasUsed: "0x100",
            error: { data: LONG_UTIL_EXCEEDED },
          },
        ]),
      ]),
      ACCOUNT,
      CALLS
    );

    expect(result.ok).toBe(false);
    if (result.ok !== false) return;
    expect(result.failedIndex).toBe(1);
    expect(result.error.errorName).toBe("LongUtilizationExceeded");
    expect(result.error.code).toBe("UTILIZATION_EXCEEDED");
    expect(result.rawData).toBe(LONG_UTIL_EXCEEDED);
  });

  it("unwraps a Uniswap v4 WrappedError before decoding", async () => {
    const inner = encodeErrorResult({ abi: PERP_ABI, errorName: "MarginRatioTooLow" });
    const wrapped = (keccak256(toBytes("WrappedError(address,bytes4,bytes,bytes)")).slice(0, 10) +
      encodeAbiParameters(
        [{ type: "address" }, { type: "bytes4" }, { type: "bytes" }, { type: "bytes" }],
        [PERP, "0x12345678", inner, "0x"]
      ).slice(2)) as Hex;

    expect(unwrapRevertData(wrapped)).toBe(inner);

    const result = await simulateCalls(
      contextWith(async () => [
        block([{ status: "0x0", returnData: "0x", gasUsed: "0x1", error: { data: wrapped } }]),
      ]),
      ACCOUNT,
      [CALLS[1]]
    );
    expect(result.ok === false && result.error.code).toBe("MARGIN_RATIO_TOO_LOW");
  });

  it("maps an empty revert to UNKNOWN", async () => {
    const result = await simulateCalls(
      contextWith(async () => [
        block([{ status: "0x0", returnData: "0x", gasUsed: "0x1", error: { data: "0x" } }]),
      ]),
      ACCOUNT,
      [CALLS[1]]
    );
    expect(result.ok === false && result.error.code).toBe("UNKNOWN");
  });

  it("fails open on HTTP 429", async () => {
    const result = await simulateCalls(
      contextWith(async () => {
        throw new HttpRequestError({
          url: "https://rpc",
          status: 429,
          details: "Too Many Requests",
        });
      }),
      ACCOUNT,
      CALLS
    );
    expect(result.ok).toBeNull();
    expect(result.ok === null && result.reason).toBe("rpc-unavailable");
  });

  it("fails open on timeout", async () => {
    const result = await simulateCalls(
      contextWith(() => new Promise(() => {})),
      ACCOUNT,
      CALLS,
      { timeoutMs: 20 }
    );
    expect(result.ok).toBeNull();
    expect(result.ok === null && result.reason).toBe("rpc-unavailable");
  });

  it("reports an RPC without eth_simulateV1 as unsupported", async () => {
    const result = await simulateCalls(
      contextWith(async () => {
        throw new Error("the method eth_simulateV1 does not exist/is not available");
      }),
      ACCOUNT,
      CALLS
    );
    expect(result.ok === null && result.reason).toBe("unsupported");
  });

  it("sends one request with no retry when the RPC answers 429", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("rate limited", { status: 429 }));
    try {
      const ctx = {
        rpcUrl: "https://rpc.example",
        publicClient: createPublicClient({
          chain: arbitrum,
          transport: custom({ request: vi.fn() }),
        }),
      } as unknown as PerpCityContext;
      const result = await simulateCalls(ctx, ACCOUNT, CALLS);
      expect(result.ok).toBeNull();
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    } finally {
      fetchSpy.mockRestore();
    }
  });
});
