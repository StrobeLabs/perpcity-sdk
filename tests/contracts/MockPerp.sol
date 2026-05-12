// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract MockPerp {
    struct PoolKey {
        address currency0;
        address currency1;
        uint24 fee;
        int24 tickSpacing;
        address hooks;
    }

    struct Modules {
        address beacon;
        address fees;
        address funding;
        address marginRatios;
        address priceImpact;
        address pricing;
    }

    struct Capacity {
        uint128 long;
        uint128 short;
    }

    struct MakerFunding {
        int256 belowX96;
        int256 withinX96;
        int256 divSqrtPriceWithinX96;
    }

    struct OpenMakerParams {
        address holder;
        uint128 margin;
        int24 tickLower;
        int24 tickUpper;
        uint128 liquidity;
        uint256 maxAmt0In;
        uint256 maxAmt1In;
    }

    struct AdjustMakerParams {
        uint256 posId;
        int128 marginDelta;
        int128 liquidityDelta;
        uint256 amt0Limit;
        uint256 amt1Limit;
    }

    struct OpenTakerParams {
        address holder;
        uint128 margin;
        int256 perpDelta;
        uint256 amt1Limit;
    }

    struct AdjustTakerParams {
        uint256 posId;
        int128 marginDelta;
        int256 perpDelta;
        uint256 amt1Limit;
    }

    struct SwapResult {
        int256 delta;
        uint256 ammPrice;
        int256 totalFeeAmt;
        uint256 lpFeeAmt;
        uint256 protocolFeeAmt;
        uint256 creatorFeeAmt;
        uint256 insuranceFeeAmt;
    }

    event MakerOpened(uint256 posId);
    event MakerAdjusted(uint256 posId, int256 funding, uint256 longUtilFees, uint256 shortUtilFees, uint256 lpFees);
    event MakerClosed(uint256 posId, int256 funding, uint256 longUtilFees, uint256 shortUtilFees, uint256 lpFees, uint256 liqFee, bool isLiquidation);
    event TakerOpened(uint256 posId, SwapResult sr);
    event TakerAdjusted(uint256 posId, SwapResult sr, int256 funding, uint256 utilFees);
    event TakerClosed(uint256 posId, SwapResult sr, int256 funding, uint256 utilFees, uint256 liqFee, bool isLiquidation);

    address public immutable PROTOCOL_FEE_MANAGER;
    uint256 public immutable EMA_WINDOW;
    bytes32 public immutable POOL_ID;
    address public immutable CURRENCY_0;
    address public immutable CURRENCY_1;

    address public owner;
    uint256 public protocolFee;
    uint256 public nextPosId = 1;
    Modules public modules;
    PoolKey internal poolKey_;
    uint160 internal sqrtPriceX96_;
    uint256 internal ammPriceX96_;
    int24 internal tick_;
    uint128 internal poolLiquidity_;

    mapping(uint256 => address) internal owners;
    mapping(uint256 => int256) internal deltas;
    mapping(uint256 => uint128) internal margins;
    mapping(uint256 => uint24) internal liqRatios;
    mapping(uint256 => uint24) internal backstopRatios;
    mapping(uint256 => int24) internal makerTickLower;
    mapping(uint256 => int24) internal makerTickUpper;
    mapping(uint256 => uint128) internal makerLiquidity;

    constructor(
        address owner_,
        PoolKey memory poolKey,
        Modules memory modules_,
        address protocolFeeManager_,
        uint256 protocolFee_,
        uint256 emaWindow_,
        uint160 sqrtPriceX96,
        uint256 ammPriceX96
    ) {
        owner = owner_;
        poolKey_ = poolKey;
        modules = modules_;
        PROTOCOL_FEE_MANAGER = protocolFeeManager_;
        protocolFee = protocolFee_;
        EMA_WINDOW = emaWindow_;
        CURRENCY_0 = poolKey.currency0;
        CURRENCY_1 = poolKey.currency1;
        POOL_ID = keccak256(abi.encode(poolKey.currency0, poolKey.currency1, poolKey.tickSpacing));
        sqrtPriceX96_ = sqrtPriceX96;
        ammPriceX96_ = ammPriceX96;
        poolLiquidity_ = 1_000_000;
    }

    function poolKey() external view returns (PoolKey memory) {
        return poolKey_;
    }

    function poolState() external view returns (int24 tick, uint160 sqrtPriceX96, uint256 ammPriceX96, uint128 liquidity) {
        return (tick_, sqrtPriceX96_, ammPriceX96_, poolLiquidity_);
    }

    function rates() external view returns (int88 fundingPerDay, uint64 longUtilFeePerDay, uint64 shortUtilFeePerDay, uint40 lastTouch) {
        return (int88(int256(0.01e18)), 0, 0, uint40(block.timestamp));
    }

    function positions(uint256 posId)
        external
        view
        returns (int256 delta, uint128 margin, uint24 liqMarginRatio, uint24 backstopMarginRatio, int256 lastCumlFundingX96)
    {
        return (deltas[posId], margins[posId], liqRatios[posId], backstopRatios[posId], 0);
    }

    function makerDetails(uint256 posId)
        external
        view
        returns (
            int24 tickLower,
            int24 tickUpper,
            uint128 liquidity,
            uint256 lastLongUtilEarningsX96,
            uint256 lastShortUtilEarningsX96,
            Capacity memory capacity_,
            MakerFunding memory lastCumlFunding
        )
    {
        return (
            makerTickLower[posId],
            makerTickUpper[posId],
            makerLiquidity[posId],
            0,
            0,
            Capacity({long: 0, short: 0}),
            MakerFunding({belowX96: 0, withinX96: 0, divSqrtPriceWithinX96: 0})
        );
    }

    function takerDetails(uint256) external pure returns (uint256 lastLongUtilPaymentsX96, uint256 lastShortUtilPaymentsX96) {
        return (0, 0);
    }

    function ownerOf(uint256 posId) external view returns (address) {
        address posOwner = owners[posId];
        require(posOwner != address(0), "NOT_MINTED");
        return posOwner;
    }

    function openMaker(OpenMakerParams calldata params) external returns (uint256 posId) {
        posId = nextPosId++;
        owners[posId] = params.holder;
        margins[posId] = params.margin;
        liqRatios[posId] = 50_000;
        backstopRatios[posId] = 25_000;
        makerTickLower[posId] = params.tickLower;
        makerTickUpper[posId] = params.tickUpper;
        makerLiquidity[posId] = params.liquidity;
        deltas[posId] = packDelta(0, -int128(uint128(params.margin)));
        emit MakerOpened(posId);
    }

    function openTaker(OpenTakerParams calldata params) external returns (uint256 posId) {
        posId = nextPosId++;
        owners[posId] = params.holder;
        margins[posId] = params.margin;
        liqRatios[posId] = 50_000;
        backstopRatios[posId] = 25_000;
        int128 amount0 = int128(params.perpDelta);
        int128 amount1 = -int128(params.perpDelta);
        deltas[posId] = packDelta(amount0, amount1);
        emit TakerOpened(posId, SwapResult({delta: deltas[posId], ammPrice: ammPriceX96_, totalFeeAmt: 0, lpFeeAmt: 0, protocolFeeAmt: 0, creatorFeeAmt: 0, insuranceFeeAmt: 0}));
    }

    function adjustTaker(AdjustTakerParams calldata params) external {
        require(owners[params.posId] != address(0), "NOT_MINTED");
        if (params.marginDelta > 0) margins[params.posId] += uint128(params.marginDelta);
        if (params.marginDelta < 0) margins[params.posId] -= uint128(-params.marginDelta);

        (int128 amount0, int128 amount1) = unpackDelta(deltas[params.posId]);
        amount0 += int128(params.perpDelta);
        amount1 -= int128(params.perpDelta);
        deltas[params.posId] = packDelta(amount0, amount1);

        if (amount0 == 0) {
            delete owners[params.posId];
            delete margins[params.posId];
            delete deltas[params.posId];
            emit TakerClosed(params.posId, SwapResult({delta: 0, ammPrice: ammPriceX96_, totalFeeAmt: 0, lpFeeAmt: 0, protocolFeeAmt: 0, creatorFeeAmt: 0, insuranceFeeAmt: 0}), 0, 0, 0, false);
        } else {
            emit TakerAdjusted(params.posId, SwapResult({delta: deltas[params.posId], ammPrice: ammPriceX96_, totalFeeAmt: 0, lpFeeAmt: 0, protocolFeeAmt: 0, creatorFeeAmt: 0, insuranceFeeAmt: 0}), 0, 0);
        }
    }

    function adjustMaker(AdjustMakerParams calldata params) external {
        require(owners[params.posId] != address(0), "NOT_MINTED");
        if (params.marginDelta > 0) margins[params.posId] += uint128(params.marginDelta);
        if (params.marginDelta < 0) margins[params.posId] -= uint128(-params.marginDelta);
        if (params.liquidityDelta > 0) makerLiquidity[params.posId] += uint128(params.liquidityDelta);
        if (params.liquidityDelta < 0) makerLiquidity[params.posId] -= uint128(-params.liquidityDelta);
        if (makerLiquidity[params.posId] == 0) {
            delete owners[params.posId];
            delete margins[params.posId];
            delete deltas[params.posId];
            emit MakerClosed(params.posId, 0, 0, 0, 0, 0, false);
        } else {
            emit MakerAdjusted(params.posId, 0, 0, 0, 0);
        }
    }

    function setupPosition(uint256 posId, address holder, uint128 margin, int128 amount0, int128 amount1, uint24 liqRatio) external {
        if (posId >= nextPosId) nextPosId = posId + 1;
        owners[posId] = holder;
        margins[posId] = margin;
        liqRatios[posId] = liqRatio;
        backstopRatios[posId] = liqRatio / 2;
        deltas[posId] = packDelta(amount0, amount1);
    }

    function setupMaker(uint256 posId, int24 tickLower, int24 tickUpper, uint128 liquidity) external {
        makerTickLower[posId] = tickLower;
        makerTickUpper[posId] = tickUpper;
        makerLiquidity[posId] = liquidity;
    }

    function packDelta(int128 amount0, int128 amount1) internal pure returns (int256) {
        return (int256(amount0) << 128) | int256(uint256(uint128(amount1)));
    }

    function unpackDelta(int256 delta) internal pure returns (int128 amount0, int128 amount1) {
        amount0 = int128(delta >> 128);
        amount1 = int128(int256(uint256(delta) & ((uint256(1) << 128) - 1)));
    }
}

