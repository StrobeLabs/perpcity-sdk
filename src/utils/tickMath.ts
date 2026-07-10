/**
 * Exact bigint port of Uniswap v4 `TickMath.getSqrtPriceAtTick`.
 *
 * The perp's fill is settled by a real Uniswap v4 `PoolManager.swap`, so any
 * simulation that wants to agree with the chain to the wei has to reproduce the
 * same fixed-point tick math rather than `Math.sqrt(1.0001 ** tick)`.
 */

/** Magic multipliers from Uniswap's `TickMath`, keyed by the `absTick` bit they apply to. */
const RATIO_BY_BIT: ReadonlyArray<readonly [number, bigint]> = [
  [0x2, 0xfff97272373d413259a46990580e213an],
  [0x4, 0xfff2e50f5f656932ef12357cf3c7fdccn],
  [0x8, 0xffe5caca7e10e4e61c3624eaa0941cd0n],
  [0x10, 0xffcb9843d60f6159c9db58835c926644n],
  [0x20, 0xff973b41fa98c081472e6896dfb254c0n],
  [0x40, 0xff2ea16466c96a3843ec78b326b52861n],
  [0x80, 0xfe5dee046a99a2a811c461f1969c3053n],
  [0x100, 0xfcbe86c7900a88aedcffc83b479aa3a4n],
  [0x200, 0xf987a7253ac413176f2b074cf7815e54n],
  [0x400, 0xf3392b0822b70005940c7a398e4b70f3n],
  [0x800, 0xe7159475a2c29b7443b29c7fa6e889d9n],
  [0x1000, 0xd097f3bdfd2022b8845ad8f792aa5825n],
  [0x2000, 0xa9f746462d870fdf8a65dc1f90e061e5n],
  [0x4000, 0x70d869a156d2a1b890bb3df62baf32f7n],
  [0x8000, 0x31be135f97d08fd981231505542fcfa6n],
  [0x10000, 0x9aa508b5b7a84e1c677de54f3e99bc9n],
  [0x20000, 0x5d6af8dedb81196699c329225ee604n],
  [0x40000, 0x2216e584f5fa1ea926041bedfe98n],
  [0x80000, 0x48a170391f7dc42444e8fa2n],
];

const ODD_TICK_RATIO = 0xfffcb933bd6fad37aa2d162d1a594001n;
const ONE_X128 = 0x100000000000000000000000000000000n;
const UINT256_MAX = (1n << 256n) - 1n;
const TWO_POW_32 = 1n << 32n;

/** Uniswap's absolute tick bounds (`TickMath.MIN_TICK` / `MAX_TICK`). */
export const UNI_MIN_TICK = -887272;
export const UNI_MAX_TICK = 887272;

/** `TickMath.getSqrtPriceAtTick(UNI_MIN_TICK / UNI_MAX_TICK)`. */
export const UNI_MIN_SQRT_PRICE_X96 = 4295128739n;
export const UNI_MAX_SQRT_PRICE_X96 = 1461446703485210103287273052203988822378723970342n;

/**
 * Tick bounds the perp enforces on maker positions (`TicksOutOfBounds` in
 * `PerpLogic.openMaker`). Every initialized tick in a perp pool lies inside
 * this range, which bounds how much of the tick bitmap has to be scanned.
 *
 * Mirrors `MIN_TICK` / `MAX_TICK` in perpcity-contracts `src/libraries/Constants.sol`.
 * Those are compile-time constants with no on-chain getter, so keep them in sync.
 */
export const PERP_MIN_TICK = -138180;
export const PERP_MAX_TICK = 138180;

/**
 * `sqrt(1.0001^tick) * 2^96`, matching Uniswap's fixed-point result exactly.
 *
 * @param tick - Tick to price, within Uniswap's absolute bounds.
 */
export function getSqrtPriceAtTick(tick: number): bigint {
  if (!Number.isInteger(tick)) throw new Error(`tick must be an integer, got ${tick}`);
  const absTick = tick < 0 ? -tick : tick;
  if (absTick > UNI_MAX_TICK) throw new Error(`tick ${tick} out of bounds`);

  let ratio = (absTick & 0x1) !== 0 ? ODD_TICK_RATIO : ONE_X128;
  for (const [bit, multiplier] of RATIO_BY_BIT) {
    if ((absTick & bit) !== 0) ratio = (ratio * multiplier) >> 128n;
  }

  // Ticks above zero price up, so invert the (always <= 1) accumulated ratio.
  if (tick > 0) ratio = UINT256_MAX / ratio;

  // X128 -> X96, rounding up so the result never prices a tick below its true value.
  return (ratio >> 32n) + (ratio % TWO_POW_32 === 0n ? 0n : 1n);
}

/**
 * Floor-divide `tick` by `tickSpacing`, matching Solidity's `TickBitmap.compress`
 * (which rounds toward negative infinity, unlike bigint `/`).
 */
export function compressTick(tick: number, tickSpacing: number): number {
  const compressed = Math.trunc(tick / tickSpacing);
  return tick < 0 && tick % tickSpacing !== 0 ? compressed - 1 : compressed;
}

/** Split a compressed tick into its `(wordPos, bitPos)` bitmap coordinates. */
export function bitmapPosition(compressed: number): { wordPos: number; bitPos: number } {
  return { wordPos: compressed >> 8, bitPos: compressed & 0xff };
}
