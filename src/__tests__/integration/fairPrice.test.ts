import { type Address, createWalletClient, http } from "viem";
import { arbitrum } from "viem/chains";
import { describe, expect, it } from "vitest";
import { PRICING_ABI } from "../../abis/pricing";
import { PerpCityContext } from "../../context";
import { getPriceCorridor } from "../../functions/corridor";
import { getFairPrice } from "../../math/pricing";

/**
 * Chain parity for the fair price: the SDK reads the inputs (pool spot,
 * beacon index, stored EMAs advanced to the block time) and prices them with
 * its own `fairPriceX96`; the perp's pricing module prices the same inputs
 * by `eth_call`. One live perp of each deployed build, at a pinned Arbitrum
 * One block (needs an archive RPC; the keyless Tenderly gateway serves one).
 *
 * Set `ARBITRUM_RPC_URL` to enable; otherwise the suite skips. CI runs it in
 * the `chain-parity` job.
 */

const RPC_URL = process.env.ARBITRUM_RPC_URL;
const PINNED_BLOCK = 519_300_000n;

const PERPS: Array<{ build: "58b42b7" | "v0.2.2"; perp: Address }> = [
  { build: "58b42b7", perp: "0x008e29c04be4d3373c78efe7b1d88d6714f0afae" },
  { build: "v0.2.2", perp: "0xFD40006F4DbB8B89Bc38C774615995e786302e64" },
];

describe.runIf(RPC_URL)("fair price vs the deployed pricing module", () => {
  const context = new PerpCityContext({
    walletClient: createWalletClient({ chain: arbitrum, transport: http(RPC_URL) }),
    rpcUrl: RPC_URL!,
    deployments: { usdc: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831" },
  });

  it.each(PERPS)("matches fairPrice on a $build perp", async ({ build, perp }) => {
    const cfg = await context.getPerpConfig(perp);
    expect(cfg.build).toBe(build);

    const fair = await getFairPrice(context, perp, { blockNumber: PINNED_BLOCK });
    expect(fair.storedEmaAmmX96).toBeGreaterThan(0n);
    expect(fair.timestamp).toBeGreaterThanOrEqual(fair.lastTouch);

    const onChain = await context.publicClient.readContract({
      address: cfg.pricing,
      abi: PRICING_ABI,
      functionName: "fairPrice",
      args: [fair.spotX96, fair.indexX96, fair.emaAmmX96, fair.emaIndexX96],
      blockNumber: PINNED_BLOCK,
    });
    expect(fair.fairX96).toBe(onChain);
  });

  it.each(PERPS)("reads a corridor that contains the spot on a $build perp", async ({ perp }) => {
    const [fair, corridor] = await Promise.all([
      getFairPrice(context, perp, { blockNumber: PINNED_BLOCK }),
      getPriceCorridor(context, perp, { blockNumber: PINNED_BLOCK }),
    ]);
    expect(corridor.sqrtMinX96).toBeLessThan(corridor.sqrtMaxX96);
    expect(fair.sqrtPriceX96).toBeGreaterThanOrEqual(corridor.sqrtMinX96);
    expect(fair.sqrtPriceX96).toBeLessThanOrEqual(corridor.sqrtMaxX96);
  });
});
