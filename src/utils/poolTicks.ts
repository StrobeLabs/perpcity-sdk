import { type Address, encodeAbiParameters, type Hex, keccak256, type PublicClient } from "viem";
import type { PoolTick, PoolTickMap } from "./swapExact";
import { bitmapPosition, compressTick, PERP_MAX_TICK, PERP_MIN_TICK } from "./tickMath";

/**
 * Reads a perp pool's initialized ticks straight from the Uniswap v4
 * `PoolManager`.
 *
 * This reimplements v4's `StateLibrary` slot math rather than calling the
 * `StateView` periphery contract, because `StateView` is deployed at a
 * different address on every chain (and not at all on some), while `extsload`
 * is on the `PoolManager` itself. `extsload(bytes32[])` also batches every read
 * into one `eth_call`, so a whole tick map costs two round trips: one for the
 * bitmap, one for the ticks it points at.
 *
 * The map only changes when a maker mints or burns, so callers should cache it
 * and revalidate with `assertTickMapFresh` against the streamed pool liquidity.
 */

/** `StateLibrary.POOLS_SLOT` — the `PoolManager.pools` mapping. */
const POOLS_SLOT = 6n;
/** Offsets into `Pool.State`. */
const LIQUIDITY_OFFSET = 3n;
const TICKS_OFFSET = 4n;
const TICK_BITMAP_OFFSET = 5n;

const UINT128_MAX = (1n << 128n) - 1n;
const INT128_SIGN_BIT = 1n << 127n;
const TWO_POW_128 = 1n << 128n;

const POOL_MANAGER_ABI = [
  {
    type: "function",
    name: "extsload",
    stateMutability: "view",
    inputs: [{ name: "slots", type: "bytes32[]" }],
    outputs: [{ name: "values", type: "bytes32[]" }],
  },
] as const;

/**
 * Uniswap v4 `PoolManager` per chain. The perp's own `POOL_MANAGER` is a
 * compile-time constant with no getter, so it has to be mirrored here.
 */
const POOL_MANAGER_BY_CHAIN: Readonly<Record<number, Address>> = {
  42161: "0x360E68faCcca8cA495c1B759Fd9EEe466db9FB32",
  421614: "0xFB3e0C6F74eB1a21CC1Da29aeC80D2Dfe6C9a317",
};

export function getPoolManagerAddress(chainId: number): Address {
  const address = POOL_MANAGER_BY_CHAIN[chainId];
  if (!address) throw new Error(`no Uniswap v4 PoolManager known for chain ${chainId}`);
  return address;
}

function addToSlot(slot: Hex, offset: bigint): Hex {
  const next = BigInt(slot) + offset;
  return `0x${next.toString(16).padStart(64, "0")}`;
}

/** `StateLibrary._getPoolStateSlot` */
function poolStateSlot(poolId: Hex): Hex {
  return keccak256(
    encodeAbiParameters([{ type: "bytes32" }, { type: "uint256" }], [poolId, POOLS_SLOT])
  );
}

/**
 * Slot of a mapping keyed by a signed tick-ish value. v4 hashes the key
 * sign-extended to 32 bytes, so `int256` encoding reproduces it for both the
 * `int16` word positions and the `int24` ticks.
 */
function signedKeySlot(key: number, mappingSlot: Hex): Hex {
  return keccak256(
    encodeAbiParameters([{ type: "int256" }, { type: "bytes32" }], [BigInt(key), mappingSlot])
  );
}

function decodeTickInfo(word: Hex): { liquidityGross: bigint; liquidityNet: bigint } {
  const value = BigInt(word);
  const liquidityNet = value >> 128n;
  return {
    liquidityGross: value & UINT128_MAX,
    liquidityNet: liquidityNet >= INT128_SIGN_BIT ? liquidityNet - TWO_POW_128 : liquidityNet,
  };
}

/** Bitmap words spanning every tick a perp maker is allowed to initialize. */
function wordPositions(tickSpacing: number): number[] {
  const min = bitmapPosition(compressTick(PERP_MIN_TICK, tickSpacing)).wordPos;
  const max = bitmapPosition(compressTick(PERP_MAX_TICK, tickSpacing)).wordPos;
  return Array.from({ length: max - min + 1 }, (_, i) => min + i);
}

async function extsload(
  publicClient: PublicClient,
  poolManager: Address,
  slots: Hex[]
): Promise<readonly Hex[]> {
  if (slots.length === 0) return [];
  return publicClient.readContract({
    address: poolManager,
    abi: POOL_MANAGER_ABI,
    functionName: "extsload",
    args: [slots],
  });
}

/**
 * Fetch every initialized tick of a perp pool, ascending.
 *
 * @param poolId - The perp's `POOL_ID`.
 * @param tickSpacing - The pool key's tick spacing (30 for perps).
 * @param poolManager - Override the per-chain `PoolManager` address.
 */
export async function fetchPoolTickMap(
  publicClient: PublicClient,
  opts: { poolId: Hex; tickSpacing: number; poolManager?: Address }
): Promise<PoolTickMap> {
  const { poolId, tickSpacing } = opts;
  const chainId = opts.poolManager ? undefined : publicClient.chain?.id;
  if (!opts.poolManager && chainId === undefined) {
    throw new Error("fetchPoolTickMap needs a poolManager address or a chain-aware client");
  }
  const poolManager = opts.poolManager ?? getPoolManagerAddress(chainId as number);

  const stateSlot = poolStateSlot(poolId);
  const bitmapMapping = addToSlot(stateSlot, TICK_BITMAP_OFFSET);
  const ticksMapping = addToSlot(stateSlot, TICKS_OFFSET);

  const words = wordPositions(tickSpacing);
  const bitmaps = await extsload(
    publicClient,
    poolManager,
    words.map((wordPos) => signedKeySlot(wordPos, bitmapMapping))
  );

  const initializedTicks: number[] = [];
  words.forEach((wordPos, index) => {
    const bitmap = BigInt(bitmaps[index] ?? "0x0");
    if (bitmap === 0n) return;
    for (let bitPos = 0; bitPos < 256; bitPos++) {
      if ((bitmap >> BigInt(bitPos)) & 1n) {
        initializedTicks.push((wordPos * 256 + bitPos) * tickSpacing);
      }
    }
  });

  const tickInfos = await extsload(
    publicClient,
    poolManager,
    initializedTicks.map((tick) => signedKeySlot(tick, ticksMapping))
  );

  const ticks: PoolTick[] = initializedTicks.map((tick, index) => ({
    tick,
    liquidityNet: decodeTickInfo(tickInfos[index] ?? "0x0").liquidityNet,
  }));

  return { tickSpacing, ticks };
}

/** Read the pool's live active liquidity, to check a cached tick map against. */
export async function fetchPoolLiquidity(
  publicClient: PublicClient,
  opts: { poolId: Hex; poolManager?: Address }
): Promise<bigint> {
  const poolManager = opts.poolManager ?? getPoolManagerAddress(publicClient.chain?.id as number);
  const slot = addToSlot(poolStateSlot(opts.poolId), LIQUIDITY_OFFSET);
  const [value] = await extsload(publicClient, poolManager, [slot]);
  return BigInt(value ?? "0x0");
}
