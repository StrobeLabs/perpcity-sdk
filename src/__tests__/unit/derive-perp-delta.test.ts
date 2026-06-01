import { describe, expect, it } from "vitest";
import { derivePerpDelta } from "../../functions/perp-actions";

// perpSize = (margin * leverage / price), all scaled by 1e6.
// For margin=100, leverage=2, price=50: notional=200, size=200/50=4 -> 4_000_000n raw.

describe("derivePerpDelta", () => {
  it("returns a positive delta for longs", () => {
    expect(derivePerpDelta({ margin: 100, leverage: 2, price: 50, isLong: true })).toBe(4_000_000n);
  });

  it("returns the negated delta for shorts", () => {
    expect(derivePerpDelta({ margin: 100, leverage: 2, price: 50, isLong: false })).toBe(
      -4_000_000n
    );
  });

  it("uses the same magnitude regardless of side", () => {
    const long = derivePerpDelta({ margin: 100, leverage: 2, price: 50, isLong: true });
    const short = derivePerpDelta({ margin: 100, leverage: 2, price: 50, isLong: false });
    expect(short).toBe(-long);
  });

  it("computes size from margin, leverage, and price", () => {
    // 50 * 3 / 10 = 15 -> 15_000_000n raw
    expect(derivePerpDelta({ margin: 50, leverage: 3, price: 10, isLong: true })).toBe(15_000_000n);
  });

  it("rejects non-positive margin", () => {
    expect(() => derivePerpDelta({ margin: 0, leverage: 2, price: 50, isLong: true })).toThrow(
      /Margin/
    );
  });

  it("rejects non-positive leverage", () => {
    expect(() => derivePerpDelta({ margin: 100, leverage: 0, price: 50, isLong: true })).toThrow(
      /Leverage/
    );
  });

  it("rejects non-positive price", () => {
    expect(() => derivePerpDelta({ margin: 100, leverage: 2, price: 0, isLong: true })).toThrow(
      /Price/
    );
  });
});
