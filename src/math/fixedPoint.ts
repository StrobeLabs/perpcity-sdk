import type { PerpBuild } from "../utils/build";
import { Q96 } from "../utils/constants";

export { Q96 };

/**
 * Integer primitives with the contracts' rounding. Inputs and outputs are
 * bigints in the on-chain scale; nothing here overflows because bigint is
 * unbounded, so only the rounding has to match Solidity.
 */

export const WAD = 10n ** 18n;
export const E6 = 1_000_000n;

export function abs(x: bigint): bigint {
  return x < 0n ? -x : x;
}

/** `FixedPointMathLib.fullMulDiv`: floor(a * b / d) for non-negative inputs. */
export function mulDiv(a: bigint, b: bigint, d: bigint): bigint {
  return (a * b) / d;
}

/** `FixedPointMathLib.fullMulDivUp`: ceil(a * b / d) for non-negative inputs. */
export function mulDivUp(a: bigint, b: bigint, d: bigint): bigint {
  const product = a * b;
  return product % d === 0n ? product / d : product / d + 1n;
}

/**
 * `SignedFixedPointMathLib.sFullMulDiv`: |a|·|b|/d truncated, sign restored.
 * With `roundUp`, a remainder adds 1: for any sign on 58b42b7, only for a
 * non-negative result on v0.2.2 (the library changed between the builds).
 */
export function sMulDiv(
  a: bigint,
  b: bigint,
  d: bigint,
  roundUp: boolean,
  build: PerpBuild
): bigint {
  const product = abs(a) * abs(b);
  const magnitude = product / d;
  const negative = (a < 0n && b > 0n) || (a > 0n && b < 0n);
  let result = negative ? -magnitude : magnitude;
  if (roundUp && product % d !== 0n && (build === "58b42b7" || !negative)) result += 1n;
  return result;
}

/** Solady `FixedPointMathLib.avg`: floor((a + b) / 2). */
export function avg(a: bigint, b: bigint): bigint {
  return (a + b) / 2n;
}

/**
 * Solady `FixedPointMathLib.expWad`: e^x for a WAD-scaled x, bit for bit.
 * Bigint `/` truncates toward zero (`sdiv`) and `>>` floors (`sar`), which is
 * what the assembly does.
 */
export function expWad(x: bigint): bigint {
  if (x <= -41446531673892822313n) return 0n;
  if (x >= 135305999368893231589n) throw new Error("expWad overflow");

  x = (x << 78n) / 5n ** 18n;
  const k = ((x << 96n) / 54916777467707473351141471128n + (1n << 95n)) >> 96n;
  x = x - k * 54916777467707473351141471128n;

  let y = x + 1346386616545796478920950773328n;
  y = ((y * x) >> 96n) + 57155421227552351082224309758442n;
  let p = y + x - 94201549194550492254356042504812n;
  p = ((p * y) >> 96n) + 28719021644029726153956944680412240n;
  p = p * x + (4385272521454847904659076985693276n << 96n);

  let q = x - 2855989394907223263936484059900n;
  q = ((q * x) >> 96n) + 50020603652535783019961831881945n;
  q = ((q * x) >> 96n) - 533845033583426703283633433725380n;
  q = ((q * x) >> 96n) + 3604857256930695427073651918091429n;
  q = ((q * x) >> 96n) - 14423608567350463180887372962807573n;
  q = ((q * x) >> 96n) + 26449188498355588339934803723976023n;

  const r = p / q;
  return (r * 3822833074963236453042738258902158003155416615667n) >> (195n - k);
}
