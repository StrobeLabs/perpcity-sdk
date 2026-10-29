import type { Fees } from "../types/entity-data";
import { E6, mulDiv, mulDivUp } from "./fixedPoint";

/** Swap fee rates as the contract reads them: uint24, scaled by 1e6. */
export type FeeRatesE6 = {
  lpFee: bigint;
  creatorFee: bigint;
  insuranceFee: bigint;
  protocolFee: bigint;
};

export type SwapFeeAmounts = {
  lp: bigint;
  protocol: bigint;
  creator: bigint;
  insurance: bigint;
  total: bigint;
};

/** The 1e6-scaled rates behind a `Fees` (fractions). */
export function feeRatesE6(fees: Fees): FeeRatesE6 {
  const e6 = (rate: number) => BigInt(Math.round(rate * 1e6));
  return {
    lpFee: e6(fees.lpFee),
    creatorFee: e6(fees.creatorFee),
    insuranceFee: e6(fees.insuranceFee),
    protocolFee: e6(fees.protocolFee),
  };
}

/**
 * Fees a swap of `volume` (|USD leg|, micro-USD) pays: each leg
 * `fullMulDivUp(volume, rate, 1e6)`, as `PerpLogic.swap` on both builds.
 */
export function swapFees(volume: bigint, rates: FeeRatesE6): SwapFeeAmounts {
  const v = volume < 0n ? -volume : volume;
  const lp = mulDivUp(v, rates.lpFee, E6);
  const protocol = mulDivUp(v, rates.protocolFee, E6);
  const creator = mulDivUp(v, rates.creatorFee, E6);
  const insurance = mulDivUp(v, rates.insuranceFee, E6);
  return { lp, protocol, creator, insurance, total: lp + protocol + creator + insurance };
}

/** Liquidation fee on a position value: `fullMulDiv(value, liqFee, 1e6)`. */
export function liquidationFeeAmount(value: bigint, liqFeeE6: bigint): bigint {
  return mulDiv(value, liqFeeE6, E6);
}
