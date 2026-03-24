import { describe, expect, it } from "vitest";
import { applySlippage } from "../../functions/perp-manager";

describe("Slippage Functions", () => {
  describe("applySlippage", () => {
    it("should return 0n when delta >= 0 (contract pays user)", () => {
      expect(applySlippage(100n, 0.01)).toBe(0n);
      expect(applySlippage(0n, 0.01)).toBe(0n);
    });

    it("should add tolerance to negative delta (user pays contract)", () => {
      // -1000 with 1% tolerance -> 1000 + 10 = 1010
      expect(applySlippage(-1000n, 0.01)).toBe(1010n);
    });

    it("should handle fractional bps with ceiling", () => {
      // 0.15% = 15 bps, ceil(0.0015 * 10000) = 15 -> 15 bps
      expect(applySlippage(-10000n, 0.0015)).toBe(10015n);
    });

    it("should handle zero tolerance", () => {
      expect(applySlippage(-1000n, 0)).toBe(1000n);
    });
  });
});
