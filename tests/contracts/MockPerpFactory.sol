// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./MockPerp.sol";

contract MockPerpFactory {
    event PerpCreated(
        address perp,
        bytes32 poolId,
        MockPerp.Modules modules,
        uint256 initialIndex,
        uint24 emaWindow,
        uint256 protocolFee,
        uint160 sqrtPriceX96,
        int24 tick,
        address owner,
        string name,
        string symbol,
        string tokenUri
    );

    address public immutable ACCOUNTING_TOKEN_IMPLEMENTATION;
    address public immutable PROTOCOL_FEE_MANAGER;

    mapping(address => bool) public perps;

    constructor(address accountingTokenImplementation, address protocolFeeManager) {
        ACCOUNTING_TOKEN_IMPLEMENTATION = accountingTokenImplementation;
        PROTOCOL_FEE_MANAGER = protocolFeeManager;
    }

    function createPerp(
        address owner,
        string memory name,
        string memory symbol,
        string memory tokenUri,
        MockPerp.Modules memory modules,
        uint24 emaWindow,
        bytes32 salt
    ) external returns (address perp) {
        address currency0 = address(uint160(uint256(keccak256(abi.encode(msg.sender, salt, uint256(0))))));
        address currency1 = address(uint160(uint256(keccak256(abi.encode(msg.sender, salt, uint256(1))))));
        if (currency0 > currency1) (currency0, currency1) = (currency1, currency0);

        MockPerp.PoolKey memory key =
            MockPerp.PoolKey({currency0: currency0, currency1: currency1, fee: 0, tickSpacing: 60, hooks: address(0)});

        perp = address(
            new MockPerp(
                owner,
                key,
                modules,
                PROTOCOL_FEE_MANAGER,
                100,
                emaWindow,
                uint160(79228162514264337593543950336),
                79228162514264337593543950336
            )
        );
        perps[perp] = true;
        emit PerpCreated(
            perp,
            keccak256(abi.encode(currency0, currency1, salt)),
            modules,
            79228162514264337593543950336,
            emaWindow,
            100,
            uint160(79228162514264337593543950336),
            0,
            owner,
            name,
            symbol,
            tokenUri
        );
    }
}

