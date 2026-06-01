import { describe, expect, it } from "vitest";
import { unpackBalanceDelta } from "../../context";

// int128 bounds
const INT128_MAX = (1n << 127n) - 1n; // 2^127 - 1
const INT128_MIN = -(1n << 127n); // -2^127

// Pack two signed 128-bit values into a single 256-bit BalanceDelta the way the
// contract does: amount0 in the high 128 bits, amount1 in the low 128 bits.
const U128_MASK = (1n << 128n) - 1n;
const toU128 = (v: bigint): bigint => v & U128_MASK;
const pack = (amount0: bigint, amount1: bigint): bigint =>
  (toU128(amount0) << 128n) | toU128(amount1);

describe("unpackBalanceDelta", () => {
  it("decodes zero", () => {
    expect(unpackBalanceDelta(0n)).toEqual({ amount0: 0n, amount1: 0n });
  });

  it("decodes -1 in the low (amount1) word", () => {
    expect(unpackBalanceDelta(pack(0n, -1n))).toEqual({ amount0: 0n, amount1: -1n });
  });

  it("decodes -1 in the high (amount0) word", () => {
    expect(unpackBalanceDelta(pack(-1n, 0n))).toEqual({ amount0: -1n, amount1: 0n });
  });

  it("decodes the largest positive int128 in both words", () => {
    expect(unpackBalanceDelta(pack(INT128_MAX, INT128_MAX))).toEqual({
      amount0: INT128_MAX,
      amount1: INT128_MAX,
    });
  });

  it("decodes the smallest negative int128 in both words", () => {
    expect(unpackBalanceDelta(pack(INT128_MIN, INT128_MIN))).toEqual({
      amount0: INT128_MIN,
      amount1: INT128_MIN,
    });
  });

  it("decodes mixed extremes (amount0 max, amount1 min)", () => {
    expect(unpackBalanceDelta(pack(INT128_MAX, INT128_MIN))).toEqual({
      amount0: INT128_MAX,
      amount1: INT128_MIN,
    });
  });

  it("round-trips arbitrary mixed-sign values", () => {
    const cases: [bigint, bigint][] = [
      [-123n, 456n],
      [456n, -123n],
      [1n, -1n],
      [INT128_MIN, INT128_MAX],
    ];
    for (const [a0, a1] of cases) {
      expect(unpackBalanceDelta(pack(a0, a1))).toEqual({ amount0: a0, amount1: a1 });
    }
  });
});
