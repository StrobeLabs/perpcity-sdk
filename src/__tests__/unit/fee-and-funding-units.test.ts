import { describe, expect, it, vi } from "vitest";
import type { PerpCityContext } from "../../context";
import { fundingRateFromRaw, getFundingRate } from "../../functions/perp";
import { maxTakerFeeRate } from "../../functions/perp-actions";

const PERP = "0x6d4051ffb71f391a5b4d8643a29ec6f66f67df50";
const Q96 = 2n ** 96n;

describe("maxTakerFeeRate", () => {
  it("sums the module's max swap fee and the protocol fee, not the liquidation fee", () => {
    expect(
      maxTakerFeeRate({ fees: { maxSwapFee: 0.0111, protocolFee: 0.0002, liquidationFee: 0.5 } })
    ).toBeCloseTo(0.0113, 10);
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
  it("divides the cached fundingPerDay by the mark cached at the same touch", async () => {
    const readContract = vi.fn(async ({ functionName }: { functionName: string }) => {
      if (functionName === "rates")
        return {
          fundingPerDay: 5n * 10n ** 16n,
          longUtilFeePerDay: 0n,
          shortUtilFeePerDay: 0n,
          lastTouch: 1_700_000_000,
          lastMark: 25n * Q96,
        };
      throw new Error(`unexpected ${functionName}`);
    });
    const context = { publicClient: { readContract } } as unknown as PerpCityContext;
    const rate = await getFundingRate(context, PERP);
    expect(rate.fundingPerDayUsd).toBeCloseTo(0.05, 12);
    expect(rate.ratePerDay).toBeCloseTo(0.002, 12);
    expect(rate.fundingPerDayRaw).toBe(5n * 10n ** 16n);
    expect(rate.lastTouch).toBe(1_700_000_000);
  });
});
