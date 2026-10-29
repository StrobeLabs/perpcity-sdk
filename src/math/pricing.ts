import { type Hex, hexToBigInt, toHex } from "viem";
import { BEACON_ABI } from "../abis/beacon";
import { PERP_ABI } from "../abis/perp";
import type { PerpCityContext } from "../context";
import type { PerpAddress } from "../types";
import type { PerpBuild } from "../utils/build";
import { BUILD_RULES } from "./buildRules";
import { avg, expWad, Q96, WAD } from "./fixedPoint";

/**
 * The perp mark (pricing module `fairPrice`) as the next accrue computes it,
 * for the deployed builds. Ports `PerpLogic.calcEmas` (58b42b7 and v0.2.2
 * are identical) and the mock `Pricing.fairPrice` both deployed pricing
 * modules run. Mirrors perpcity-rust-sdk `math/pricing.rs` and the backend's
 * `domain/perp_accrual.py`.
 */

/** `PerpStorage.emas` slot on v0.2.2 proxies (no `emas()` view there). */
export const PERP_EMAS_STORAGE_SLOT = 11n;

const UINT128_MASK = (1n << 128n) - 1n;

export type PricePairX96 = { emaAmmX96: bigint; emaIndexX96: bigint };

/**
 * Decay the stored EMAs toward the spots over `dtSeconds`:
 * alpha = expWad(-dt * WAD / window), ema' = (ema * alpha + spot * (WAD - alpha)) / WAD.
 */
export function advanceEmas(p: {
  emaAmmX96: bigint;
  emaIndexX96: bigint;
  ammX96: bigint;
  indexX96: bigint;
  dtSeconds: bigint;
  emaWindow: bigint;
}): PricePairX96 {
  if (p.dtSeconds <= 0n) return { emaAmmX96: p.emaAmmX96, emaIndexX96: p.emaIndexX96 };
  if (p.emaWindow <= 0n) throw new Error("emaWindow must be positive");
  const alpha = expWad(-((p.dtSeconds * WAD) / p.emaWindow));
  return {
    emaAmmX96: (p.emaAmmX96 * alpha + p.ammX96 * (WAD - alpha)) / WAD,
    emaIndexX96: (p.emaIndexX96 * alpha + p.indexX96 * (WAD - alpha)) / WAD,
  };
}

/** `fairPrice`: (amm + max(index + emaAmm - emaIndex, 0)) / 2, floored. */
export function fairPriceX96(p: {
  ammX96: bigint;
  indexX96: bigint;
  emaAmmX96: bigint;
  emaIndexX96: bigint;
}): bigint {
  const adjusted = p.indexX96 + p.emaAmmX96;
  const delta = adjusted > p.emaIndexX96 ? adjusted - p.emaIndexX96 : 0n;
  return avg(p.ammX96, delta);
}

/** `poolState().ammPrice`: sqrtPrice² / 2^96, floored. */
export function ammPriceX96FromSqrt(sqrtPriceX96: bigint): bigint {
  return (sqrtPriceX96 * sqrtPriceX96) / Q96;
}

/** Unpack the `PerpStorage.emas` word: ammPrice in the low 128 bits. */
export function unpackEmasWord(word: bigint): PricePairX96 {
  return { emaAmmX96: word & UINT128_MASK, emaIndexX96: word >> 128n };
}

export type FairPrice = {
  build: PerpBuild;
  /** The mark the next accrue prices with (X96). */
  fairX96: bigint;
  /** Pool spot `poolState().ammPrice` (X96). */
  spotX96: bigint;
  sqrtPriceX96: bigint;
  indexX96: bigint;
  /** EMAs advanced to `timestamp`. */
  emaAmmX96: bigint;
  emaIndexX96: bigint;
  /** EMAs as stored at the last touch. */
  storedEmaAmmX96: bigint;
  storedEmaIndexX96: bigint;
  lastTouch: bigint;
  timestamp: bigint;
};

export type FairPriceOptions = {
  /** Read state at this block (and use its timestamp unless one is given). */
  blockNumber?: bigint;
  /** Unix seconds to advance the EMAs to. Default: the block's, else now. */
  timestamp?: bigint;
};

/**
 * Stored EMAs: the `emas()` view on 58b42b7, a raw storage read of the
 * proxy on v0.2.2 (the implementation has no view; the proxy's own storage
 * holds `PerpStorage`).
 */
export async function readStoredEmas(
  context: PerpCityContext,
  perpAddress: PerpAddress,
  build: PerpBuild,
  blockNumber?: bigint
): Promise<PricePairX96> {
  if (BUILD_RULES[build].emaRead === "view") {
    const [ammPrice, index] = await context.publicClient.readContract({
      address: perpAddress,
      abi: PERP_ABI,
      functionName: "emas",
      blockNumber,
    });
    return { emaAmmX96: ammPrice, emaIndexX96: index };
  }
  const word = await context.publicClient.getStorageAt({
    address: perpAddress,
    slot: toHex(PERP_EMAS_STORAGE_SLOT, { size: 32 }),
    blockNumber,
  });
  return unpackEmasWord(word ? hexToBigInt(word as Hex) : 0n);
}

/**
 * Read the pool, beacon index and EMAs, advance the EMAs to now (or the given
 * block), and price the mark the contract's next accrue would use.
 */
export async function getFairPrice(
  context: PerpCityContext,
  perpAddress: PerpAddress,
  opts: FairPriceOptions = {}
): Promise<FairPrice> {
  const { blockNumber } = opts;
  const cfg = await context.getPerpConfig(perpAddress);
  const [poolState, rates, indexX96, stored, block] = await Promise.all([
    context.publicClient.readContract({
      address: perpAddress,
      abi: PERP_ABI,
      functionName: "poolState",
      blockNumber,
    }),
    context.publicClient.readContract({
      address: perpAddress,
      abi: PERP_ABI,
      functionName: "rates",
      blockNumber,
    }),
    context.publicClient.readContract({
      address: cfg.beacon,
      abi: BEACON_ABI,
      functionName: "index",
      blockNumber,
    }) as Promise<bigint>,
    readStoredEmas(context, perpAddress, cfg.build, blockNumber),
    opts.timestamp === undefined && blockNumber !== undefined
      ? context.publicClient.getBlock({ blockNumber })
      : Promise.resolve(null),
  ]);

  const timestamp = opts.timestamp ?? block?.timestamp ?? BigInt(Math.floor(Date.now() / 1000));
  const lastTouch = BigInt(rates[3]);
  const sqrtPriceX96 = poolState[1];
  const spotX96 = poolState[2];
  const emas = advanceEmas({
    ...stored,
    ammX96: spotX96,
    indexX96,
    dtSeconds: timestamp > lastTouch ? timestamp - lastTouch : 0n,
    emaWindow: BigInt(cfg.emaWindow),
  });

  return {
    build: cfg.build,
    fairX96: fairPriceX96({ ammX96: spotX96, indexX96, ...emas }),
    spotX96,
    sqrtPriceX96,
    indexX96,
    ...emas,
    storedEmaAmmX96: stored.emaAmmX96,
    storedEmaIndexX96: stored.emaIndexX96,
    lastTouch,
    timestamp,
  };
}
