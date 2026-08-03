import { getAddress } from "viem";
import { describe, expect, it } from "vitest";
import type { PerpCityContext } from "../../context";
import { computeTakerHealth, getPositionHealth } from "../../functions/position-health";
import type { PerpAddress } from "../../types";
import { Q96 } from "../../utils/constants";
import { ValidationError } from "../../utils/errors";

const PERP = getAddress("0x3333333333333333333333333333333333333333") as PerpAddress;

const MASK128 = (1n << 128n) - 1n;

function packBalanceDelta(amount0: bigint, amount1: bigint): bigint {
  return ((amount0 & MASK128) << 128n) | (amount1 & MASK128);
}

describe("computeTakerHealth", () => {
  it("computes a profitable long with funding paid", () => {
    // Long 2 perp, entered at $90 (paid 180), mark now $100, funding index
    // moved 5 per perp against longs.
    const health = computeTakerHealth({
      perpDelta: 2_000_000n,
      usdDelta: -180_000_000n,
      margin: 20_000_000n,
      liqMarginRatioE6: 62_500,
      ammPriceX96: 100n * Q96,
      fundingX96: 5n * Q96,
      lastCumlFundingX96: 0n,
    });

    expect(health.kind).toBe("taker");
    expect(health.mark).toBeCloseTo(100, 9);
    expect(health.margin).toBeCloseTo(20, 6);
    expect(health.unrealizedPnl).toBeCloseTo(20, 6);
    expect(health.fundingPayment).toBeCloseTo(-10, 6);
    expect(health.effectiveMargin).toBeCloseTo(30, 6);
    expect(health.notional).toBeCloseTo(200, 6);
    expect(health.marginRatio).toBeCloseTo(0.15, 9);
    expect(health.liqMarginRatio).toBeCloseTo(0.0625, 9);
    expect(health.distanceToLiquidation).toBeCloseTo(0.0875, 9);
    expect(health.isLiquidatable).toBe(false);
  });

  it("flags an underwater short as liquidatable", () => {
    // Short 1 perp at $100 (received 100), mark now $130: 30 underwater on
    // 25 margin -> negative equity.
    const health = computeTakerHealth({
      perpDelta: -1_000_000n,
      usdDelta: 100_000_000n,
      margin: 25_000_000n,
      liqMarginRatioE6: 62_500,
      ammPriceX96: 130n * Q96,
      fundingX96: 0n,
      lastCumlFundingX96: 0n,
    });

    expect(health.unrealizedPnl).toBeCloseTo(-30, 6);
    expect(health.effectiveMargin).toBeCloseTo(-5, 6);
    expect(health.marginRatio).toBeLessThan(0);
    expect(health.isLiquidatable).toBe(true);
  });

  it("does not square the mark price (regression: 48x PnL bug)", () => {
    // A market near $47. Squaring the Q96 price (treating it as a sqrt price)
    // would report a ~2209 mark and a liquidatable position.
    const health = computeTakerHealth({
      perpDelta: 1_000_000n,
      usdDelta: -47_000_000n,
      margin: 10_000_000n,
      liqMarginRatioE6: 62_500,
      ammPriceX96: 47n * Q96,
      fundingX96: 0n,
      lastCumlFundingX96: 0n,
    });

    expect(health.mark).toBeCloseTo(47, 6);
    expect(health.unrealizedPnl).toBeCloseTo(0, 6);
    expect(health.notional).toBeCloseTo(47, 6);
    expect(health.isLiquidatable).toBe(false);
  });

  it("keeps fractional sizes in the funding leg", () => {
    // 0.5 perp with a funding delta of 3 per perp: exactly -1.5 USDC owed.
    // Integer truncation of the size would zero this out.
    const health = computeTakerHealth({
      perpDelta: 500_000n,
      usdDelta: -50_000_000n,
      margin: 10_000_000n,
      liqMarginRatioE6: 62_500,
      ammPriceX96: 100n * Q96,
      fundingX96: 3n * Q96,
      lastCumlFundingX96: 0n,
    });

    expect(health.fundingPayment).toBeCloseTo(-1.5, 6);
  });

  it("funding earned adds to effective margin (short side)", () => {
    // Short 1 perp; funding index rose 2 per perp, shorts earn it.
    const health = computeTakerHealth({
      perpDelta: -1_000_000n,
      usdDelta: 100_000_000n,
      margin: 10_000_000n,
      liqMarginRatioE6: 62_500,
      ammPriceX96: 100n * Q96,
      fundingX96: 2n * Q96,
      lastCumlFundingX96: 0n,
    });

    expect(health.unrealizedPnl).toBeCloseTo(0, 6);
    expect(health.fundingPayment).toBeCloseTo(2, 6);
    expect(health.effectiveMargin).toBeCloseTo(12, 6);
  });
});

describe("getPositionHealth", () => {
  function makeContext(opts: {
    delta: bigint;
    margin: bigint;
    liqMarginRatio?: bigint;
    lastCumlFundingX96?: bigint;
    makerLiquidity?: bigint;
    fundingX96?: bigint;
    ammPriceX96?: bigint;
  }): PerpCityContext {
    return {
      publicClient: {
        readContract: async ({ functionName }: { functionName: string }) => {
          switch (functionName) {
            case "positions":
              return [
                opts.delta,
                opts.margin,
                opts.liqMarginRatio ?? 62_500n,
                125_000n,
                opts.lastCumlFundingX96 ?? 0n,
              ];
            case "makerDetails":
              return [0, 0, opts.makerLiquidity ?? 0n];
            case "cumulatives":
              return [opts.fundingX96 ?? 0n, 0n, 0n, 0n, 0n, 0n];
            case "poolState":
              return [0, 0n, opts.ammPriceX96 ?? 100n * Q96, 0n];
            default:
              throw new Error(`unexpected readContract: ${functionName}`);
          }
        },
      },
    } as unknown as PerpCityContext;
  }

  it("fetches and computes health for a taker position", async () => {
    const context = makeContext({
      delta: packBalanceDelta(2_000_000n, -180_000_000n),
      margin: 20_000_000n,
      fundingX96: 5n * Q96,
      ammPriceX96: 100n * Q96,
    });

    const health = await getPositionHealth(context, PERP, 1n);
    expect(health.effectiveMargin).toBeCloseTo(30, 6);
    expect(health.isLiquidatable).toBe(false);
  });

  it("rejects maker positions with WRONG_POSITION_KIND", async () => {
    const context = makeContext({
      delta: packBalanceDelta(1_000_000n, -100_000_000n),
      margin: 20_000_000n,
      makerLiquidity: 123n,
    });

    const promise = getPositionHealth(context, PERP, 1n);
    await expect(promise).rejects.toBeInstanceOf(ValidationError);
    await expect(promise).rejects.toMatchObject({ code: "WRONG_POSITION_KIND" });
  });

  it("throws for a closed or missing position", async () => {
    const context = makeContext({ delta: 0n, margin: 0n });
    await expect(getPositionHealth(context, PERP, 99n)).rejects.toThrow(/does not exist|closed/);
  });
});
