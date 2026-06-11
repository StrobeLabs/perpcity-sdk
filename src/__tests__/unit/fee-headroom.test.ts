import { encodeAbiParameters, keccak256, toBytes } from "viem";
import { describe, expect, it, vi } from "vitest";
import type { PerpCityContext } from "../../context";
import { openTakerPosition } from "../../functions/perp-actions";
import { approveUsdc } from "../../utils/approve";
import { estimateFeesWithHeadroom, withFeeHeadroom } from "../../utils/fees";

const USDC = "0xbef280befee2cb28c20d1e4cc1da999b4da0f1fd";
const PERP = "0x6d4051ffb71f391a5b4d8643a29ec6f66f67df50";
const HOLDER = "0xcfd9841343cc86779d4162d38757bc2899ac7385";

const TAKER_OPENED_TOPIC = keccak256(
  toBytes("TakerOpened(uint256,(int256,uint256,int256,uint256,uint256,uint256,uint256))")
);

function makeFakeContext(opts: { allowance: bigint }) {
  const simulateContract = vi.fn(async (args: Record<string, unknown>) => ({
    // Echo the call args back as the prepared request, like viem does.
    request: { ...args },
  }));
  const writeContract = vi.fn(async () => "0xtxhash");
  const publicClient = {
    simulateContract,
    estimateFeesPerGas: vi.fn(async () => ({
      maxFeePerGas: 100n,
      maxPriorityFeePerGas: 7n,
    })),
    readContract: vi.fn(async () => opts.allowance),
    waitForTransactionReceipt: vi.fn(async () => ({
      status: "success",
      logs: [
        {
          address: PERP,
          topics: [TAKER_OPENED_TOPIC],
          data: encodeAbiParameters([{ type: "uint256" }], [1n]),
        },
      ],
    })),
  };
  const walletClient = {
    account: { address: HOLDER },
    chain: { id: 421614 },
    writeContract,
  };
  const context = {
    publicClient,
    walletClient,
    deployments: () => ({ usdc: USDC, perpAddress: PERP }),
  } as unknown as PerpCityContext;
  return { context, simulateContract, writeContract };
}

describe("fee headroom helpers", () => {
  it("doubles maxFeePerGas and keeps the priority fee", async () => {
    const { context } = makeFakeContext({ allowance: 0n });
    const fees = await estimateFeesWithHeadroom(context.publicClient);
    expect(fees).toEqual({ maxFeePerGas: 200n, maxPriorityFeePerGas: 7n });
  });

  it("merges fees into a request without dropping fields", async () => {
    const { context } = makeFakeContext({ allowance: 0n });
    const request = { to: PERP, functionName: "openTaker" };
    const withFees = await withFeeHeadroom(context.publicClient, request);
    expect(withFees).toEqual({
      to: PERP,
      functionName: "openTaker",
      maxFeePerGas: 200n,
      maxPriorityFeePerGas: 7n,
    });
  });
});

// Regression: fee fields inside the simulation's eth_call make some Arbitrum
// providers (Alchemy) run the balance check against the RPC gas cap (uint64
// max), rejecting every call with insufficient-funds. Fees must therefore
// ride ONLY on the write.
describe("fee fields stay out of simulation and on the write", () => {
  it("approveUsdc simulates without fees and writes with doubled fees", async () => {
    const { context, simulateContract, writeContract } = makeFakeContext({
      allowance: 0n,
    });

    await approveUsdc(context, 123n, PERP, 0);

    expect(simulateContract).toHaveBeenCalledTimes(1);
    const simArgs = simulateContract.mock.calls[0][0];
    expect("maxFeePerGas" in simArgs).toBe(false);
    expect("maxPriorityFeePerGas" in simArgs).toBe(false);

    expect(writeContract).toHaveBeenCalledTimes(1);
    const writeArgs = (writeContract.mock.calls[0] as unknown[])[0] as Record<string, unknown>;
    expect(writeArgs.maxFeePerGas).toBe(200n);
    expect(writeArgs.maxPriorityFeePerGas).toBe(7n);
    expect(writeArgs.functionName).toBe("approve");
  });

  it("openTakerPosition simulates without fees and writes with doubled fees", async () => {
    // Large allowance so the flow skips approve and we assert on the
    // openTaker call itself.
    const { context, simulateContract, writeContract } = makeFakeContext({
      allowance: 10n ** 18n,
    });

    await openTakerPosition(context, PERP as `0x${string}`, {
      margin: 10,
      perpDelta: 400000n,
      amt1Limit: 0n,
    });

    expect(simulateContract).toHaveBeenCalledTimes(1);
    const simArgs = simulateContract.mock.calls[0][0];
    expect(simArgs.functionName).toBe("openTaker");
    expect("maxFeePerGas" in simArgs).toBe(false);
    expect("maxPriorityFeePerGas" in simArgs).toBe(false);

    expect(writeContract).toHaveBeenCalledTimes(1);
    const writeArgs = (writeContract.mock.calls[0] as unknown[])[0] as Record<string, unknown>;
    expect(writeArgs.maxFeePerGas).toBe(200n);
    expect(writeArgs.maxPriorityFeePerGas).toBe(7n);
    expect(writeArgs.functionName).toBe("openTaker");
  });
});
