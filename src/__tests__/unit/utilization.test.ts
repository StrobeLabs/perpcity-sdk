import { describe, expect, it, vi } from "vitest";
import type { PerpCityContext } from "../../context";
import { endsOutsideCorridor, getPriceCorridor } from "../../functions/corridor";
import {
  makerRemovableFraction,
  takerHeadroom,
  type Utilization,
} from "../../functions/utilization";

const U: Utilization = {
  oiLong: 6_000_000n,
  oiShort: 1_000_000n,
  capLong: 10_000_000n,
  capShort: 4_000_000n,
};

describe("takerHeadroom", () => {
  it("is the free capacity on the side", () => {
    expect(takerHeadroom("long", U)).toBe(4_000_000n);
    expect(takerHeadroom("short", U)).toBe(3_000_000n);
  });

  it("adds the trader's own opposite position, which nets off first", () => {
    expect(takerHeadroom("long", U, 1_000_000n)).toBe(5_000_000n);
  });

  it("is zero while the other side is over its cap", () => {
    expect(takerHeadroom("long", { ...U, oiShort: 5_000_000n })).toBe(0n);
    expect(takerHeadroom("long", { ...U, oiShort: 5_000_000n }, 2_000_000n)).toBe(6_000_000n);
  });
});

describe("makerRemovableFraction", () => {
  it("allows 100% with room on both sides", () => {
    expect(
      makerRemovableFraction({
        utilization: U,
        positionCapLong: 1n,
        positionCapShort: 1n,
        build: "58b42b7",
      })
    ).toEqual({ fraction: 1, maxRemovablePct: 100, limitedBy: null });
  });

  it("finds the largest partial remove", () => {
    const r = makerRemovableFraction({
      utilization: U,
      positionCapLong: 8_000_000n,
      positionCapShort: 0n,
      build: "58b42b7",
    });
    expect(r).toEqual({ fraction: 0.5, maxRemovablePct: 50, limitedBy: "long" });
  });

  it("is ~0 for an LP whose liquidity open trades use (0x925e / #92)", () => {
    const r = makerRemovableFraction({
      utilization: { oiLong: 4_976_000n, oiShort: 0n, capLong: 4_978_000n, capShort: 1_000_000n },
      positionCapLong: 4_500_000n,
      positionCapShort: 0n,
      build: "58b42b7",
    });
    expect(r.maxRemovablePct).toBe(0);
    expect(r.limitedBy).toBe("long");
  });

  it("follows each build's rounding of the removed capacity", () => {
    const p = {
      utilization: { oiLong: 0n, oiShort: 8n, capLong: 10n, capShort: 10n },
      positionCapLong: 0n,
      positionCapShort: 3n,
    };
    expect(makerRemovableFraction({ ...p, build: "58b42b7" }).maxRemovablePct).toBe(99);
    expect(makerRemovableFraction({ ...p, build: "v0.2.2" }).maxRemovablePct).toBe(66);
    expect(makerRemovableFraction({ ...p, build: "v0.2.2" }).limitedBy).toBe("short");
  });
});

describe("price corridor", () => {
  it("flags an end price outside the band", () => {
    const corridor = { sqrtMinX96: 100n, sqrtMaxX96: 200n };
    expect(endsOutsideCorridor(99n, corridor)).toBe(true);
    expect(endsOutsideCorridor(100n, corridor)).toBe(false);
    expect(endsOutsideCorridor(200n, corridor)).toBe(false);
    expect(endsOutsideCorridor(201n, corridor)).toBe(true);
  });

  it("asks the price-impact module with the accrued EMAs", async () => {
    const readContract = vi.fn(
      async ({ functionName, args }: { functionName: string; args?: unknown[] }) => {
        if (functionName === "poolState") return [0, 1n, 40n, 0n] as const;
        if (functionName === "rates") return [0n, 0n, 0n, 1000] as const;
        if (functionName === "index") return 30n;
        if (functionName === "emas") return [20n, 10n] as const;
        if (functionName === "sqrtPriceBounds") return [BigInt(args!.length), 7n] as const;
        throw new Error(functionName);
      }
    );
    const ctx = {
      publicClient: { readContract },
      getPerpConfig: async () => ({
        build: "58b42b7",
        beacon: "0xb",
        priceImpact: "0xp",
        emaWindow: 60,
      }),
    } as unknown as PerpCityContext;
    const corridor = await getPriceCorridor(ctx, "0x01", { timestamp: 1000n });
    expect(corridor).toEqual({ sqrtMinX96: 4n, sqrtMaxX96: 7n });
    const call = readContract.mock.calls.find(([c]) => c.functionName === "sqrtPriceBounds")![0];
    expect(call.args).toEqual([40n, 30n, 20n, 10n]);
  });
});
