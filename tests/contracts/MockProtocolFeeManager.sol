// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract MockProtocolFeeManager {
    uint256 public protocolFee;

    constructor(uint256 initialProtocolFee) {
        protocolFee = initialProtocolFee;
    }

    function setProtocolFee(uint256 newProtocolFee) external {
        protocolFee = newProtocolFee;
    }

    function canCollectProtocolFees(address) external pure returns (bool) {
        return true;
    }
}

