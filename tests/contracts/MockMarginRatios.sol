// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract MockMarginRatios {
    uint24 public immutable MIN_TAKER_RATIO;
    uint24 public immutable MAX_TAKER_RATIO;
    uint24 public immutable LIQUIDATION_TAKER_RATIO;
    uint24 public immutable MIN_MAKER_RATIO;
    uint24 public immutable MAX_MAKER_RATIO;
    uint24 public immutable LIQUIDATION_MAKER_RATIO;

    constructor(
        uint24 minTaker,
        uint24 maxTaker,
        uint24 liqTaker,
        uint24 minMaker,
        uint24 maxMaker,
        uint24 liqMaker
    ) {
        MIN_TAKER_RATIO = minTaker;
        MAX_TAKER_RATIO = maxTaker;
        LIQUIDATION_TAKER_RATIO = liqTaker;
        MIN_MAKER_RATIO = minMaker;
        MAX_MAKER_RATIO = maxMaker;
        LIQUIDATION_MAKER_RATIO = liqMaker;
    }
}
