import {
  type AbiFunction,
  decodeFunctionData,
  encodeFunctionData,
  erc20Abi,
  getAddress,
  type Hex,
  parseAbi,
  toFunctionSelector,
} from "viem";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PERP_ABI } from "../../abis/perp";
import type { PerpCityContext } from "../../context";
import {
  buildAdjustMakerCall,
  buildAdjustTakerCall,
  buildApproveUsdcCall,
  buildClosePositionCall,
  buildMoveMakerCall,
  buildOpenTakerPositionCall,
  buildOpenTakerPositionCalls,
  DEFAULT_DEADLINE_SECONDS,
  maxTotalFeeFor,
} from "../../functions/calldata";
import type { PerpAddress } from "../../types";
import { scale6Decimals } from "../../utils";

const HOLDER = getAddress("0x1111111111111111111111111111111111111111");
const USDC = getAddress("0x2222222222222222222222222222222222222222");
const PERP = getAddress("0x3333333333333333333333333333333333333333") as PerpAddress;

/**
 * The v1.0.0 param structs, written by hand from
 * perpcity-contracts v1.0.0 src/libraries/Structs.sol. Decoding the SDK's
 * calldata with this ABI (and not the vendored one) proves the new fields are
 * on the wire in the order the contract reads them.
 */
const STRUCTS_SOL_ABI = parseAbi([
  "function openTaker((address holder, uint128 margin, int256 perpDelta, uint256 amt1Limit, uint256 maxTotalFee, uint64 deadline) params)",
  "function adjustTaker((uint256 posId, int128 marginDelta, int256 perpDelta, uint256 amt1Limit, uint256 maxTotalFee, bool reduceOnly, uint64 deadline) params)",
  "function adjustMaker((uint256 posId, int128 marginDelta, int128 liquidityDelta, uint256 amt0Limit, uint256 amt1Limit, uint64 deadline) params)",
  "function moveMaker((uint256 posId, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 removeAmt0Min, uint256 removeAmt1Min, uint256 addAmt0Max, uint256 addAmt1Max, int128 marginDelta, uint64 deadline) params)",
]);

/** `cast sig` of each v1.0.0 signature. */
const SELECTORS = {
  openTaker: "0x1d920967",
  adjustTaker: "0x4c124b86",
  adjustMaker: "0x7bd08a1a",
  moveMaker: "0xe2471c97",
} as const;

/** 32-byte words after the selector: every v1 param struct is static, so it is inlined. */
const words = (data: Hex) =>
  Array.from({ length: (data.length - 10) / 64 }, (_, i) =>
    BigInt(`0x${data.slice(10 + i * 64, 74 + i * 64)}`)
  );

const context = {
  walletClient: { account: { address: HOLDER } },
  deployments: () => ({ usdc: USDC }),
} as unknown as PerpCityContext;

const NOW = 1_800_000_000;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW * 1000);
});
afterEach(() => {
  vi.useRealTimers();
});

describe("v1 trade calldata", () => {
  it("openTaker carries maxTotalFee and deadline", () => {
    const call = buildOpenTakerPositionCall(context, PERP, {
      margin: 100,
      perpDelta: -4_000_000n,
      amt1Limit: 123n,
      maxTotalFee: 777n,
      deadline: 1_900_000_000n,
    });
    expect(call.data.slice(0, 10)).toBe(SELECTORS.openTaker);
    expect(decodeFunctionData({ abi: STRUCTS_SOL_ABI, data: call.data }).args[0]).toEqual({
      holder: HOLDER,
      margin: scale6Decimals(100),
      perpDelta: -4_000_000n,
      amt1Limit: 123n,
      maxTotalFee: 777n,
      deadline: 1_900_000_000n,
    });
    const w = words(call.data);
    expect(w).toHaveLength(6);
    expect(w[4]).toBe(777n);
    expect(w[5]).toBe(1_900_000_000n);
  });

  it("adjustTaker carries maxTotalFee, reduceOnly and deadline", () => {
    const params = {
      posId: 10n,
      marginDelta: -5n,
      perpDelta: -50n,
      amt1Limit: 20n,
      maxTotalFee: 3n,
      reduceOnly: true,
      deadline: 1_900_000_001n,
    };
    const call = buildAdjustTakerCall(PERP, params);
    expect(call.data.slice(0, 10)).toBe(SELECTORS.adjustTaker);
    expect(decodeFunctionData({ abi: STRUCTS_SOL_ABI, data: call.data }).args[0]).toEqual(params);
    const w = words(call.data);
    expect(w).toHaveLength(7);
    expect(w[4]).toBe(3n);
    expect(w[5]).toBe(1n);
    expect(w[6]).toBe(1_900_000_001n);
  });

  it("adjustTaker encodes reduceOnly false as a zero word", () => {
    const call = buildAdjustTakerCall(PERP, {
      posId: 1n,
      marginDelta: 0n,
      perpDelta: 5n,
      amt1Limit: 0n,
      maxTotalFee: 0n,
      reduceOnly: false,
      deadline: 1n,
    });
    expect(words(call.data)[5]).toBe(0n);
  });

  it("defaults the deadline to now + DEFAULT_DEADLINE_SECONDS", () => {
    const call = buildAdjustTakerCall(PERP, {
      posId: 1n,
      marginDelta: 0n,
      perpDelta: 5n,
      amt1Limit: 0n,
      maxTotalFee: 0n,
      reduceOnly: false,
    });
    expect(words(call.data)[6]).toBe(BigInt(NOW) + DEFAULT_DEADLINE_SECONDS);
  });

  it("adjustMaker and moveMaker carry the deadline", () => {
    const adjust = buildAdjustMakerCall(PERP, {
      posId: 7n,
      marginDelta: 0n,
      liquidityDelta: -1000n,
      amt0Limit: 1n,
      amt1Limit: 2n,
      deadline: 42n,
    });
    expect(adjust.data.slice(0, 10)).toBe(SELECTORS.adjustMaker);
    expect(decodeFunctionData({ abi: STRUCTS_SOL_ABI, data: adjust.data }).args[0]).toMatchObject({
      deadline: 42n,
    });

    const moveParams = {
      posId: 7n,
      tickLower: -600,
      tickUpper: 600,
      liquidity: 10n ** 12n,
      removeAmt0Min: 1n,
      removeAmt1Min: 2n,
      addAmt0Max: 3n,
      addAmt1Max: 4n,
      marginDelta: 5n,
      deadline: 43n,
    };
    const move = buildMoveMakerCall(PERP, moveParams);
    expect(move.data.slice(0, 10)).toBe(SELECTORS.moveMaker);
    expect(decodeFunctionData({ abi: STRUCTS_SOL_ABI, data: move.data }).args[0]).toEqual(
      moveParams
    );
  });

  it("the vendored PERP_ABI encodes the same selectors as Structs.sol", () => {
    for (const fn of ["openTaker", "adjustTaker", "adjustMaker", "moveMaker"] as const) {
      const item = PERP_ABI.find((i) => i.type === "function" && i.name === fn);
      expect(item, fn).toBeDefined();
      expect(toFunctionSelector(item as AbiFunction)).toBe(SELECTORS[fn]);
    }
  });
});

describe("buildClosePositionCall", () => {
  const rawContext = (raw: Record<string, unknown>) =>
    ({
      ...context,
      getPositionRawData: async () => raw,
    }) as unknown as PerpCityContext;

  it("closes a taker with the full inventory, reduceOnly and the fee cap", async () => {
    const call = await buildClosePositionCall(
      rawContext({ perpDelta: 4_000_000n, makerDetails: null }),
      PERP,
      9n,
      { amt1Limit: 10n, maxTotalFee: 11n, deadline: 12n }
    );
    expect(decodeFunctionData({ abi: STRUCTS_SOL_ABI, data: call.data }).args[0]).toEqual({
      posId: 9n,
      marginDelta: 0n,
      perpDelta: -4_000_000n,
      amt1Limit: 10n,
      maxTotalFee: 11n,
      reduceOnly: true,
      deadline: 12n,
    });
  });

  it("refuses a taker close without maxTotalFee", async () => {
    await expect(
      buildClosePositionCall(rawContext({ perpDelta: 1n, makerDetails: null }), PERP, 9n, {
        amt1Limit: 0n,
      })
    ).rejects.toThrow(/maxTotalFee/);
  });

  it("closes a maker by removing all liquidity", async () => {
    const call = await buildClosePositionCall(
      rawContext({
        perpDelta: 0n,
        makerDetails: { tickLower: -60, tickUpper: 60, liquidity: 500n },
      }),
      PERP,
      3n,
      { amt0Limit: 1n, amt1Limit: 2n, deadline: 5n }
    );
    expect(decodeFunctionData({ abi: STRUCTS_SOL_ABI, data: call.data }).args[0]).toEqual({
      posId: 3n,
      marginDelta: 0n,
      liquidityDelta: -500n,
      amt0Limit: 1n,
      amt1Limit: 2n,
      deadline: 5n,
    });
  });
});

describe("maxTotalFeeFor", () => {
  it("bounds the fee at maxSwapFee + protocol fee, rounded up, plus slack", () => {
    // $1000 at 1% + 0.1% = $11, plus 100 atoms of rounding slack.
    expect(maxTotalFeeFor(-1_000_000_000n, { maxSwapFeeE6: 10_000n, protocolFeeE6: 1_000n })).toBe(
      11_000_000n + 100n
    );
    expect(maxTotalFeeFor(1n, { maxSwapFeeE6: 1n, protocolFeeE6: 0n }, 0n)).toBe(1n);
  });
});

describe("buildApproveUsdcCall", () => {
  it("targets USDC and encodes approve(spender, amount)", () => {
    const amount = scale6Decimals(100);
    const call = buildApproveUsdcCall(context, amount, PERP);
    expect(getAddress(call.to)).toBe(USDC);
    expect(call.data).toBe(
      encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: [PERP, amount] })
    );
  });

  it("rejects a missing spender", () => {
    expect(() => buildApproveUsdcCall(context, 1n, "" as never)).toThrow(/spender/);
  });
});

describe("buildOpenTakerPositionCall validation", () => {
  const base = { margin: 100, perpDelta: 1n, amt1Limit: 0n, maxTotalFee: 0n };
  it("rejects non-positive margin", () => {
    expect(() => buildOpenTakerPositionCall(context, PERP, { ...base, margin: 0 })).toThrow(
      /Margin/
    );
  });
  it("rejects a zero perpDelta", () => {
    expect(() => buildOpenTakerPositionCall(context, PERP, { ...base, perpDelta: 0n })).toThrow(
      /perpDelta/
    );
  });
  it("uses an explicit holder", () => {
    const other = getAddress("0x4444444444444444444444444444444444444444");
    const call = buildOpenTakerPositionCall(context, PERP, { ...base, holder: other });
    expect(decodeFunctionData({ abi: STRUCTS_SOL_ABI, data: call.data }).args[0]).toMatchObject({
      holder: other,
    });
  });
});

describe("buildOpenTakerPositionCalls (allowance gating)", () => {
  const params = { margin: 100, perpDelta: 4_000_000n, amt1Limit: 0n, maxTotalFee: 1n };
  const ctxWithAllowance = (allowance: bigint) =>
    ({
      ...context,
      publicClient: { readContract: async () => allowance },
    }) as unknown as PerpCityContext;

  it("prepends an approve against the perp when the allowance is short", async () => {
    const calls = await buildOpenTakerPositionCalls(ctxWithAllowance(0n), PERP, params);
    expect(calls).toHaveLength(2);
    const decoded = decodeFunctionData({ abi: erc20Abi, data: calls[0]!.data });
    expect(decoded.args).toEqual([PERP, scale6Decimals(100)]);
    expect(getAddress(calls[1]!.to)).toBe(PERP);
  });

  it("omits the approve when the allowance covers the margin", async () => {
    const calls = await buildOpenTakerPositionCalls(
      ctxWithAllowance(scale6Decimals(1000)),
      PERP,
      params
    );
    expect(calls).toHaveLength(1);
  });
});
