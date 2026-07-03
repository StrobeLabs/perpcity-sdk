import { describe, expect, it, vi } from "vitest";
import type { PerpCityContext } from "../../context";
import type { PerpAddress } from "../../types";
import { estimateLiquidity } from "../../utils/liquidity";

const PERP = "0x8ac0179073a9eb5aaee58e5ebe9882066b9e7b6c" as PerpAddress;
const Q96 = 1n << 96n;

// sqrt price high enough that every tested range sits below the current
// price, matching the common maker use case of pure USD exposure.
const SQRT_PRICE_ABOVE_ALL_RANGES = 23000n * Q96;

type MockOptions = {
  sqrtPriceX96?: bigint;
  markPriceX96?: bigint;
  beaconIndexX96?: bigint;
  makerInitRatio?: number;
  callImpl?: (args: { data: string }) => Promise<unknown>;
};

function makeContext(options: MockOptions = {}) {
  const sqrtPriceX96 = options.sqrtPriceX96 ?? SQRT_PRICE_ABOVE_ALL_RANGES;
  const ammPriceX96 = options.markPriceX96 ?? (sqrtPriceX96 * sqrtPriceX96) / Q96;

  const readContract = vi.fn(async ({ functionName }: { functionName: string }) => {
    if (functionName === "poolState") {
      return [0, sqrtPriceX96, ammPriceX96, 0n];
    }
    if (functionName === "makerMarginRatios") {
      return [options.makerInitRatio ?? 1_000_000, 900_000, 800_000];
    }
    if (functionName === "index") {
      return options.beaconIndexX96 ?? 0n;
    }
    throw new Error(`Unexpected readContract call: ${functionName}`);
  });

  const call = vi.fn(options.callImpl ?? (async () => ({ data: "0x" })));

  const context = {
    publicClient: { readContract, call },
    getPerpConfig: vi.fn(async () => ({
      marginRatios: "0x8afca53c52b1f02d76aefb811c6b08f4bd3e4cf9",
      beacon: "0xd3ac79e96148b420f86fb5fc57573a767d00ec16",
    })),
  } as unknown as PerpCityContext;

  return { context, readContract, call };
}

describe("estimateLiquidity", () => {
  describe("range below current price (pure USD exposure)", () => {
    it("reproduces the on-chain margin check boundary exactly", async () => {
      // Mainnet regression: margin of 200 USDC over ticks 33990-40080 (range
      // below the current price). The naive amount1 formula returns
      // 102712534, which reverts with MarginRatioTooLow on-chain; the max
      // liquidity accepted by the contract is 102712533.
      const { context } = makeContext();

      const liquidity = await estimateLiquidity(context, PERP, 33990, 40080, 200_000_000n);

      expect(liquidity).toBe(102712533n);
    });

    it("calculates liquidity for a normal tick range", async () => {
      const { context } = makeContext();

      const liquidity = await estimateLiquidity(context, PERP, -1000, 1000, 1000_000_000n);

      expect(liquidity).toBeGreaterThan(0n);
      expect(liquidity).toBeTypeOf("bigint");
    });

    it("calculates liquidity for negative tick ranges", async () => {
      const { context } = makeContext();

      const liquidity = await estimateLiquidity(context, PERP, -2000, -1000, 500_000_000n);

      expect(liquidity).toBeGreaterThan(0n);
    });

    it("handles extreme tick ranges", async () => {
      const { context } = makeContext();

      const positive = await estimateLiquidity(context, PERP, 100000, 200000, 1000_000_000n);
      const negative = await estimateLiquidity(context, PERP, -200000, -100000, 1000_000_000n);

      expect(positive).toBeGreaterThan(0n);
      expect(negative).toBeGreaterThan(0n);
    });

    it("produces higher liquidity for narrower ranges at the same margin", async () => {
      const { context } = makeContext();
      const usdScaled = 1000_000_000n;

      const wide = await estimateLiquidity(context, PERP, -1000, 1000, usdScaled);
      const narrow = await estimateLiquidity(context, PERP, -100, 100, usdScaled);

      expect(narrow).toBeGreaterThan(wide);
    });

    it("produces proportional liquidity for proportional margins", async () => {
      const { context } = makeContext();

      const liquidity1x = await estimateLiquidity(context, PERP, -500, 500, 1000_000_000n);
      const liquidity2x = await estimateLiquidity(context, PERP, -500, 500, 2000_000_000n);

      expect(Number(liquidity2x) / Number(liquidity1x)).toBeCloseTo(2, 1);
    });

    it("scales liquidity up when the maker initial margin ratio is below 100%", async () => {
      const full = await estimateLiquidity(makeContext().context, PERP, -500, 500, 1000_000_000n);
      const half = await estimateLiquidity(
        makeContext({ makerInitRatio: 500_000 }).context,
        PERP,
        -500,
        500,
        1000_000_000n
      );

      expect(Number(half) / Number(full)).toBeCloseTo(2, 1);
    });
  });

  describe("range at or above current price (mark-priced exposure)", () => {
    // Current price of ~60.9 (mainnet snapshot): sqrtPrice = sqrt(60.9) * 2^96
    const SQRT_PRICE_60_9 = 618371252740528218980151607296n;
    const MARK_60_9 = (SQRT_PRICE_60_9 * SQRT_PRICE_60_9) / Q96;

    it("computes liquidity for a range straddling the current price", async () => {
      const { context } = makeContext({
        sqrtPriceX96: SQRT_PRICE_60_9,
        markPriceX96: MARK_60_9,
      });

      // Price 60.9 sits inside ticks 33990 (price ~29.9) to 44280 (price ~83.8)
      const liquidity = await estimateLiquidity(context, PERP, 33990, 44280, 200_000_000n);

      expect(liquidity).toBeGreaterThan(0n);
      // The perp side of a straddling range is worth less per liquidity unit
      // than the same span valued as USD, so the estimate exceeds the pure
      // amount1 valuation of the full range.
      const naive = makeContext();
      const usdOnly = await estimateLiquidity(naive.context, PERP, 33990, 44280, 200_000_000n);
      expect(liquidity).toBeGreaterThan(usdOnly);
    });

    it("computes liquidity for a range entirely above the current price", async () => {
      const { context } = makeContext({
        sqrtPriceX96: SQRT_PRICE_60_9,
        markPriceX96: MARK_60_9,
      });

      // Ticks 42000 (price ~66.6) to 44280 (price ~83.8), above price 60.9
      const liquidity = await estimateLiquidity(context, PERP, 42000, 44280, 200_000_000n);

      expect(liquidity).toBeGreaterThan(0n);
    });

    it("returns less liquidity when the mark price is higher", async () => {
      const cheap = makeContext({
        sqrtPriceX96: SQRT_PRICE_60_9,
        markPriceX96: MARK_60_9,
      });
      const expensive = makeContext({
        sqrtPriceX96: SQRT_PRICE_60_9,
        markPriceX96: MARK_60_9 * 2n,
      });

      const cheapLiquidity = await estimateLiquidity(
        cheap.context,
        PERP,
        42000,
        44280,
        200_000_000n
      );
      const expensiveLiquidity = await estimateLiquidity(
        expensive.context,
        PERP,
        42000,
        44280,
        200_000_000n
      );

      expect(expensiveLiquidity).toBeLessThan(cheapLiquidity);
    });
  });

  describe("simulation verification", () => {
    it("bisects down to the contract's boundary when the estimate reports MarginRatioTooLow", async () => {
      // Simulate a contract whose true max healthy liquidity (100_000_000) is
      // below the analytic estimate (102_712_533), as happens when the mark
      // price sits above both the AMM price and the beacon index.
      const CONTRACT_MAX = 100_000_000n;
      const { context } = makeContext({
        callImpl: async ({ data }: { data: string }) => {
          const liquidity = BigInt(`0x${data.slice(10 + 64 * 4, 10 + 64 * 5)}`);
          if (liquidity > CONTRACT_MAX) {
            throw new Error("execution reverted with reason: 0xb2c649db");
          }
          return { data: "0x" };
        },
      });

      const liquidity = await estimateLiquidity(context, PERP, 33990, 40080, 200_000_000n);

      expect(liquidity).toBeLessThanOrEqual(CONTRACT_MAX);
      // Bisection stops within 0.1% of the boundary.
      expect(liquidity).toBeGreaterThan((CONTRACT_MAX * 998n) / 1000n);
    });

    it("treats unrelated reverts (e.g. missing allowance) as a passing margin check", async () => {
      const { context, call } = makeContext({
        callImpl: async () => {
          throw new Error("ERC20: transfer amount exceeds allowance");
        },
      });

      const liquidity = await estimateLiquidity(context, PERP, 33990, 40080, 200_000_000n);

      expect(liquidity).toBe(102712533n);
      expect(call).toHaveBeenCalledTimes(1);
    });

    it("throws when no liquidity amount passes the margin check", async () => {
      const { context } = makeContext({
        callImpl: async () => {
          throw new Error("execution reverted with reason: 0xb2c649db");
        },
      });

      await expect(estimateLiquidity(context, PERP, 33990, 40080, 200_000_000n)).rejects.toThrow(
        "Could not find a liquidity amount passing the maker margin check"
      );
    });
  });

  describe("input validation", () => {
    it("returns 0 liquidity for 0 margin without touching the chain", async () => {
      const { context, readContract } = makeContext();

      const liquidity = await estimateLiquidity(context, PERP, -100, 100, 0n);

      expect(liquidity).toBe(0n);
      expect(readContract).not.toHaveBeenCalled();
    });

    it("rejects tickLower > tickUpper", async () => {
      const { context } = makeContext();

      await expect(estimateLiquidity(context, PERP, 1000, -1000, 1000_000_000n)).rejects.toThrow(
        "Invalid tick range: tickLower (1000) must be less than tickUpper (-1000)"
      );
    });

    it("rejects tickLower == tickUpper", async () => {
      const { context } = makeContext();

      await expect(estimateLiquidity(context, PERP, 100, 100, 1000_000_000n)).rejects.toThrow(
        "Invalid tick range: tickLower (100) must be less than tickUpper (100)"
      );
    });

    it("rejects margins too small to survive the rounding slack", async () => {
      const { context } = makeContext();

      await expect(estimateLiquidity(context, PERP, -100, 100, 2n)).rejects.toThrow(
        "too small to collateralize"
      );
    });
  });
});
