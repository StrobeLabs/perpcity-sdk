import { describe, expect, it } from "vitest";
import {
  convertFundingPerSecondX96ToPercentPerDay,
  convertFundingPerSecondX96ToPercentPerMinute,
} from "../../utils/funding";

// Q96 = 2^96 = 79228162514264337593543950336n
// For 1 bps/day (0.0001): rate_per_second = 0.0001 / 86400
// X96 value = (0.0001 / 86400) * 2^96 ≈ 91,746,252,267,418,568,738n
const ONE_BPS_PER_DAY_X96 = 91746252267418568738n;

describe("Funding Rate Conversion Functions", () => {
  describe("convertFundingPerSecondX96ToPercentPerDay", () => {
    it("should convert zero to zero", () => {
      expect(convertFundingPerSecondX96ToPercentPerDay(0n)).toBe(0);
    });

    it("should convert positive funding rate", () => {
      const result = convertFundingPerSecondX96ToPercentPerDay(ONE_BPS_PER_DAY_X96);
      expect(result).toBeCloseTo(0.0001, 6);
    });

    it("should handle negative funding rate", () => {
      const result = convertFundingPerSecondX96ToPercentPerDay(-ONE_BPS_PER_DAY_X96);
      expect(result).toBeCloseTo(-0.0001, 6);
    });
  });

  describe("convertFundingPerSecondX96ToPercentPerMinute", () => {
    it("should be 1/1440th of per-day rate", () => {
      const perDay = convertFundingPerSecondX96ToPercentPerDay(ONE_BPS_PER_DAY_X96);
      const perMin = convertFundingPerSecondX96ToPercentPerMinute(ONE_BPS_PER_DAY_X96);
      expect(perDay / perMin).toBeCloseTo(1440, 1);
    });
  });
});
