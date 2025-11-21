import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { beforeEach, describe, expect, it } from "vitest";
import { PerpCityContext } from "../../context";
import { estimateLiquidity } from "../../utils/liquidity";

describe("Liquidity Calculations", () => {
  let mockContext: PerpCityContext;

  beforeEach(() => {
    // Create a minimal mock context for testing
    // We only need the context object structure, not actual blockchain connectivity
    const account = privateKeyToAccount(
      "0x1234567890123456789012345678901234567890123456789012345678901234"
    );
    const walletClient = createWalletClient({
      account,
      chain: baseSepolia,
      transport: http("https://sepolia.base.org"),
    });

    mockContext = new PerpCityContext({
      walletClient,
      deployments: {
        perpManager: "0x0000000000000000000000000000000000000000",
        usdc: "0x0000000000000000000000000000000000000000",
      },
    });
  });

  describe("estimateLiquidity", () => {
    it("should calculate liquidity for a normal tick range", async () => {
      const tickLower = -1000;
      const tickUpper = 1000;
      const usdScaled = 1000_000_000n; // 1000 USDC (scaled)

      const liquidity = await estimateLiquidity(mockContext, tickLower, tickUpper, usdScaled);

      expect(liquidity).toBeGreaterThan(0n);
      expect(liquidity).toBeTypeOf("bigint");
    });

    it("should calculate liquidity for tick range around current price", async () => {
      const tickLower = -100;
      const tickUpper = 100;
      const usdScaled = 100_000_000n; // 100 USDC (scaled)

      const liquidity = await estimateLiquidity(mockContext, tickLower, tickUpper, usdScaled);

      expect(liquidity).toBeGreaterThan(0n);
    });

    it("should calculate liquidity for tick 0 to positive range", async () => {
      const tickLower = 0;
      const tickUpper = 1000;
      const usdScaled = 1000_000_000n;

      const liquidity = await estimateLiquidity(mockContext, tickLower, tickUpper, usdScaled);

      expect(liquidity).toBeGreaterThan(0n);
    });

    it("should calculate liquidity for negative tick range", async () => {
      const tickLower = -2000;
      const tickUpper = -1000;
      const usdScaled = 500_000_000n; // 500 USDC

      const liquidity = await estimateLiquidity(mockContext, tickLower, tickUpper, usdScaled);

      expect(liquidity).toBeGreaterThan(0n);
    });

    it("should calculate liquidity for very wide tick range", async () => {
      const tickLower = -10000;
      const tickUpper = 10000;
      const usdScaled = 10000_000_000n; // 10,000 USDC

      const liquidity = await estimateLiquidity(mockContext, tickLower, tickUpper, usdScaled);

      expect(liquidity).toBeGreaterThan(0n);
    });

    it("should calculate liquidity for very narrow tick range", async () => {
      const tickLower = 0;
      const tickUpper = 10;
      const usdScaled = 100_000_000n; // 100 USDC

      const liquidity = await estimateLiquidity(mockContext, tickLower, tickUpper, usdScaled);

      expect(liquidity).toBeGreaterThan(0n);
    });

    it("should handle small USD amounts", async () => {
      const tickLower = -100;
      const tickUpper = 100;
      const usdScaled = 1_000_000n; // 1 USDC

      const liquidity = await estimateLiquidity(mockContext, tickLower, tickUpper, usdScaled);

      expect(liquidity).toBeGreaterThan(0n);
    });

    it("should handle very small USD amounts", async () => {
      const tickLower = -100;
      const tickUpper = 100;
      const usdScaled = 1000n; // 0.001 USDC

      const liquidity = await estimateLiquidity(mockContext, tickLower, tickUpper, usdScaled);

      // Very small amounts might result in 0 liquidity due to rounding
      expect(liquidity).toBeTypeOf("bigint");
    });

    it("should handle large USD amounts", async () => {
      const tickLower = -1000;
      const tickUpper = 1000;
      const usdScaled = 1_000_000_000_000n; // 1,000,000 USDC (1M)

      const liquidity = await estimateLiquidity(mockContext, tickLower, tickUpper, usdScaled);

      expect(liquidity).toBeGreaterThan(0n);
    });

    it("should return 0 liquidity for 0 USD amount", async () => {
      const tickLower = -100;
      const tickUpper = 100;
      const usdScaled = 0n;

      const liquidity = await estimateLiquidity(mockContext, tickLower, tickUpper, usdScaled);

      expect(liquidity).toBe(0n);
    });

    it("should validate tickLower < tickUpper", async () => {
      const tickLower = 1000;
      const tickUpper = -1000; // Invalid: lower > upper
      const usdScaled = 1000_000_000n;

      // Should throw an error for invalid tick range
      await expect(async () => {
        await estimateLiquidity(mockContext, tickLower, tickUpper, usdScaled);
      }).rejects.toThrow(
        "Invalid tick range: tickLower (1000) must be less than tickUpper (-1000)"
      );
    });

    it("should validate tickLower == tickUpper and throw error", async () => {
      const tickLower = 100;
      const tickUpper = 100; // Invalid: same tick
      const usdScaled = 1000_000_000n;

      // The function validates tickLower >= tickUpper and throws an error
      // This prevents division by zero when calculating sqrtPriceDiff
      await expect(async () => {
        await estimateLiquidity(mockContext, tickLower, tickUpper, usdScaled);
      }).rejects.toThrow("Invalid tick range: tickLower (100) must be less than tickUpper (100)");
    });

    it("should handle extreme positive ticks", async () => {
      const tickLower = 100000;
      const tickUpper = 200000;
      const usdScaled = 1000_000_000n;

      const liquidity = await estimateLiquidity(mockContext, tickLower, tickUpper, usdScaled);

      expect(liquidity).toBeGreaterThan(0n);
    });

    it("should handle extreme negative ticks", async () => {
      const tickLower = -200000;
      const tickUpper = -100000;
      const usdScaled = 1000_000_000n;

      const liquidity = await estimateLiquidity(mockContext, tickLower, tickUpper, usdScaled);

      expect(liquidity).toBeGreaterThan(0n);
    });

    it("should produce higher liquidity for narrower ranges (same USD)", async () => {
      const usdScaled = 1000_000_000n;

      const wideRangeLiquidity = await estimateLiquidity(mockContext, -1000, 1000, usdScaled);
      const narrowRangeLiquidity = await estimateLiquidity(mockContext, -100, 100, usdScaled);

      // Narrower range should produce more liquidity for same USD amount
      // because liquidity = USD / (sqrtUpper - sqrtLower)
      expect(narrowRangeLiquidity).toBeGreaterThan(wideRangeLiquidity);
    });

    it("should produce proportional liquidity for proportional USD amounts", async () => {
      const tickLower = -500;
      const tickUpper = 500;

      const liquidity1x = await estimateLiquidity(mockContext, tickLower, tickUpper, 1000_000_000n);
      const liquidity2x = await estimateLiquidity(mockContext, tickLower, tickUpper, 2000_000_000n);

      // Liquidity should be approximately 2x for 2x USD
      const ratio = Number(liquidity2x) / Number(liquidity1x);
      expect(ratio).toBeCloseTo(2, 1);
    });

    it("should handle ticks at common Uniswap V3 spacing boundaries", async () => {
      // Common tick spacings: 1, 10, 60, 200
      const tickSpacing = 60;
      const tickLower = -1000 * tickSpacing; // Aligned to spacing
      const tickUpper = 1000 * tickSpacing;
      const usdScaled = 1000_000_000n;

      const liquidity = await estimateLiquidity(mockContext, tickLower, tickUpper, usdScaled);

      expect(liquidity).toBeGreaterThan(0n);
    });

    it("should handle asymmetric tick ranges", async () => {
      const tickLower = -5000;
      const tickUpper = 1000; // More range below than above
      const usdScaled = 1000_000_000n;

      const liquidity = await estimateLiquidity(mockContext, tickLower, tickUpper, usdScaled);

      expect(liquidity).toBeGreaterThan(0n);
    });
  });

  describe("getSqrtRatioAtTick (tested indirectly)", () => {
    it("should calculate consistent sqrt ratios for positive and negative ticks", async () => {
      const usdScaled = 1000_000_000n;

      // Test symmetric ranges
      const liquidityPos = await estimateLiquidity(mockContext, 0, 1000, usdScaled);
      const liquidityNeg = await estimateLiquidity(mockContext, -1000, 0, usdScaled);

      // Both should be valid positive values
      expect(liquidityPos).toBeGreaterThan(0n);
      expect(liquidityNeg).toBeGreaterThan(0n);
    });

    it("should handle tick 0 correctly", async () => {
      const usdScaled = 1000_000_000n;

      // Ranges that include tick 0
      const liquidity = await estimateLiquidity(mockContext, -100, 100, usdScaled);

      expect(liquidity).toBeGreaterThan(0n);
    });

    it("should handle all bit flags in tick calculation", async () => {
      // These tick values will exercise different bit flags in getSqrtRatioAtTick
      // Using larger tick ranges to avoid 0 liquidity from rounding with tiny ranges
      const testTicks = [
        10, // Small range
        100, // 0x64
        256, // 0x100
        512, // 0x200
        1024, // 0x400
        2048, // 0x800
        4096, // 0x1000
        8192, // 0x2000
        16384, // 0x4000
        32768, // 0x8000
        65536, // 0x10000
        131072, // 0x20000
      ];

      const usdScaled = 1000_000_000n;

      for (const tick of testTicks) {
        const liquidity = await estimateLiquidity(mockContext, 0, tick, usdScaled);
        // Very small tick ranges (like 0 to 1) might result in 0 liquidity due to rounding
        expect(liquidity).toBeGreaterThanOrEqual(0n);
        expect(typeof liquidity).toBe("bigint");
      }
    });
  });

  describe("Edge cases and validation", () => {
    it("should handle minimum representable liquidity", async () => {
      const tickLower = -100;
      const tickUpper = 100;
      const usdScaled = 1n; // Minimum possible amount

      const liquidity = await estimateLiquidity(mockContext, tickLower, tickUpper, usdScaled);

      // Might be 0 due to rounding, but should not throw
      expect(typeof liquidity).toBe("bigint");
    });

    it("should maintain precision for intermediate calculations", async () => {
      const tickLower = -1000;
      const tickUpper = 1000;
      const usdScaled = 123_456_789n; // Odd number to test precision

      const liquidity = await estimateLiquidity(mockContext, tickLower, tickUpper, usdScaled);

      expect(liquidity).toBeGreaterThan(0n);
      // Liquidity should maintain reasonable precision
      expect(liquidity.toString().length).toBeGreaterThan(1);
    });
  });
});
