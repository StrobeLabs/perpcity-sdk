import { getAddress } from "viem";
import { describe, expect, it } from "vitest";
import { type PerpCityContext as ContextType, PerpCityContext } from "../../context";
import type { PerpAddress, PerpCityHooks } from "../../types";
import { ContractError, TransactionRevertedError, withErrorHandling } from "../../utils/errors";
import { sendAndConfirm } from "../../utils/tx";

const HOLDER = getAddress("0x1111111111111111111111111111111111111111");
const USDC = getAddress("0x2222222222222222222222222222222222222222");
const PERP = getAddress("0x3333333333333333333333333333333333333333") as PerpAddress;
const TX_HASH = "0xabc0000000000000000000000000000000000000000000000000000000000123";

function makeWriteContext(opts: {
  status?: "success" | "reverted";
  hooks?: PerpCityHooks;
}): ContextType {
  return {
    hooks: opts.hooks,
    walletClient: {
      account: { address: HOLDER },
      writeContract: async () => TX_HASH,
    },
    publicClient: {
      estimateFeesPerGas: async () => ({ maxFeePerGas: 100n, maxPriorityFeePerGas: 0n }),
      waitForTransactionReceipt: async () => ({
        status: opts.status ?? "success",
        gasUsed: 321_000n,
      }),
    },
  } as unknown as ContextType;
}

describe("PerpCityContext config extensions", () => {
  const walletClient = { chain: { id: 421614 }, account: { address: HOLDER } } as never;

  it("uses an injected publicClient instead of building its own", () => {
    const injected = { marker: "injected" } as never;
    const context = new PerpCityContext({
      walletClient,
      rpcUrl: "http://localhost:8545",
      deployments: { usdc: USDC },
      publicClient: injected,
    });
    expect(context.publicClient).toBe(injected);
  });

  it("exposes configured hooks", () => {
    const hooks: PerpCityHooks = { onError: () => {} };
    const context = new PerpCityContext({
      walletClient,
      rpcUrl: "http://localhost:8545",
      deployments: { usdc: USDC },
      hooks,
    });
    expect(context.hooks).toBe(hooks);
  });

  it("builds its own publicClient when none is injected", () => {
    const context = new PerpCityContext({
      walletClient,
      rpcUrl: "http://localhost:8545",
      deployments: { usdc: USDC },
    });
    expect(context.publicClient).toBeDefined();
    expect(context.hooks).toBeUndefined();
  });
});

describe("sendAndConfirm", () => {
  it("fires onTxSubmitted and onTxConfirmed around a successful write", async () => {
    const submitted: unknown[] = [];
    const confirmed: unknown[] = [];
    const context = makeWriteContext({
      hooks: {
        onTxSubmitted: (event) => submitted.push(event),
        onTxConfirmed: (event) => confirmed.push(event),
      },
    });

    const { txHash, receipt } = await sendAndConfirm(
      context,
      "openTakerPosition",
      {},
      {
        perpAddress: PERP,
      }
    );

    expect(txHash).toBe(TX_HASH);
    expect(receipt.status).toBe("success");
    expect(submitted).toEqual([
      { operation: "openTakerPosition", txHash: TX_HASH, perpAddress: PERP },
    ]);
    expect(confirmed).toHaveLength(1);
    const event = confirmed[0] as {
      operation: string;
      txHash: string;
      status: string;
      gasUsed: bigint;
      durationMs: number;
    };
    expect(event.operation).toBe("openTakerPosition");
    expect(event.txHash).toBe(TX_HASH);
    expect(event.status).toBe("success");
    expect(event.gasUsed).toBe(321_000n);
    expect(event.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("throws TransactionRevertedError on a reverted receipt, after firing onTxConfirmed", async () => {
    const confirmed: Array<{ status: string }> = [];
    const context = makeWriteContext({
      status: "reverted",
      hooks: { onTxConfirmed: (event) => confirmed.push(event) },
    });

    await expect(sendAndConfirm(context, "adjustTaker", {})).rejects.toBeInstanceOf(
      TransactionRevertedError
    );
    expect(confirmed).toEqual([expect.objectContaining({ status: "reverted" })]);
  });

  it("a throwing hook never breaks the write", async () => {
    const context = makeWriteContext({
      hooks: {
        onTxSubmitted: () => {
          throw new Error("hook exploded");
        },
        onTxConfirmed: () => {
          throw new Error("hook exploded");
        },
      },
    });

    const { txHash } = await sendAndConfirm(context, "openTakerPosition", {});
    expect(txHash).toBe(TX_HASH);
  });

  it("works without hooks configured", async () => {
    const context = makeWriteContext({});
    const { receipt } = await sendAndConfirm(context, "closePosition", {});
    expect(receipt.gasUsed).toBe(321_000n);
  });
});

describe("withErrorHandling onError hook", () => {
  it("fires onError with the operation and parsed error", async () => {
    const errors: Array<{ operation: string; error: unknown }> = [];
    const hooks: PerpCityHooks = { onError: (event) => errors.push(event) };

    await expect(
      withErrorHandling(
        async () => {
          throw new ContractError("Margin is below the market minimum of $5.", "MarginTooLow", []);
        },
        "openTakerPosition",
        hooks
      )
    ).rejects.toBeInstanceOf(ContractError);

    expect(errors).toHaveLength(1);
    expect(errors[0].operation).toBe("openTakerPosition");
    expect((errors[0].error as ContractError).code).toBe("MARGIN_BELOW_MINIMUM");
  });

  it("a throwing onError does not mask the real error", async () => {
    const hooks: PerpCityHooks = {
      onError: () => {
        throw new Error("hook exploded");
      },
    };

    await expect(
      withErrorHandling(
        async () => {
          throw new ContractError("boom", "MarginTooLow", []);
        },
        "adjustTaker",
        hooks
      )
    ).rejects.toBeInstanceOf(ContractError);
  });
});
