import { describe, expect, it } from "vitest";
import { feeRatesE6, liquidationFeeAmount, swapFees } from "../../math/fees";
import { sMulDiv } from "../../math/fixedPoint";
import { fundingPaymentUsd, fundingRatePerDay, takerUtilOwed } from "../../math/funding";

const Q96 = 1n << 96n;
const RATES = { lpFee: 10_000n, creatorFee: 100n, insuranceFee: 1_000n, protocolFee: 0n };

describe("swapFees", () => {
  it("rounds each leg up separately, protocol fee included", () => {
    const fees = swapFees(1_000_001n, { ...RATES, protocolFee: 500n });
    expect(fees).toEqual({
      lp: 10_001n,
      protocol: 501n,
      creator: 101n,
      insurance: 1_001n,
      total: 11_604n,
    });
  });

  it("uses the absolute volume", () => {
    expect(swapFees(-100_000_000n, RATES).total).toBe(1_110_000n);
  });

  it("converts fractional Fees to 1e6 rates", () => {
    expect(
      feeRatesE6({
        lpFee: 0.01,
        creatorFee: 0.0001,
        insuranceFee: 0.001,
        liquidationFee: 0.01,
        protocolFee: 0,
      })
    ).toEqual(RATES);
  });

  it("floors the liquidation fee", () => {
    expect(liquidationFeeAmount(1_000_099n, 10_000n)).toBe(10_000n);
  });
});

describe("funding", () => {
  it("states fundingPerDay as a fraction of the EMA mark", () => {
    expect(fundingRatePerDay(5n * 10n ** 16n, 25n * Q96)).toBeCloseTo(0.002, 12);
    expect(fundingRatePerDay(10n ** 18n, 0n)).toBe(0);
  });

  it("rounds a negative payment up on 58b42b7 only", () => {
    expect(sMulDiv(-7n, 3n, 2n, true, "58b42b7")).toBe(-9n);
    expect(sMulDiv(-7n, 3n, 2n, true, "v0.2.2")).toBe(-10n);
    expect(sMulDiv(7n, 3n, 2n, true, "v0.2.2")).toBe(11n);
    expect(fundingPaymentUsd(-3n, Q96 + 1n, 0n, "58b42b7")).toBe(-2n);
    expect(fundingPaymentUsd(-3n, Q96 + 1n, 0n, "v0.2.2")).toBe(-3n);
  });

  it("charges util on the position's side, rounded up", () => {
    const cumls = {
      longUtilPaymentsX96: Q96 + 1n,
      shortUtilPaymentsX96: 5n * Q96,
      lastLongUtilPaymentsX96: 0n,
      lastShortUtilPaymentsX96: 3n * Q96,
    };
    expect(takerUtilOwed({ perpDelta: 10n, ...cumls })).toBe(11n);
    expect(takerUtilOwed({ perpDelta: -10n, ...cumls })).toBe(20n);
    expect(takerUtilOwed({ perpDelta: 0n, ...cumls })).toBe(0n);
  });
});
