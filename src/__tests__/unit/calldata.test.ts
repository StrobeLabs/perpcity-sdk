import { decodeFunctionData, encodeFunctionData, erc20Abi, getAddress } from "viem";
import { describe, expect, it } from "vitest";
import { PERP_ABI } from "../../abis/perp";
import type { PerpCityContext } from "../../context";
import {
  buildAdjustMakerCall,
  buildAdjustTakerCall,
  buildApproveUsdcCall,
  buildOpenTakerPositionCall,
  buildOpenTakerPositionCalls,
} from "../../functions/calldata";
import type { PerpAddress } from "../../types";
import { scale6Decimals } from "../../utils";

const HOLDER = getAddress("0x1111111111111111111111111111111111111111");
const USDC = getAddress("0x2222222222222222222222222222222222222222");
const PERP = getAddress("0x3333333333333333333333333333333333333333") as PerpAddress;

// Minimal context: the sync builders only read the account address and the USDC
// deployment, so a network-free stub is enough.
const context = {
  walletClient: { account: { address: HOLDER } },
  deployments: () => ({ usdc: USDC }),
} as unknown as PerpCityContext;

describe("buildApproveUsdcCall", () => {
  it("targets USDC and encodes approve(spender, amount)", () => {
    const amount = scale6Decimals(100);
    const call = buildApproveUsdcCall(context, amount, PERP);

    expect(getAddress(call.to)).toBe(USDC);
    expect(call.value).toBe(0n);
    expect(call.data).toBe(
      encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: [PERP, amount] })
    );

    const decoded = decodeFunctionData({ abi: erc20Abi, data: call.data });
    expect(decoded.functionName).toBe("approve");
    expect(decoded.args).toEqual([PERP, amount]);
  });

  it("rejects a missing spender", () => {
    expect(() => buildApproveUsdcCall(context, 1n, "" as never)).toThrow(/spender/);
  });
});

describe("buildOpenTakerPositionCall", () => {
  it("encodes openTaker with the scaled margin and holder from context", () => {
    const call = buildOpenTakerPositionCall(context, PERP, {
      margin: 100,
      perpDelta: 4_000_000n,
      amt1Limit: 123n,
    });

    expect(getAddress(call.to)).toBe(PERP);
    expect(call.value).toBe(0n);

    const decoded = decodeFunctionData({ abi: PERP_ABI, data: call.data });
    expect(decoded.functionName).toBe("openTaker");
    const params = (decoded.args as readonly unknown[])[0] as {
      holder: string;
      margin: bigint;
      perpDelta: bigint;
      amt1Limit: bigint;
    };
    expect(getAddress(params.holder)).toBe(HOLDER);
    expect(params.margin).toBe(scale6Decimals(100));
    expect(params.perpDelta).toBe(4_000_000n);
    expect(params.amt1Limit).toBe(123n);
  });

  it("rejects non-positive margin", () => {
    expect(() =>
      buildOpenTakerPositionCall(context, PERP, { margin: 0, perpDelta: 1n, amt1Limit: 0n })
    ).toThrow(/Margin/);
  });

  it("rejects a zero perpDelta", () => {
    expect(() =>
      buildOpenTakerPositionCall(context, PERP, { margin: 100, perpDelta: 0n, amt1Limit: 0n })
    ).toThrow(/perpDelta/);
  });
});

describe("buildOpenTakerPositionCalls (allowance gating)", () => {
  let lastReadContract: Record<string, unknown> | undefined;

  function ctxWithAllowance(allowance: bigint): PerpCityContext {
    lastReadContract = undefined;
    return {
      walletClient: { account: { address: HOLDER } },
      deployments: () => ({ usdc: USDC }),
      publicClient: {
        readContract: async (args: Record<string, unknown>) => {
          lastReadContract = args;
          return allowance;
        },
      },
    } as unknown as PerpCityContext;
  }

  const params = { margin: 100, perpDelta: 4_000_000n, amt1Limit: 0n };

  it("prepends an approve against the perp spender when allowance is short", async () => {
    const calls = await buildOpenTakerPositionCalls(ctxWithAllowance(0n), PERP, params);

    // The allowance is read against the USDC token for (owner=HOLDER, spender=PERP);
    // guards maybeApprovalCall from regressing the owner/spender/token wiring.
    expect(getAddress(lastReadContract?.address as string)).toBe(USDC);
    expect(lastReadContract?.functionName).toBe("allowance");
    const readArgs = lastReadContract?.args as readonly string[];
    expect(getAddress(readArgs[0])).toBe(HOLDER);
    expect(getAddress(readArgs[1])).toBe(PERP);

    expect(calls).toHaveLength(2);
    const [approve, open] = calls;
    expect(getAddress(approve.to)).toBe(USDC);
    const decoded = decodeFunctionData({ abi: erc20Abi, data: approve.data });
    expect(decoded.functionName).toBe("approve");
    // Allowance is read and approved against the Perp contract, never USDC itself.
    expect(getAddress((decoded.args as readonly unknown[])[0] as string)).toBe(PERP);
    expect((decoded.args as readonly unknown[])[1]).toBe(scale6Decimals(100));
    expect(getAddress(open.to)).toBe(PERP);
  });

  it("omits the approve when the existing allowance already covers the margin", async () => {
    const calls = await buildOpenTakerPositionCalls(
      ctxWithAllowance(scale6Decimals(1000)),
      PERP,
      params
    );

    expect(calls).toHaveLength(1);
    expect(getAddress(calls[0].to)).toBe(PERP);
  });
});

describe("close-position adjust builders", () => {
  it("buildAdjustTakerCall encodes a taker unwind", () => {
    const params = { posId: 7n, marginDelta: 0n, perpDelta: -4_000_000n, amt1Limit: 9n };
    const call = buildAdjustTakerCall(PERP, params);

    expect(getAddress(call.to)).toBe(PERP);
    const decoded = decodeFunctionData({ abi: PERP_ABI, data: call.data });
    expect(decoded.functionName).toBe("adjustTaker");
    expect((decoded.args as readonly unknown[])[0]).toMatchObject(params);
  });

  it("buildAdjustMakerCall encodes a maker unwind", () => {
    const params = {
      posId: 7n,
      marginDelta: 0n,
      liquidityDelta: -1000n,
      amt0Limit: 0n,
      amt1Limit: 0n,
    };
    const call = buildAdjustMakerCall(PERP, params);

    const decoded = decodeFunctionData({ abi: PERP_ABI, data: call.data });
    expect(decoded.functionName).toBe("adjustMaker");
    expect((decoded.args as readonly unknown[])[0]).toMatchObject(params);
  });
});
