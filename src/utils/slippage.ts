/**
 * Slippage-limit helpers for the taker money path.
 *
 * `openTakerPosition` / `adjustTaker` take a contract-native `amt1Limit`. The
 * contract checks it against the *currency1* (USD) leg of the swap, never the
 * perp-token leg — see `PerpLogic.checkTakerAmountLimits`:
 *
 *   if (delta.amount0() > 0)  // long: receiving perp, paying USD
 *     if (delta.amount1().abs() > amt1Limit) revert MaxAmtExceeded;  // ceiling on USD paid
 *   if (delta.amount0() < 0)  // short: sending perp, receiving USD
 *     if (delta.amount1().abs() < amt1Limit) revert MinAmtUnmet;     // floor on USD received
 *
 * So `amt1Limit` is denominated in USD and derived from `usdDelta`, NOT from
 * `perpDelta`. Deriving it from the perp leg looks right when the mark price is
 * ~1 but diverges by a factor of `price` otherwise; for prediction-market
 * prices (< 1) it makes shorts revert with MinAmtUnmet. This helper is the
 * single authoritative place that math lives.
 *
 * `usdDelta` from `estimateTakerPosition` is already scaled to contract units
 * (1e6) and signed (negative for longs), so the returned bigint is passed
 * straight to `openTakerPosition({ amt1Limit })` without rescaling.
 */

const BPS_DENOMINATOR = 10_000n;

/**
 * Computes the contract `amt1Limit` for opening (or adjusting) a taker
 * position, applying a symmetric slippage tolerance to the quoted USD delta.
 *
 * - Long  (`isLong: true`)  -> maximum USD to pay: raise the notional.
 * - Short (`isLong: false`) -> minimum USD to receive: lower the notional.
 *
 * @param quote - Anything carrying the signed `usdDelta` from
 *   `estimateTakerPosition` (the sign is ignored; magnitude is used).
 * @param isLong - Direction of the position.
 * @param slippagePercent - Tolerance in percent (e.g. `1` for 1%). Must be in
 *   `[0, 100)`.
 * @returns `amt1Limit` in contract units (USD micro-units), ready to pass to
 *   `openTakerPosition`.
 */
export function calculateTakerSlippageLimit(
  quote: { usdDelta: bigint },
  isLong: boolean,
  slippagePercent: number
): bigint {
  if (!Number.isFinite(slippagePercent) || slippagePercent < 0) {
    throw new Error("slippagePercent must be a non-negative number");
  }
  if (!isLong && slippagePercent >= 100) {
    throw new Error("slippagePercent must be below 100 for a short");
  }

  const notional = quote.usdDelta < 0n ? -quote.usdDelta : quote.usdDelta;
  const bps = BigInt(Math.round(slippagePercent * 100));

  return isLong
    ? (notional * (BPS_DENOMINATOR + bps)) / BPS_DENOMINATOR
    : (notional * (BPS_DENOMINATOR - bps)) / BPS_DENOMINATOR;
}
