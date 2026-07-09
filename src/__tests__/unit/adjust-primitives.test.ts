import { decodeFunctionData, erc20Abi, getAddress } from "viem";
import { describe, expect, it } from "vitest";
import { PERP_ABI } from "../../abis/perp";
import type { PerpCityContext } from "../../context";
import { buildAdjustMakerCalls, buildAdjustTakerCalls } from "../../functions/calldata";
import { estimateTakerAdjust } from "../../functions/perp-actions";
import type { PerpAddress } from "../../types";
import { Q96 } from "../../utils/constants";

const HOLDER = getAddress("0x1111111111111111111111111111111111111111");
const USDC = getAddress("0x2222222222222222222222222222222222222222");
const PERP = getAddress("0x3333333333333333333333333333333333333333") as PerpAddress;

// Pool at mark $100 (sqrt price 10) with deep liquidity so fills land near mark.
const perpData = {
  sqrtPriceX96: 10n * Q96,
  liquidity: 10n ** 18n,
  mark: 100,
  fees: { creatorFee: 0.001, insuranceFee: 0.0005, lpFee: 0.0015, liquidationFee: 0.01 },
};

function makeContext(opts: { allowance?: bigint } = {}): PerpCityContext {
  return {
    walletClient: { account: { address: HOLDER } },
    deployments: () => ({ usdc: USDC }),
    getPerpData: async () => perpData,
    publicClient: {
      readContract: async () => opts.allowance ?? 0n,
    },
  } as unknown as PerpCityContext;
}

describe("estimateTakerAdjust", () => {
  it("quotes a positive (buy) delta with a negative usd leg at ~mark", async () => {
    const quote = await estimateTakerAdjust(makeContext(), PERP, {
      perpDelta: 1_000_000n, // +1 perp token
    });
    expect(quote.usdDelta).toBeLessThan(0n);
    expect(quote.fillPrice).toBeGreaterThan(99.9);
    expect(quote.fillPrice).toBeLessThan(100.1);
    expect(quote.exceedsLiquidity).toBe(false);
    // Total taker fee = 0.001 + 0.0005 + 0.0015 = 0.003 (30 bps). A buy pays
    // more, so the effective fill is higher and the effective USD out is larger.
    expect(quote.feeRate).toBeCloseTo(0.003, 12);
    expect(quote.effectiveFillPrice).toBeCloseTo(quote.fillPrice * 1.003, 9);
    expect(quote.effectiveUsdDelta).toBeLessThan(quote.usdDelta); // more negative
  });

  it("quotes a negative (sell) delta with a positive usd leg at ~mark", async () => {
    const quote = await estimateTakerAdjust(makeContext(), PERP, {
      perpDelta: -1_000_000n, // -1 perp token (reduce a long / open a short)
    });
    expect(quote.usdDelta).toBeGreaterThan(0n);
    expect(quote.fillPrice).toBeGreaterThan(99.9);
    expect(quote.fillPrice).toBeLessThan(100.1);
    expect(quote.exceedsLiquidity).toBe(false);
    // A sell receives less, so the effective fill and effective USD in are lower.
    expect(quote.feeRate).toBeCloseTo(0.003, 12);
    expect(quote.effectiveFillPrice).toBeCloseTo(quote.fillPrice * 0.997, 9);
    expect(quote.effectiveUsdDelta).toBeLessThan(quote.usdDelta);
  });

  it("rejects a zero delta", async () => {
    await expect(estimateTakerAdjust(makeContext(), PERP, { perpDelta: 0n })).rejects.toThrow(
      /non-zero/
    );
  });
});

describe("buildAdjustTakerCalls", () => {
  const params = { posId: 7n, marginDelta: 5_000_000n, perpDelta: 1_000_000n, amt1Limit: 123n };

  it("prepends a USDC approve when margin is added and allowance is short", async () => {
    const calls = await buildAdjustTakerCalls(makeContext({ allowance: 0n }), PERP, params);
    expect(calls).toHaveLength(2);
    expect(getAddress(calls[0].to)).toBe(USDC);
    const approve = decodeFunctionData({ abi: erc20Abi, data: calls[0].data });
    expect(approve.functionName).toBe("approve");
    expect(approve.args).toEqual([PERP, params.marginDelta]);
    const adjust = decodeFunctionData({ abi: PERP_ABI, data: calls[1].data });
    expect(adjust.functionName).toBe("adjustTaker");
  });

  it("skips the approve when the allowance already covers the margin", async () => {
    const calls = await buildAdjustTakerCalls(
      makeContext({ allowance: params.marginDelta }),
      PERP,
      params
    );
    expect(calls).toHaveLength(1);
    expect(getAddress(calls[0].to)).toBe(PERP);
  });

  it("never approves for a reduce (no margin in)", async () => {
    // No publicClient.readContract stubbing needed: marginDelta <= 0 must not
    // even check the allowance.
    const context = {
      walletClient: { account: { address: HOLDER } },
      deployments: () => ({ usdc: USDC }),
    } as unknown as PerpCityContext;
    const calls = await buildAdjustTakerCalls(context, PERP, {
      posId: 7n,
      marginDelta: 0n,
      perpDelta: -1_000_000n,
      amt1Limit: 90n,
    });
    expect(calls).toHaveLength(1);
    const adjust = decodeFunctionData({ abi: PERP_ABI, data: calls[0].data });
    expect(adjust.functionName).toBe("adjustTaker");
  });
});

describe("buildAdjustMakerCalls", () => {
  it("approval covers margin plus the USD leg when adding liquidity", async () => {
    const calls = await buildAdjustMakerCalls(makeContext({ allowance: 0n }), PERP, {
      posId: 9n,
      marginDelta: 5_000_000n,
      liquidityDelta: 1_000n,
      amt0Limit: 0n,
      amt1Limit: 2_000_000n,
    });
    expect(calls).toHaveLength(2);
    const approve = decodeFunctionData({ abi: erc20Abi, data: calls[0].data });
    expect(approve.args).toEqual([PERP, 7_000_000n]); // margin + amt1Limit
    const adjust = decodeFunctionData({ abi: PERP_ABI, data: calls[1].data });
    expect(adjust.functionName).toBe("adjustMaker");
  });

  it("no approve when removing liquidity and withdrawing margin", async () => {
    const context = {
      walletClient: { account: { address: HOLDER } },
      deployments: () => ({ usdc: USDC }),
    } as unknown as PerpCityContext;
    const calls = await buildAdjustMakerCalls(context, PERP, {
      posId: 9n,
      marginDelta: -5_000_000n,
      liquidityDelta: -1_000n,
      amt0Limit: 0n,
      amt1Limit: 0n,
    });
    expect(calls).toHaveLength(1);
    const adjust = decodeFunctionData({ abi: PERP_ABI, data: calls[0].data });
    expect(adjust.functionName).toBe("adjustMaker");
  });
});
