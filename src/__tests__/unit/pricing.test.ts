import {
  ContractFunctionExecutionError,
  ContractFunctionRevertedError,
  HttpRequestError,
  toHex,
} from "viem";
import { describe, expect, it, vi } from "vitest";
import { PERP_ABI } from "../../abis/perp";
import type { PerpCityContext } from "../../context";
import { expWad } from "../../math/fixedPoint";
import {
  advanceEmas,
  ammPriceX96FromSqrt,
  fairPriceX96,
  getFairPrice,
  unpackEmasWord,
} from "../../math/pricing";
import { buildFromProbe, detectPerpBuild, UnsupportedBuildError } from "../../utils/build";
import { isMissingViewError } from "../../utils/errors";

const Q96 = 1n << 96n;

// HORMUZ-TRAFFIC's live accrue at Arbitrum One block 510213600 (the vector
// perpcity-rust-sdk `math/pricing.rs` pins): stored EMAs at the previous
// block, 300 s since the last touch, 1 h EMA window.
const HORMUZ = {
  storedAmm: 3320491901781519017281026778664n,
  storedIndex: 3084589206424849219740478559607n,
  amm: 3333452930552967749837079299470n,
  index: 3248354663084837841335301963776n,
  lastTouch: 1790734324n,
  timestamp: 1790734624n,
  window: 3600n,
  emaAmm: 3321528208423946384037633669774n,
  emaIndex: 3097683169375594803637957648468n,
  fair: 3402826316343078585786028642276n,
};

describe("expWad", () => {
  it("matches Solady at known points", () => {
    expect(expWad(0n)).toBe(10n ** 18n);
    expect(expWad(10n ** 18n)).toBe(2718281828459045235n);
    expect(expWad(-(10n ** 18n))).toBe(367879441171442321n);
    expect(expWad(-42n * 10n ** 18n)).toBe(0n);
  });
});

describe("advanceEmas", () => {
  it("reproduces a live accrue to the digit", () => {
    expect(
      advanceEmas({
        emaAmmX96: HORMUZ.storedAmm,
        emaIndexX96: HORMUZ.storedIndex,
        ammX96: HORMUZ.amm,
        indexX96: HORMUZ.index,
        dtSeconds: HORMUZ.timestamp - HORMUZ.lastTouch,
        emaWindow: HORMUZ.window,
      })
    ).toEqual({ emaAmmX96: HORMUZ.emaAmm, emaIndexX96: HORMUZ.emaIndex });
  });

  it("keeps the stored EMAs when no time passed", () => {
    const stored = { emaAmmX96: 100n, emaIndexX96: 200n };
    expect(
      advanceEmas({ ...stored, ammX96: 300n, indexX96: 400n, dtSeconds: 0n, emaWindow: 3600n })
    ).toEqual(stored);
  });
});

describe("fairPriceX96", () => {
  it("matches the deployed pricing module", () => {
    expect(
      fairPriceX96({
        ammX96: HORMUZ.amm,
        indexX96: HORMUZ.index,
        emaAmmX96: HORMUZ.emaAmm,
        emaIndexX96: HORMUZ.emaIndex,
      })
    ).toBe(HORMUZ.fair);
    expect(
      fairPriceX96({
        ammX96: 0x2e8d7e0b44090ee63765fb855fn,
        indexX96: 0x280000000000000000000000000n,
        emaAmmX96: 0x2e4e1d5d09c24b2a50779abaf3n,
        emaIndexX96: 0x2dc0f47dc4c7764d34d2f6a88fn,
      })
    ).toBe(0x1578d53754481f1e1a9854fcbe1n);
  });

  it("clamps the index leg at zero and floors odd sums", () => {
    expect(
      fairPriceX96({ ammX96: 1001n, indexX96: 1n, emaAmmX96: 1n, emaIndexX96: 1_000_000n })
    ).toBe(500n);
    expect(fairPriceX96({ ammX96: 7n, indexX96: 3n, emaAmmX96: 4n, emaIndexX96: 2n })).toBe(6n);
  });
});

describe("storage helpers", () => {
  it("unpacks the emas word with ammPrice in the low half", () => {
    expect(unpackEmasWord((7n << 128n) | 5n)).toEqual({ emaAmmX96: 5n, emaIndexX96: 7n });
  });

  it("squares the sqrt price like poolState", () => {
    expect(ammPriceX96FromSqrt(Q96 * 2n)).toBe(Q96 * 4n);
  });
});

describe("getFairPrice", () => {
  function context(build: "58b42b7" | "v0.2.2") {
    const readContract = vi.fn(async ({ functionName }: { functionName: string }) => {
      if (functionName === "poolState") return [0, 123n, HORMUZ.amm, 0n] as const;
      if (functionName === "rates") return [0n, 0n, 0n, Number(HORMUZ.lastTouch)] as const;
      if (functionName === "index") return HORMUZ.index;
      if (functionName === "emas" && build === "58b42b7") {
        return [HORMUZ.storedAmm, HORMUZ.storedIndex] as const;
      }
      throw new Error(`unexpected ${functionName}`);
    });
    const getStorageAt = vi.fn(async () =>
      toHex((HORMUZ.storedIndex << 128n) | HORMUZ.storedAmm, { size: 32 })
    );
    return {
      ctx: {
        publicClient: { readContract, getStorageAt },
        getPerpConfig: async () => ({ build, beacon: "0xbeac", emaWindow: Number(HORMUZ.window) }),
      } as unknown as PerpCityContext,
      getStorageAt,
    };
  }

  it.each(["58b42b7", "v0.2.2"] as const)("prices the next accrue's mark on %s", async (build) => {
    const { ctx, getStorageAt } = context(build);
    const fair = await getFairPrice(ctx, "0x01", { timestamp: HORMUZ.timestamp });
    expect(fair.fairX96).toBe(HORMUZ.fair);
    expect(fair.emaAmmX96).toBe(HORMUZ.emaAmm);
    expect(fair.spotX96).toBe(HORMUZ.amm);
    expect(fair.build).toBe(build);
    expect(getStorageAt).toHaveBeenCalledTimes(build === "v0.2.2" ? 1 : 0);
  });
});

describe("build detection", () => {
  it("maps known pricing modules first", () => {
    expect(buildFromProbe("0xF4689dA0CAC3F23A04145236dbFe81C3c58CFE22", false)).toBe("58b42b7");
    expect(buildFromProbe("0xb0061a34425438073ae78c2fc7c94259e5fe6cbf", true)).toBe("v0.2.2");
  });

  it("falls back to the emas() probe for an unknown module", () => {
    const unknown = "0x0000000000000000000000000000000000000001";
    expect(buildFromProbe(unknown, true)).toBe("58b42b7");
    expect(buildFromProbe(unknown, false)).toBe("v0.2.2");
  });

  it("treats only a reverted emas() as the missing view, not an RPC failure", () => {
    const reverted = new ContractFunctionExecutionError(
      new ContractFunctionRevertedError({ abi: PERP_ABI, functionName: "emas" }),
      { abi: PERP_ABI, functionName: "emas" }
    );
    expect(isMissingViewError(reverted)).toBe(true);
    expect(
      isMissingViewError(new HttpRequestError({ url: "https://rpc.example", status: 429 }))
    ).toBe(false);
    expect(isMissingViewError(new Error("socket hang up"))).toBe(false);
  });

  it("throws UnsupportedBuildError when the perp config cannot be read", async () => {
    const ctx = {
      getPerpConfig: async () => {
        throw new Error("not a perp");
      },
    } as unknown as PerpCityContext;
    await expect(detectPerpBuild(ctx, "0x01")).rejects.toBeInstanceOf(UnsupportedBuildError);
  });
});
