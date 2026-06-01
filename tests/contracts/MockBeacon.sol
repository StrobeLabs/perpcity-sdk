// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract MockBeacon {
    uint256 public index;

    constructor(uint256 initialIndex) {
        index = initialIndex;
    }

    function setIndex(uint256 newIndex) external {
        index = newIndex;
    }

    function twAvg(uint256) external view returns (uint256) {
        return index;
    }
}

