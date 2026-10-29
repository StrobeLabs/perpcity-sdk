import type { PerpBuild } from "../utils/build";

/**
 * The protocol rules that differ between the deployed builds, in one place.
 * Line references are `src/libraries/PerpLogic.sol` at 58b42b7 and at tag
 * v0.2.2-upgradeable.
 */
export type BuildRules = {
  /**
   * Open check, both builds: init margin ratio on (margin - fees + PnL) /
   * value at the post-trade fair price (58b :268-275, v0.2.2 :389-399).
   * The 5 USD minimum is checked on the deposit before fees (58b :256) or
   * also after fees (v0.2.2 :391).
   */
  minMarginAfterFees: boolean;
  /**
   * Taker liquidation check. 58b (:346-352): close-swap fees and the
   * liquidation fee are subtracted first and the position is valued at the
   * post-close-swap mark. v0.2.2 (:474-480): settled margin + PnL at the
   * pre-swap mark, no fees.
   */
  liquidationNetsFees: boolean;
  /** EMA source: the `emas()` view (58b) or a storage read (v0.2.2). */
  emaRead: "view" | "storage";
  /** `liquidateTaker` / `liquidateMaker` arguments: 2, or 3 with an amount. */
  liquidateArgs: 2 | 3;
  /**
   * `sFullMulDiv(.., roundUp)` adds 1 on a remainder for any sign (58b) or
   * only for a non-negative result (v0.2.2).
   */
  signedRoundUpAnySign: boolean;
  /**
   * Maker removal capacity is prorated rounding down (58b `fullMulDiv` :105-106) or up
   * (v0.2.2 `proratedCapacity`, `fullMulDivUp` :773).
   */
  removedCapacityRoundsUp: boolean;
  /**
   * Maker health position value: |amount0| at mark + |amount1| of the
   * deposit delta (58b `valPnl` :624-634), or the in-range liquidity value
   * (v0.2.2 :805-822).
   */
  makerValue: "delta" | "liquidity";
};

export const BUILD_RULES: Readonly<Record<PerpBuild, BuildRules>> = {
  "58b42b7": {
    minMarginAfterFees: false,
    liquidationNetsFees: true,
    emaRead: "view",
    liquidateArgs: 2,
    signedRoundUpAnySign: true,
    removedCapacityRoundsUp: false,
    makerValue: "delta",
  },
  "v0.2.2": {
    minMarginAfterFees: true,
    liquidationNetsFees: false,
    emaRead: "storage",
    liquidateArgs: 3,
    signedRoundUpAnySign: false,
    removedCapacityRoundsUp: true,
    makerValue: "liquidity",
  },
};
