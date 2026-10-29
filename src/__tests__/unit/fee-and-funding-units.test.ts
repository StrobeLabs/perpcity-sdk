import { toHex } from "viem";
import { describe, expect, it, vi } from "vitest";
import type { PerpCityContext } from "../../context";
import { fundingRateFromRaw, getFundingRate } from "../../functions/perp";
import type { Fees } from "../../types/entity-data";
import { totalTakerFeeRate } from "../../utils/fees";

const PERP = "0x6d4051ffb71f391a5b4d8643a29ec6f66f67df50";
const Q96 = 2n ** 96n;

describe("totalTakerFeeRate", () => {
  const fees: Fees = {
    creatorFee: 0.001,
    insuranceFee: 0.0005,
    lpFee: 0.0096,
    liquidationFee: 0.01,
    protocolFee: 0,
  };

  it("sums creator, insurance, and LP fees", () => {
    expect(totalTakerFeeRate(fees)).toBeCloseTo(0.0111, 10);
  });

  it("includes the protocol fee", () => {
    expect(totalTakerFeeRate({ ...fees, protocolFee: 0.0002 })).toBeCloseTo(0.0113, 10);
  });

  it("excludes the liquidation fee", () => {
    expect(totalTakerFeeRate({ ...fees, liquidationFee: 0.5 })).toBeCloseTo(0.0111, 10);
  });
});

describe("fundingRateFromRaw", () => {
  it("reads WAD fundingPerDay as USD per perp per day and divides by the mark", () => {
    // 0.05 USD per perp per day at a mark of 25 USD = 0.2% per day
    const { fundingPerDayUsd, ratePerDay } = fundingRateFromRaw(5n * 10n ** 16n, 25);
    expect(fundingPerDayUsd).toBeCloseTo(0.05, 12);
    expect(ratePerDay).toBeCloseTo(0.002, 12);
  });

  it("keeps the sign (shorts pay when negative)", () => {
    expect(fundingRateFromRaw(-(10n ** 16n), 10).ratePerDay).toBeCloseTo(-0.001, 12);
  });

  it("returns a zero rate for a zero mark", () => {
    expect(fundingRateFromRaw(10n ** 18n, 0).ratePerDay).toBe(0);
  });
});

describe("getFundingRate", () => {
  function contextWith(build: "58b42b7" | "v0.2.2", emas: readonly [bigint, bigint]) {
    const readContract = vi.fn(async ({ functionName }: { functionName: string }) => {
      if (functionName === "rates") return [5n * 10n ** 16n, 0n, 0n, 0] as const;
      if (functionName === "poolState") return [0, 0n, 20n * Q96, 0n] as const;
      if (functionName === "emas" && build === "58b42b7") return emas;
      throw new Error(`unexpected ${functionName}`);
    });
    const getStorageAt = vi.fn(async () => toHex((emas[1] << 128n) | emas[0], { size: 32 }));
    return {
      publicClient: { readContract, getStorageAt },
      getPerpConfig: async () => ({ build }),
    } as unknown as PerpCityContext;
  }

  it("uses the EMA AMM price from emas() on 58b42b7", async () => {
    const rate = await getFundingRate(contextWith("58b42b7", [25n * Q96, 24n * Q96]), PERP);
    expect(rate.fundingPerDayUsd).toBeCloseTo(0.05, 12);
    expect(rate.ratePerDay).toBeCloseTo(0.002, 12);
    expect(rate.ratePriceBasis).toBe("ema");
    expect(rate.fundingPerDayRaw).toBe(5n * 10n ** 16n);
  });

  it("reads the EMA AMM price from storage on v0.2.2", async () => {
    const rate = await getFundingRate(contextWith("v0.2.2", [25n * Q96, 24n * Q96]), PERP);
    expect(rate.ratePerDay).toBeCloseTo(0.002, 12);
    expect(rate.ratePriceBasis).toBe("ema");
  });

  it("falls back to the spot price while the EMA is zero", async () => {
    const rate = await getFundingRate(contextWith("v0.2.2", [0n, 0n]), PERP);
    expect(rate.ratePerDay).toBeCloseTo(0.0025, 12);
    expect(rate.ratePriceBasis).toBe("spot");
  });
});
