export const PERP_MANAGER_ABI = [
    {
        "inputs": [
            {
                "internalType": "contract IPoolManager",
                "name": "poolManager",
                "type": "address"
            },
            {
                "internalType": "address",
                "name": "usdc",
                "type": "address"
            }
        ],
        "stateMutability": "nonpayable",
        "type": "constructor"
    },
    {
        "inputs": [
            {
                "internalType": "uint8",
                "name": "action",
                "type": "uint8"
            }
        ],
        "name": "InvalidAction",
        "type": "error"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "caller",
                "type": "address"
            },
            {
                "internalType": "address",
                "name": "expectedCaller",
                "type": "address"
            }
        ],
        "name": "InvalidCaller",
        "type": "error"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "caller",
                "type": "address"
            },
            {
                "internalType": "address",
                "name": "holder",
                "type": "address"
            },
            {
                "internalType": "bool",
                "name": "isLiquidated",
                "type": "bool"
            }
        ],
        "name": "InvalidClose",
        "type": "error"
    },
    {
        "inputs": [
            {
                "internalType": "uint128",
                "name": "liquidity",
                "type": "uint128"
            }
        ],
        "name": "InvalidLiquidity",
        "type": "error"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "margin",
                "type": "uint256"
            }
        ],
        "name": "InvalidMargin",
        "type": "error"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "currentTimestamp",
                "type": "uint256"
            },
            {
                "internalType": "uint256",
                "name": "lockupPeriodEnd",
                "type": "uint256"
            }
        ],
        "name": "MakerPositionLocked",
        "type": "error"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "maximumAmount",
                "type": "uint256"
            },
            {
                "internalType": "uint256",
                "name": "amountRequested",
                "type": "uint256"
            }
        ],
        "name": "MaximumAmountExceeded",
        "type": "error"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "minimumAmount",
                "type": "uint256"
            },
            {
                "internalType": "uint256",
                "name": "amountReceived",
                "type": "uint256"
            }
        ],
        "name": "MinimumAmountInsufficient",
        "type": "error"
    },
    {
        "inputs": [],
        "name": "NotPoolManager",
        "type": "error"
    },
    {
        "inputs": [
            {
                "internalType": "bytes",
                "name": "reason",
                "type": "bytes"
            }
        ],
        "name": "UnexpectedRevertBytes",
        "type": "error"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": false,
                "internalType": "PoolId",
                "name": "perpId",
                "type": "bytes32"
            },
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "posId",
                "type": "uint256"
            },
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "newMargin",
                "type": "uint256"
            }
        ],
        "name": "MarginAdded",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": false,
                "internalType": "PoolId",
                "name": "perpId",
                "type": "bytes32"
            },
            {
                "indexed": false,
                "internalType": "address",
                "name": "beacon",
                "type": "address"
            },
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "startingSqrtPriceX96",
                "type": "uint256"
            }
        ],
        "name": "PerpCreated",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": false,
                "internalType": "PoolId",
                "name": "perpId",
                "type": "bytes32"
            },
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "posId",
                "type": "uint256"
            },
            {
                "indexed": false,
                "internalType": "bool",
                "name": "wasLiquidated",
                "type": "bool"
            },
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "sqrtPriceX96",
                "type": "uint256"
            }
        ],
        "name": "PositionClosed",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": false,
                "internalType": "PoolId",
                "name": "perpId",
                "type": "bytes32"
            },
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "posId",
                "type": "uint256"
            },
            {
                "indexed": false,
                "internalType": "bool",
                "name": "isMaker",
                "type": "bool"
            },
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "margin",
                "type": "uint256"
            },
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "sqrtPriceX96",
                "type": "uint256"
            }
        ],
        "name": "PositionOpened",
        "type": "event"
    },
    {
        "inputs": [],
        "name": "POOL_MANAGER",
        "outputs": [
            {
                "internalType": "contract IPoolManager",
                "name": "",
                "type": "address"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "USDC",
        "outputs": [
            {
                "internalType": "address",
                "name": "",
                "type": "address"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "PoolId",
                "name": "perpId",
                "type": "bytes32"
            },
            {
                "components": [
                    {
                        "internalType": "uint128",
                        "name": "posId",
                        "type": "uint128"
                    },
                    {
                        "internalType": "uint256",
                        "name": "margin",
                        "type": "uint256"
                    }
                ],
                "internalType": "struct IPerpManager.AddMarginParams",
                "name": "params",
                "type": "tuple"
            }
        ],
        "name": "addMargin",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "PoolId",
                "name": "perpId",
                "type": "bytes32"
            },
            {
                "components": [
                    {
                        "internalType": "uint128",
                        "name": "posId",
                        "type": "uint128"
                    },
                    {
                        "internalType": "uint128",
                        "name": "minAmt0Out",
                        "type": "uint128"
                    },
                    {
                        "internalType": "uint128",
                        "name": "minAmt1Out",
                        "type": "uint128"
                    },
                    {
                        "internalType": "uint128",
                        "name": "maxAmt1In",
                        "type": "uint128"
                    }
                ],
                "internalType": "struct IPerpManager.ClosePositionParams",
                "name": "params",
                "type": "tuple"
            }
        ],
        "name": "closePosition",
        "outputs": [
            {
                "internalType": "uint128",
                "name": "posId",
                "type": "uint128"
            }
        ],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "components": [
                    {
                        "internalType": "uint160",
                        "name": "startingSqrtPriceX96",
                        "type": "uint160"
                    },
                    {
                        "internalType": "address",
                        "name": "beacon",
                        "type": "address"
                    }
                ],
                "internalType": "struct IPerpManager.CreatePerpParams",
                "name": "params",
                "type": "tuple"
            }
        ],
        "name": "createPerp",
        "outputs": [
            {
                "internalType": "PoolId",
                "name": "perpId",
                "type": "bytes32"
            }
        ],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "int24",
                "name": "tickA",
                "type": "int24"
            },
            {
                "internalType": "int24",
                "name": "tickB",
                "type": "int24"
            },
            {
                "internalType": "uint256",
                "name": "amount1",
                "type": "uint256"
            }
        ],
        "name": "estimateLiquidityForAount1",
        "outputs": [
            {
                "internalType": "uint128",
                "name": "liquidity",
                "type": "uint128"
            }
        ],
        "stateMutability": "pure",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "PoolId",
                "name": "perpId",
                "type": "bytes32"
            },
            {
                "internalType": "uint128",
                "name": "posId",
                "type": "uint128"
            }
        ],
        "name": "getPosition",
        "outputs": [
            {
                "components": [
                    {
                        "internalType": "address",
                        "name": "holder",
                        "type": "address"
                    },
                    {
                        "internalType": "uint256",
                        "name": "margin",
                        "type": "uint256"
                    },
                    {
                        "internalType": "int256",
                        "name": "perpDelta",
                        "type": "int256"
                    },
                    {
                        "internalType": "int256",
                        "name": "usdDelta",
                        "type": "int256"
                    },
                    {
                        "internalType": "int256",
                        "name": "entryTwPremiumX96",
                        "type": "int256"
                    },
                    {
                        "components": [
                            {
                                "internalType": "uint32",
                                "name": "entryTimestamp",
                                "type": "uint32"
                            },
                            {
                                "internalType": "int24",
                                "name": "tickLower",
                                "type": "int24"
                            },
                            {
                                "internalType": "int24",
                                "name": "tickUpper",
                                "type": "int24"
                            },
                            {
                                "internalType": "uint128",
                                "name": "liquidity",
                                "type": "uint128"
                            },
                            {
                                "internalType": "int256",
                                "name": "entryTwPremiumGrowthInsideX96",
                                "type": "int256"
                            },
                            {
                                "internalType": "int256",
                                "name": "entryTwPremiumDivBySqrtPriceGrowthInsideX96",
                                "type": "int256"
                            },
                            {
                                "internalType": "int256",
                                "name": "entryTwPremiumGrowthBelowX96",
                                "type": "int256"
                            }
                        ],
                        "internalType": "struct IPerpManager.MakerDetails",
                        "name": "makerDetails",
                        "type": "tuple"
                    }
                ],
                "internalType": "struct IPerpManager.Position",
                "name": "",
                "type": "tuple"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "PoolId",
                "name": "perpId",
                "type": "bytes32"
            },
            {
                "internalType": "uint32",
                "name": "secondsAgo",
                "type": "uint32"
            }
        ],
        "name": "getTimeWeightedAvg",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "PoolId",
                "name": "perpId",
                "type": "bytes32"
            },
            {
                "internalType": "uint32",
                "name": "cardinalityNext",
                "type": "uint32"
            }
        ],
        "name": "increaseCardinalityNext",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "PoolId",
                "name": "perpId",
                "type": "bytes32"
            },
            {
                "internalType": "uint128",
                "name": "posId",
                "type": "uint128"
            }
        ],
        "name": "livePositionDetails",
        "outputs": [
            {
                "internalType": "int256",
                "name": "pnl",
                "type": "int256"
            },
            {
                "internalType": "int256",
                "name": "fundingPayment",
                "type": "int256"
            },
            {
                "internalType": "int256",
                "name": "effectiveMargin",
                "type": "int256"
            },
            {
                "internalType": "bool",
                "name": "isLiquidatable",
                "type": "bool"
            },
            {
                "internalType": "uint256",
                "name": "newPriceX96",
                "type": "uint256"
            }
        ],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "PoolId",
                "name": "perpId",
                "type": "bytes32"
            },
            {
                "components": [
                    {
                        "internalType": "uint256",
                        "name": "margin",
                        "type": "uint256"
                    },
                    {
                        "internalType": "uint128",
                        "name": "liquidity",
                        "type": "uint128"
                    },
                    {
                        "internalType": "int24",
                        "name": "tickLower",
                        "type": "int24"
                    },
                    {
                        "internalType": "int24",
                        "name": "tickUpper",
                        "type": "int24"
                    },
                    {
                        "internalType": "uint128",
                        "name": "maxAmt0In",
                        "type": "uint128"
                    },
                    {
                        "internalType": "uint128",
                        "name": "maxAmt1In",
                        "type": "uint128"
                    }
                ],
                "internalType": "struct IPerpManager.OpenMakerPositionParams",
                "name": "params",
                "type": "tuple"
            }
        ],
        "name": "openMakerPosition",
        "outputs": [
            {
                "internalType": "uint128",
                "name": "makerPosId",
                "type": "uint128"
            }
        ],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "PoolId",
                "name": "perpId",
                "type": "bytes32"
            },
            {
                "components": [
                    {
                        "internalType": "bool",
                        "name": "isLong",
                        "type": "bool"
                    },
                    {
                        "internalType": "uint256",
                        "name": "margin",
                        "type": "uint256"
                    },
                    {
                        "internalType": "uint256",
                        "name": "levX96",
                        "type": "uint256"
                    },
                    {
                        "internalType": "uint128",
                        "name": "unspecifiedAmountLimit",
                        "type": "uint128"
                    }
                ],
                "internalType": "struct IPerpManager.OpenTakerPositionParams",
                "name": "params",
                "type": "tuple"
            }
        ],
        "name": "openTakerPosition",
        "outputs": [
            {
                "internalType": "uint128",
                "name": "takerPosId",
                "type": "uint128"
            }
        ],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "PoolId",
                "name": "",
                "type": "bytes32"
            }
        ],
        "name": "perps",
        "outputs": [
            {
                "internalType": "address",
                "name": "vault",
                "type": "address"
            },
            {
                "internalType": "address",
                "name": "beacon",
                "type": "address"
            },
            {
                "internalType": "address",
                "name": "creator",
                "type": "address"
            },
            {
                "internalType": "uint32",
                "name": "creationTimestamp",
                "type": "uint32"
            },
            {
                "internalType": "uint32",
                "name": "makerLockupPeriod",
                "type": "uint32"
            },
            {
                "internalType": "uint32",
                "name": "twapWindow",
                "type": "uint32"
            },
            {
                "internalType": "uint32",
                "name": "lastTwPremiumsUpdate",
                "type": "uint32"
            },
            {
                "internalType": "uint24",
                "name": "creatorFee",
                "type": "uint24"
            },
            {
                "internalType": "uint24",
                "name": "insuranceFee",
                "type": "uint24"
            },
            {
                "internalType": "uint24",
                "name": "liquidationFee",
                "type": "uint24"
            },
            {
                "internalType": "uint24",
                "name": "liquidatorFeeSplit",
                "type": "uint24"
            },
            {
                "internalType": "uint128",
                "name": "nextPosId",
                "type": "uint128"
            },
            {
                "internalType": "uint256",
                "name": "sqrtPriceLowerMultiX96",
                "type": "uint256"
            },
            {
                "internalType": "uint256",
                "name": "sqrtPriceUpperMultiX96",
                "type": "uint256"
            },
            {
                "internalType": "uint24",
                "name": "minOpeningMargin",
                "type": "uint24"
            },
            {
                "internalType": "uint24",
                "name": "minMakerOpeningMarginRatio",
                "type": "uint24"
            },
            {
                "internalType": "uint24",
                "name": "maxMakerOpeningMarginRatio",
                "type": "uint24"
            },
            {
                "internalType": "uint24",
                "name": "makerLiquidationMarginRatio",
                "type": "uint24"
            },
            {
                "internalType": "uint24",
                "name": "minTakerOpeningMarginRatio",
                "type": "uint24"
            },
            {
                "internalType": "uint24",
                "name": "maxTakerOpeningMarginRatio",
                "type": "uint24"
            },
            {
                "internalType": "uint24",
                "name": "takerLiquidationMarginRatio",
                "type": "uint24"
            },
            {
                "internalType": "int256",
                "name": "twPremiumX96",
                "type": "int256"
            },
            {
                "internalType": "int256",
                "name": "twPremiumDivBySqrtPriceX96",
                "type": "int256"
            },
            {
                "internalType": "int256",
                "name": "premiumPerSecondX96",
                "type": "int256"
            },
            {
                "components": [
                    {
                        "internalType": "Currency",
                        "name": "currency0",
                        "type": "address"
                    },
                    {
                        "internalType": "Currency",
                        "name": "currency1",
                        "type": "address"
                    },
                    {
                        "internalType": "uint24",
                        "name": "fee",
                        "type": "uint24"
                    },
                    {
                        "internalType": "int24",
                        "name": "tickSpacing",
                        "type": "int24"
                    },
                    {
                        "internalType": "contract IHooks",
                        "name": "hooks",
                        "type": "address"
                    }
                ],
                "internalType": "struct PoolKey",
                "name": "key",
                "type": "tuple"
            },
            {
                "components": [
                    {
                        "internalType": "uint128",
                        "name": "baseFeeX96",
                        "type": "uint128"
                    },
                    {
                        "internalType": "uint128",
                        "name": "startFeeX96",
                        "type": "uint128"
                    },
                    {
                        "internalType": "uint128",
                        "name": "targetFeeX96",
                        "type": "uint128"
                    },
                    {
                        "internalType": "uint128",
                        "name": "decay",
                        "type": "uint128"
                    },
                    {
                        "internalType": "uint128",
                        "name": "volatilityScalerX96",
                        "type": "uint128"
                    },
                    {
                        "internalType": "uint128",
                        "name": "maxFeeMultiplierX96",
                        "type": "uint128"
                    }
                ],
                "internalType": "struct TradingFee.Config",
                "name": "tradingFeeConfig",
                "type": "tuple"
            },
            {
                "components": [
                    {
                        "internalType": "uint32",
                        "name": "index",
                        "type": "uint32"
                    },
                    {
                        "internalType": "uint32",
                        "name": "cardinality",
                        "type": "uint32"
                    },
                    {
                        "internalType": "uint32",
                        "name": "cardinalityNext",
                        "type": "uint32"
                    },
                    {
                        "components": [
                            {
                                "internalType": "uint32",
                                "name": "blockTimestamp",
                                "type": "uint32"
                            },
                            {
                                "internalType": "uint216",
                                "name": "cumulativeValue",
                                "type": "uint216"
                            },
                            {
                                "internalType": "bool",
                                "name": "initialized",
                                "type": "bool"
                            }
                        ],
                        "internalType": "struct TimeWeightedAvg.Observation[65535]",
                        "name": "observations",
                        "type": "tuple[65535]"
                    }
                ],
                "internalType": "struct TimeWeightedAvg.State",
                "name": "twapState",
                "type": "tuple"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "PoolId",
                "name": "perpId",
                "type": "bytes32"
            }
        ],
        "name": "tickSpacing",
        "outputs": [
            {
                "internalType": "int24",
                "name": "",
                "type": "int24"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "bytes",
                "name": "data",
                "type": "bytes"
            }
        ],
        "name": "unlockCallback",
        "outputs": [
            {
                "internalType": "bytes",
                "name": "encodedDelta",
                "type": "bytes"
            }
        ],
        "stateMutability": "nonpayable",
        "type": "function"
    }
] as const;