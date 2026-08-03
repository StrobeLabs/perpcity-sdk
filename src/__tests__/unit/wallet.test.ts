import { getAddress } from "viem";
import { describe, expect, it } from "vitest";
import type { PerpCityContext } from "../../context";
import {
  getGasBalance,
  getUsdcBalance,
  getWalletStatus,
  preflightOpenTaker,
} from "../../functions/wallet";
import type { PerpAddress } from "../../types";
import { ValidationError } from "../../utils/errors";

const HOLDER = getAddress("0x1111111111111111111111111111111111111111");
const OTHER = getAddress("0x4444444444444444444444444444444444444444");
const USDC = getAddress("0x2222222222222222222222222222222222222222");
const PERP = getAddress("0x3333333333333333333333333333333333333333") as PerpAddress;

const GWEI = 10n ** 9n;

function makeContext(
  opts: {
    usdcBalance?: bigint;
    allowance?: bigint;
    gasBalance?: bigint;
    maxFeePerGas?: bigint;
    account?: { address: string } | undefined;
  } = {}
): PerpCityContext {
  const balances = new Map<string, bigint>();
  return {
    walletClient: { account: "account" in opts ? opts.account : { address: HOLDER } },
    deployments: () => ({ usdc: USDC }),
    publicClient: {
      readContract: async ({ functionName, args }: { functionName: string; args: unknown[] }) => {
        if (functionName === "balanceOf") {
          balances.set(String(args[0]), opts.usdcBalance ?? 0n);
          return opts.usdcBalance ?? 0n;
        }
        if (functionName === "allowance") {
          return opts.allowance ?? 0n;
        }
        throw new Error(`unexpected readContract: ${functionName}`);
      },
      getBalance: async () => opts.gasBalance ?? 0n,
      estimateFeesPerGas: async () => ({
        maxFeePerGas: opts.maxFeePerGas ?? GWEI / 10n,
        maxPriorityFeePerGas: 0n,
      }),
    },
  } as unknown as PerpCityContext;
}

describe("getUsdcBalance", () => {
  it("reads the wallet account's USDC balance by default", async () => {
    const context = makeContext({ usdcBalance: 123_000_000n });
    expect(await getUsdcBalance(context)).toBe(123_000_000n);
  });

  it("reads an explicit address when given", async () => {
    const context = makeContext({ usdcBalance: 5n });
    expect(await getUsdcBalance(context, OTHER)).toBe(5n);
  });

  it("throws ValidationError when no address is available", async () => {
    const context = makeContext({ account: undefined });
    await expect(getUsdcBalance(context)).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("getGasBalance", () => {
  it("returns the native balance in wei", async () => {
    const context = makeContext({ gasBalance: 42n * GWEI });
    expect(await getGasBalance(context)).toBe(42n * GWEI);
  });
});

describe("getWalletStatus", () => {
  it("returns usdc and gas balances without allowance by default", async () => {
    const context = makeContext({ usdcBalance: 7_000_000n, gasBalance: 3n * GWEI });
    const status = await getWalletStatus(context);
    expect(status.address).toBe(HOLDER);
    expect(status.usdcBalance).toBe(7_000_000n);
    expect(status.gasBalance).toBe(3n * GWEI);
    expect(status.usdcAllowance).toBeUndefined();
  });

  it("includes the allowance for a perp when perpAddress is given", async () => {
    const context = makeContext({ usdcBalance: 1n, gasBalance: 2n, allowance: 9_000_000n });
    const status = await getWalletStatus(context, { perpAddress: PERP });
    expect(status.usdcAllowance).toBe(9_000_000n);
  });
});

describe("preflightOpenTaker", () => {
  const healthy = {
    usdcBalance: 100_000_000n, // 100 USDC
    allowance: 100_000_000n,
    gasBalance: 10n ** 17n, // 0.1 ETH
  };

  it("passes all checks for a funded wallet", async () => {
    const report = await preflightOpenTaker(makeContext(healthy), PERP, { margin: 50 });
    expect(report.ok).toBe(true);
    expect(report.checks.minMargin.ok).toBe(true);
    expect(report.checks.usdcBalance.ok).toBe(true);
    expect(report.checks.usdcAllowance.ok).toBe(true);
    expect(report.checks.gasBalance.ok).toBe(true);
    expect(report.balances.usdcBalance).toBe(100_000_000n);
  });

  it("flags margin below the 5 USDC minimum", async () => {
    const report = await preflightOpenTaker(makeContext(healthy), PERP, { margin: 4 });
    expect(report.ok).toBe(false);
    expect(report.checks.minMargin.ok).toBe(false);
    expect(report.checks.minMargin.code).toBe("MARGIN_BELOW_MINIMUM");
  });

  it("flags an insufficient USDC balance", async () => {
    const report = await preflightOpenTaker(
      makeContext({ ...healthy, usdcBalance: 10_000_000n }),
      PERP,
      { margin: 50 }
    );
    expect(report.ok).toBe(false);
    expect(report.checks.usdcBalance.ok).toBe(false);
    expect(report.checks.usdcBalance.code).toBe("INSUFFICIENT_USDC_BALANCE");
  });

  it("flags an insufficient allowance without failing the report", async () => {
    // The SDK write paths top up the allowance automatically, so a short
    // allowance is informational: the check reports it but ok stays true.
    const report = await preflightOpenTaker(makeContext({ ...healthy, allowance: 0n }), PERP, {
      margin: 50,
    });
    expect(report.checks.usdcAllowance.ok).toBe(false);
    expect(report.checks.usdcAllowance.code).toBe("INSUFFICIENT_USDC_ALLOWANCE");
    expect(report.ok).toBe(true);
  });

  it("flags an empty gas tank", async () => {
    const report = await preflightOpenTaker(makeContext({ ...healthy, gasBalance: 0n }), PERP, {
      margin: 50,
    });
    expect(report.ok).toBe(false);
    expect(report.checks.gasBalance.ok).toBe(false);
    expect(report.checks.gasBalance.code).toBe("INSUFFICIENT_GAS");
  });

  it("respects an explicit minGasWei floor", async () => {
    const report = await preflightOpenTaker(
      makeContext({ ...healthy, gasBalance: 5n * GWEI }),
      PERP,
      { margin: 50 },
      { minGasWei: 6n * GWEI }
    );
    expect(report.checks.gasBalance.ok).toBe(false);
  });

  it("never throws on failed checks", async () => {
    const report = await preflightOpenTaker(
      makeContext({ usdcBalance: 0n, allowance: 0n, gasBalance: 0n }),
      PERP,
      { margin: 0 }
    );
    expect(report.ok).toBe(false);
  });
});
