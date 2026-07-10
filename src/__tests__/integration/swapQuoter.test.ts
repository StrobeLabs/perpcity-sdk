import { type Address, createPublicClient, type Hex, http, type PublicClient } from "viem";
import { arbitrum, arbitrumSepolia } from "viem/chains";
import { beforeAll, describe, expect, it } from "vitest";
import { PERP_ABI } from "../../abis/perp";
import { fetchPoolTickMap } from "../../utils/poolTicks";
import {
  assertTickMapFresh,
  maxFillablePerpDelta,
  type PoolTickMap,
  simulateTakerSwapExact,
} from "../../utils/swapExact";

/**
 * Differential test: `simulateTakerSwapExact` vs Uniswap's own V4Quoter, run
 * against a live perp pool.
 *
 * The perp settles its fill through `PoolManager.swap`, and V4Quoter quotes by
 * running that same swap under `unlock` and reverting out the result. So the
 * quoter is ground truth for the fill, and the walker has to match it to the
 * wei — this is the check that lets the exact simulator be trusted on the money
 * path. Expectations are derived from the chain at runtime rather than pinned,
 * so the test keeps its teeth as the pool's liquidity moves.
 *
 * Read-only (`eth_call`). Set `RPC_URL` to enable; otherwise the suite skips.
 */

const RPC_URL = process.env.RPC_URL;
const PERP_ADDRESS = (process.env.PERP_ADDRESS ??
  "0x8ac0179073a9eb5aaee58e5ebe9882066b9e7b6c") as Address;

/** Uniswap v4 periphery. Test-only: the SDK reads the PoolManager directly. */
const V4_QUOTER_BY_CHAIN: Record<number, Address> = {
  [arbitrum.id]: "0x3972c00f7ed4885e145823eb7c655375d275a1c5",
  [arbitrumSepolia.id]: "0x7dE51022d70A725b508085468052E25e22b5c4c9",
};

const QUOTER_ABI = [
  {
    type: "function",
    name: "quoteExactOutputSingle",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          {
            name: "poolKey",
            type: "tuple",
            components: [
              { name: "currency0", type: "address" },
              { name: "currency1", type: "address" },
              { name: "fee", type: "uint24" },
              { name: "tickSpacing", type: "int24" },
              { name: "hooks", type: "address" },
            ],
          },
          { name: "zeroForOne", type: "bool" },
          { name: "exactAmount", type: "uint128" },
          { name: "hookData", type: "bytes" },
        ],
      },
    ],
    outputs: [
      { name: "amountIn", type: "uint256" },
      { name: "gasEstimate", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "quoteExactInputSingle",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          {
            name: "poolKey",
            type: "tuple",
            components: [
              { name: "currency0", type: "address" },
              { name: "currency1", type: "address" },
              { name: "fee", type: "uint24" },
              { name: "tickSpacing", type: "int24" },
              { name: "hooks", type: "address" },
            ],
          },
          { name: "zeroForOne", type: "bool" },
          { name: "exactAmount", type: "uint128" },
          { name: "hookData", type: "bytes" },
        ],
      },
    ],
    outputs: [
      { name: "amountOut", type: "uint256" },
      { name: "gasEstimate", type: "uint256" },
    ],
  },
] as const;

type PoolKey = {
  currency0: Address;
  currency1: Address;
  fee: number;
  tickSpacing: number;
  hooks: Address;
};

describe.runIf(RPC_URL)("simulateTakerSwapExact vs V4Quoter (live pool)", () => {
  let publicClient: PublicClient;
  let quoter: Address;
  let poolKey: PoolKey;
  let tickMap: PoolTickMap;
  let sqrtPriceX96: bigint;
  let liquidity: bigint;
  let markPrice: number;

  /** Returns the pool's USD leg, or null when the swap cannot be settled. */
  async function quote(perpDelta: bigint): Promise<bigint | null> {
    const isLong = perpDelta > 0n;
    const exactAmount = isLong ? perpDelta : -perpDelta;
    try {
      const { result } = await publicClient.simulateContract({
        address: quoter,
        abi: QUOTER_ABI,
        functionName: isLong ? "quoteExactOutputSingle" : "quoteExactInputSingle",
        args: [{ poolKey, zeroForOne: !isLong, exactAmount, hookData: "0x" }],
      });
      return result[0];
    } catch {
      return null;
    }
  }

  function simulate(perpDelta: bigint) {
    return simulateTakerSwapExact({ sqrtPriceX96, liquidity, perpDelta, markPrice, tickMap });
  }

  beforeAll(async () => {
    const chain =
      Number(process.env.CHAIN_ID ?? arbitrum.id) === arbitrumSepolia.id
        ? arbitrumSepolia
        : arbitrum;
    publicClient = createPublicClient({ chain, transport: http(RPC_URL) }) as PublicClient;
    quoter = V4_QUOTER_BY_CHAIN[chain.id] as Address;

    const [poolId, key, poolState] = await Promise.all([
      publicClient.readContract({ address: PERP_ADDRESS, abi: PERP_ABI, functionName: "POOL_ID" }),
      publicClient.readContract({ address: PERP_ADDRESS, abi: PERP_ABI, functionName: "poolKey" }),
      publicClient.readContract({
        address: PERP_ADDRESS,
        abi: PERP_ABI,
        functionName: "poolState",
      }),
    ]);

    poolKey = key as PoolKey;
    sqrtPriceX96 = poolState[1];
    liquidity = poolState[3];
    markPrice = Number(sqrtPriceX96) ** 2 / 2 ** 192;
    tickMap = await fetchPoolTickMap(publicClient, {
      poolId: poolId as Hex,
      tickSpacing: poolKey.tickSpacing,
    });
  }, 60_000);

  it("reads a tick map that reproduces the pool's active liquidity", () => {
    expect(tickMap.ticks.length).toBeGreaterThan(0);
    expect(() => assertTickMapFresh(tickMap, sqrtPriceX96, liquidity)).not.toThrow();
  });

  it("quotes the pool's fill exactly, across sizes and both sides", async () => {
    for (const isLong of [true, false]) {
      const max = maxFillablePerpDelta({ sqrtPriceX96, liquidity, tickMap, isLong });
      expect(max).toBeGreaterThan(0n);

      for (const numerator of [1n, 10n, 50n, 90n, 100n]) {
        const size = (max * numerator) / 100n;
        if (size === 0n) continue;
        const perpDelta = isLong ? size : -size;

        const expected = await quote(perpDelta);
        const simulated = simulate(perpDelta);

        expect(expected, `pool could not settle ${perpDelta}`).not.toBeNull();
        expect(simulated.exceedsLiquidity).toBe(false);
        // usdDelta is signed by side; the quoter always returns a magnitude.
        expect(simulated.usdDelta < 0n ? -simulated.usdDelta : simulated.usdDelta).toBe(expected);
      }
    }
  }, 120_000);

  it("finds the exact capacity boundary: max fills, max + 1 reverts", async () => {
    for (const isLong of [true, false]) {
      const max = maxFillablePerpDelta({ sqrtPriceX96, liquidity, tickMap, isLong });
      const sign = isLong ? 1n : -1n;

      expect(await quote(sign * max)).not.toBeNull();
      expect(simulate(sign * max).exceedsLiquidity).toBe(false);

      expect(await quote(sign * (max + 1n))).toBeNull();
      expect(simulate(sign * (max + 1n)).exceedsLiquidity).toBe(true);
    }
  }, 60_000);
});
