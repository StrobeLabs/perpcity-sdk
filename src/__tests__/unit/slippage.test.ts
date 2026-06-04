import { describe, expect, it } from "vitest";
import { calculateTakerSlippageLimit } from "../../utils/slippage";

// amt1Limit is the USD (currency1) leg of the swap. usdDelta is signed
// (negative for longs) and already in contract units (1e6). With usdDelta of
// 200_000_000n ($200 notional) and 1% slippage:
//   long  -> max USD to pay  = 200 * 1.01 = 202_000_000n
//   short -> min USD to recv = 200 * 0.99 = 198_000_000n

describe("calculateTakerSlippageLimit", () => {
  const longQuote = { usdDelta: -200_000_000n };
  const shortQuote = { usdDelta: 200_000_000n };

  it("raises the notional for a long (ceiling on USD paid)", () => {
    expect(calculateTakerSlippageLimit(longQuote, true, 1)).toBe(202_000_000n);
  });

  it("lowers the notional for a short (floor on USD received)", () => {
    expect(calculateTakerSlippageLimit(shortQuote, false, 1)).toBe(198_000_000n);
  });

  it("uses the magnitude of usdDelta regardless of its sign", () => {
    expect(calculateTakerSlippageLimit({ usdDelta: -200_000_000n }, true, 1)).toBe(
      calculateTakerSlippageLimit({ usdDelta: 200_000_000n }, true, 1)
    );
  });

  it("returns the exact notional when slippage is zero", () => {
    expect(calculateTakerSlippageLimit(longQuote, true, 0)).toBe(200_000_000n);
    expect(calculateTakerSlippageLimit(shortQuote, false, 0)).toBe(200_000_000n);
  });

  it("supports fractional-percent tolerances via basis points", () => {
    // 0.5% -> 50 bps. long: 200 * 1.005 = 201_000_000n
    expect(calculateTakerSlippageLimit(longQuote, true, 0.5)).toBe(201_000_000n);
    expect(calculateTakerSlippageLimit(shortQuote, false, 0.5)).toBe(199_000_000n);
  });

  it("handles a zero usdDelta", () => {
    expect(calculateTakerSlippageLimit({ usdDelta: 0n }, true, 1)).toBe(0n);
    expect(calculateTakerSlippageLimit({ usdDelta: 0n }, false, 1)).toBe(0n);
  });

  it("scales to large notionals without precision loss", () => {
    // $1,000,000 notional, 2.5% -> 250 bps
    const quote = { usdDelta: -1_000_000_000_000n };
    expect(calculateTakerSlippageLimit(quote, true, 2.5)).toBe(1_025_000_000_000n);
  });

  it("rejects a negative slippage", () => {
    expect(() => calculateTakerSlippageLimit(longQuote, true, -1)).toThrow(/non-negative/);
  });

  it("rejects a non-finite slippage", () => {
    expect(() => calculateTakerSlippageLimit(longQuote, true, Number.NaN)).toThrow(/non-negative/);
  });

  it("rejects slippage >= 100 for a short (would floor at or below zero)", () => {
    expect(() => calculateTakerSlippageLimit(shortQuote, false, 100)).toThrow(/below 100/);
  });

  it("allows slippage >= 100 for a long", () => {
    // long ceiling can exceed 100%: 200 * 2 = 400_000_000n at 100%
    expect(calculateTakerSlippageLimit(longQuote, true, 100)).toBe(400_000_000n);
  });
});
