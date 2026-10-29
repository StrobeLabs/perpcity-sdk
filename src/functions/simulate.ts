import {
  type Abi,
  type Address,
  type BlockTag,
  createPublicClient,
  decodeErrorResult,
  type Hex,
  http,
  type PublicClient,
} from "viem";
import { simulateCalls as viemSimulateCalls } from "viem/actions";
import { BEACON_ABI } from "../abis/beacon";
import { PERP_ABI } from "../abis/perp";
import { PERP_FACTORY_ABI } from "../abis/perp-factory";
import { PROTOCOL_FEE_MANAGER_ABI } from "../abis/protocol-fee-manager";
import type { PerpCityContext } from "../context";
import { type ContractError, contractErrorFromRevertData } from "../utils/errors";

export type SimulatedCall = { to: Hex; data: Hex; value?: bigint };

export type SimulationResult =
  | { ok: true; gasUsed: bigint }
  | { ok: false; failedIndex: number; error: ContractError; rawData: Hex }
  | { ok: null; reason: "rpc-unavailable" | "unsupported"; cause: unknown };

export type SimulateCallsOptions = {
  blockTag?: BlockTag;
  /** Give up and return `ok: null` after this many ms. Default 4000. */
  timeoutMs?: number;
};

const DEFAULT_SIMULATION_TIMEOUT_MS = 4_000;

/**
 * A one-shot client for the simulation: no retries and the same timeout as the
 * caller, so a slow or rate-limited RPC is not hit again after we give up.
 * Falls back to the context client when it has no RPC URL (test doubles).
 */
function simulationClient(ctx: PerpCityContext, timeoutMs: number): PublicClient {
  if (!ctx.rpcUrl) return ctx.publicClient;
  return createPublicClient({
    chain: ctx.publicClient.chain,
    transport: http(ctx.rpcUrl, { retryCount: 0, timeout: timeoutMs }),
  });
}

/** Uniswap v4 CustomRevert wrapper: hook and callback reverts arrive inside it. */
const WRAPPED_ERROR_ABI = [
  {
    type: "error",
    name: "WrappedError",
    inputs: [
      { type: "address", name: "target" },
      { type: "bytes4", name: "selector" },
      { type: "bytes", name: "reason" },
      { type: "bytes", name: "details" },
    ],
  },
] as const;

/** Every error the deployed perps, their modules, and the factory can throw. */
export const SIMULATION_ERROR_ABI = [
  ...PERP_ABI,
  ...PERP_FACTORY_ABI,
  ...PROTOCOL_FEE_MANAGER_ABI,
  ...BEACON_ABI,
].filter((item) => item.type === "error") as Abi;

const MAX_UNWRAP_DEPTH = 4;

/** Strip Uniswap v4 WrappedError layers so the inner Perp revert is decoded. */
export function unwrapRevertData(data: Hex): Hex {
  let current = data;
  for (let depth = 0; depth < MAX_UNWRAP_DEPTH; depth++) {
    try {
      const decoded = decodeErrorResult({ abi: WRAPPED_ERROR_ABI, data: current });
      current = decoded.args[2];
    } catch (_notWrapped) {
      return current;
    }
  }
  return current;
}

class SimulationTimeoutError extends Error {
  constructor(ms: number) {
    super(`Simulation timed out after ${ms} ms`);
    this.name = "SimulationTimeoutError";
  }
}

function isUnsupported(error: unknown): boolean {
  const text = `${(error as { message?: string })?.message ?? ""} ${
    (error as { details?: string })?.details ?? ""
  }`.toLowerCase();
  return (
    text.includes("eth_simulatev1") &&
    (text.includes("not supported") ||
      text.includes("does not exist") ||
      text.includes("not found") ||
      text.includes("not available"))
  );
}

/**
 * Simulate the exact calls a smart account (or EOA) would send, in order,
 * with state carried between calls (`eth_simulateV1`).
 *
 * `account` is the msg.sender of every call. Validation is off, so a
 * counterfactual (not yet deployed) or EIP-7702 sender works.
 *
 * The result is three-way: `ok: true` (all calls succeed), `ok: false` (the
 * first failing call, with its decoded revert), or `ok: null` when the RPC
 * cannot answer (error, HTTP 429, timeout, method unsupported). Callers
 * should fail open on `ok: null` and let the trade go.
 */
export async function simulateCalls(
  ctx: PerpCityContext,
  account: Address,
  calls: readonly SimulatedCall[],
  opts: SimulateCallsOptions = {}
): Promise<SimulationResult> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_SIMULATION_TIMEOUT_MS;
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new SimulationTimeoutError(timeoutMs)), timeoutMs);
    });
    const simulation = viemSimulateCalls(simulationClient(ctx, timeoutMs), {
      account,
      calls: calls.map((call) => ({ to: call.to, data: call.data, value: call.value })),
      ...(opts.blockTag ? { blockTag: opts.blockTag } : {}),
    });
    const { results } = await Promise.race([simulation, timeout]);

    let gasUsed = 0n;
    for (const [index, result] of results.entries()) {
      if (result.status === "failure") {
        const rawData = (result.data ?? "0x") as Hex;
        const error = contractErrorFromRevertData(
          unwrapRevertData(rawData),
          SIMULATION_ERROR_ABI,
          result.error
        );
        return { ok: false, failedIndex: index, error, rawData };
      }
      gasUsed += result.gasUsed ?? 0n;
    }
    return { ok: true, gasUsed };
  } catch (cause) {
    return {
      ok: null,
      reason: isUnsupported(cause) ? "unsupported" : "rpc-unavailable",
      cause,
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
}
