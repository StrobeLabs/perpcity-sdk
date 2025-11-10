export const PERP_MANAGER_ABI = 
[
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "owner",
                "type": "address"
            }
        ],
        "stateMutability": "nonpayable",
        "type": "constructor"
    },
    {
        "inputs": [],
        "name": "AccountBalanceOverflow",
        "type": "error"
    },
    {
        "inputs": [],
        "name": "AlreadyInitialized",
        "type": "error"
    },
    {
        "inputs": [],
        "name": "BalanceQueryForZeroAddress",
        "type": "error"
    },
    {
        "inputs": [],
        "name": "FeeTooLarge",
        "type": "error"
    },
    {
        "inputs": [],
        "name": "FeesNotRegistered",
        "type": "error"
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
        "inputs": [],
        "name": "InvalidCaller",
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
        "inputs": [],
        "name": "InvalidMargin",
        "type": "error"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "marginRatio",
                "type": "uint256"
            }
        ],
        "name": "InvalidMarginRatio",
        "type": "error"
    },
    {
        "inputs": [],
        "name": "LockupPeriodNotRegistered",
        "type": "error"
    },
    {
        "inputs": [],
        "name": "MakerNotAllowed",
        "type": "error"
    },
    {
        "inputs": [],
        "name": "MarginRatiosNotRegistered",
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
        "name": "ModuleAlreadyRegistered",
        "type": "error"
    },
    {
        "inputs": [],
        "name": "NewOwnerIsZeroAddress",
        "type": "error"
    },
    {
        "inputs": [],
        "name": "NoHandoverRequest",
        "type": "error"
    },
    {
        "inputs": [],
        "name": "NotOwnerNorApproved",
        "type": "error"
    },
    {
        "inputs": [],
        "name": "NotPoolManager",
        "type": "error"
    },
    {
        "inputs": [],
        "name": "PositionLocked",
        "type": "error"
    },
    {
        "inputs": [],
        "name": "SqrtPriceImpactLimitNotRegistered",
        "type": "error"
    },
    {
        "inputs": [],
        "name": "TokenAlreadyExists",
        "type": "error"
    },
    {
        "inputs": [],
        "name": "TokenDoesNotExist",
        "type": "error"
    },
    {
        "inputs": [],
        "name": "TransferFromIncorrectOwner",
        "type": "error"
    },
    {
        "inputs": [],
        "name": "TransferToNonERC721ReceiverImplementer",
        "type": "error"
    },
    {
        "inputs": [],
        "name": "TransferToZeroAddress",
        "type": "error"
    },
    {
        "inputs": [],
        "name": "Unauthorized",
        "type": "error"
    },
    {
        "inputs": [],
        "name": "ZeroDelta",
        "type": "error"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "internalType": "address",
                "name": "owner",
                "type": "address"
            },
            {
                "indexed": true,
                "internalType": "address",
                "name": "account",
                "type": "address"
            },
            {
                "indexed": true,
                "internalType": "uint256",
                "name": "id",
                "type": "uint256"
            }
        ],
        "name": "Approval",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "internalType": "address",
                "name": "owner",
                "type": "address"
            },
            {
                "indexed": true,
                "internalType": "address",
                "name": "operator",
                "type": "address"
            },
            {
                "indexed": false,
                "internalType": "bool",
                "name": "isApproved",
                "type": "bool"
            }
        ],
        "name": "ApprovalForAll",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": false,
                "internalType": "contract IFees",
                "name": "feesModule",
                "type": "address"
            }
        ],
        "name": "FeesModuleRegistered",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": false,
                "internalType": "contract ILockupPeriod",
                "name": "lockupPeriodModule",
                "type": "address"
            }
        ],
        "name": "LockupPeriodModuleRegistered",
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
                "internalType": "uint256",
                "name": "newMargin",
                "type": "uint256"
            }
        ],
        "name": "MarginAdjusted",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": false,
                "internalType": "contract IMarginRatios",
                "name": "marginRatiosModule",
                "type": "address"
            }
        ],
        "name": "MarginRatiosModuleRegistered",
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
                "name": "sqrtPriceX96",
                "type": "uint256"
            },
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "longOI",
                "type": "uint256"
            },
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "shortOI",
                "type": "uint256"
            },
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "posId",
                "type": "uint256"
            },
            {
                "indexed": false,
                "internalType": "int256",
                "name": "newPerpDelta",
                "type": "int256"
            }
        ],
        "name": "NotionalAdjusted",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "internalType": "address",
                "name": "pendingOwner",
                "type": "address"
            }
        ],
        "name": "OwnershipHandoverCanceled",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "internalType": "address",
                "name": "pendingOwner",
                "type": "address"
            }
        ],
        "name": "OwnershipHandoverRequested",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "internalType": "address",
                "name": "oldOwner",
                "type": "address"
            },
            {
                "indexed": true,
                "internalType": "address",
                "name": "newOwner",
                "type": "address"
            }
        ],
        "name": "OwnershipTransferred",
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
                "name": "sqrtPriceX96",
                "type": "uint256"
            },
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "indexPriceX96",
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
                "name": "sqrtPriceX96",
                "type": "uint256"
            },
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "longOI",
                "type": "uint256"
            },
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "shortOI",
                "type": "uint256"
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
                "internalType": "bool",
                "name": "wasPartialClose",
                "type": "bool"
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
                "name": "sqrtPriceX96",
                "type": "uint256"
            },
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "longOI",
                "type": "uint256"
            },
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "shortOI",
                "type": "uint256"
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
                "internalType": "int256",
                "name": "entryPerpDelta",
                "type": "int256"
            }
        ],
        "name": "PositionOpened",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": false,
                "internalType": "contract ISqrtPriceImpactLimit",
                "name": "sqrtPriceImpactLimitModule",
                "type": "address"
            }
        ],
        "name": "SqrtPriceImpactLimitModuleRegistered",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "internalType": "address",
                "name": "from",
                "type": "address"
            },
            {
                "indexed": true,
                "internalType": "address",
                "name": "to",
                "type": "address"
            },
            {
                "indexed": true,
                "internalType": "uint256",
                "name": "id",
                "type": "uint256"
            }
        ],
        "name": "Transfer",
        "type": "event"
    },
    {
        "inputs": [],
        "name": "ERC721_NAME",
        "outputs": [
            {
                "internalType": "string",
                "name": "",
                "type": "string"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "ERC721_SYMBOL",
        "outputs": [
            {
                "internalType": "string",
                "name": "",
                "type": "string"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "ERC721_URI",
        "outputs": [
            {
                "internalType": "string",
                "name": "",
                "type": "string"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "MAX_PROTOCOL_FEE",
        "outputs": [
            {
                "internalType": "uint24",
                "name": "",
                "type": "uint24"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "components": [
                    {
                        "internalType": "uint256",
                        "name": "posId",
                        "type": "uint256"
                    },
                    {
                        "internalType": "int256",
                        "name": "marginDelta",
                        "type": "int256"
                    }
                ],
                "internalType": "struct IPerpManager.AdjustMarginParams",
                "name": "params",
                "type": "tuple"
            }
        ],
        "name": "adjustMargin",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "components": [
                    {
                        "internalType": "uint256",
                        "name": "posId",
                        "type": "uint256"
                    },
                    {
                        "internalType": "int256",
                        "name": "perpDelta",
                        "type": "int256"
                    },
                    {
                        "internalType": "uint128",
                        "name": "usdLimit",
                        "type": "uint128"
                    }
                ],
                "internalType": "struct IPerpManager.AdjustNotionalParams",
                "name": "params",
                "type": "tuple"
            }
        ],
        "name": "adjustNotional",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "account",
                "type": "address"
            },
            {
                "internalType": "uint256",
                "name": "id",
                "type": "uint256"
            }
        ],
        "name": "approve",
        "outputs": [],
        "stateMutability": "payable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "owner",
                "type": "address"
            }
        ],
        "name": "balanceOf",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "result",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "cancelOwnershipHandover",
        "outputs": [],
        "stateMutability": "payable",
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
        "name": "cfgs",
        "outputs": [
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
                "internalType": "address",
                "name": "creator",
                "type": "address"
            },
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
                "internalType": "contract IFees",
                "name": "fees",
                "type": "address"
            },
            {
                "internalType": "contract IMarginRatios",
                "name": "marginRatios",
                "type": "address"
            },
            {
                "internalType": "contract ILockupPeriod",
                "name": "lockupPeriod",
                "type": "address"
            },
            {
                "internalType": "contract ISqrtPriceImpactLimit",
                "name": "sqrtPriceImpactLimit",
                "type": "address"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "components": [
                    {
                        "internalType": "uint256",
                        "name": "posId",
                        "type": "uint256"
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
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "recipient",
                "type": "address"
            }
        ],
        "name": "collectProtocolFees",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "pendingOwner",
                "type": "address"
            }
        ],
        "name": "completeOwnershipHandover",
        "outputs": [],
        "stateMutability": "payable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "components": [
                    {
                        "internalType": "address",
                        "name": "beacon",
                        "type": "address"
                    },
                    {
                        "internalType": "contract IFees",
                        "name": "fees",
                        "type": "address"
                    },
                    {
                        "internalType": "contract IMarginRatios",
                        "name": "marginRatios",
                        "type": "address"
                    },
                    {
                        "internalType": "contract ILockupPeriod",
                        "name": "lockupPeriod",
                        "type": "address"
                    },
                    {
                        "internalType": "contract ISqrtPriceImpactLimit",
                        "name": "sqrtPriceImpactLimit",
                        "type": "address"
                    },
                    {
                        "internalType": "uint160",
                        "name": "startingSqrtPriceX96",
                        "type": "uint160"
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
                "internalType": "uint256",
                "name": "id",
                "type": "uint256"
            }
        ],
        "name": "getApproved",
        "outputs": [
            {
                "internalType": "address",
                "name": "result",
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
                "internalType": "uint16",
                "name": "cardinalityCap",
                "type": "uint16"
            }
        ],
        "name": "increaseCardinalityCap",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "owner",
                "type": "address"
            },
            {
                "internalType": "address",
                "name": "operator",
                "type": "address"
            }
        ],
        "name": "isApprovedForAll",
        "outputs": [
            {
                "internalType": "bool",
                "name": "result",
                "type": "bool"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "contract IFees",
                "name": "",
                "type": "address"
            }
        ],
        "name": "isFeesRegistered",
        "outputs": [
            {
                "internalType": "bool",
                "name": "",
                "type": "bool"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "contract ILockupPeriod",
                "name": "",
                "type": "address"
            }
        ],
        "name": "isLockupPeriodRegistered",
        "outputs": [
            {
                "internalType": "bool",
                "name": "",
                "type": "bool"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "contract IMarginRatios",
                "name": "",
                "type": "address"
            }
        ],
        "name": "isMarginRatiosRegistered",
        "outputs": [
            {
                "internalType": "bool",
                "name": "",
                "type": "bool"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "contract ISqrtPriceImpactLimit",
                "name": "",
                "type": "address"
            }
        ],
        "name": "isSqrtPriceImpactLimitRegistered",
        "outputs": [
            {
                "internalType": "bool",
                "name": "",
                "type": "bool"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "name",
        "outputs": [
            {
                "internalType": "string",
                "name": "",
                "type": "string"
            }
        ],
        "stateMutability": "pure",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "nextPosId",
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
        "name": "openMakerPos",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "posId",
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
                        "internalType": "address",
                        "name": "holder",
                        "type": "address"
                    },
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
        "name": "openTakerPos",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "posId",
                "type": "uint256"
            }
        ],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "owner",
        "outputs": [
            {
                "internalType": "address",
                "name": "result",
                "type": "address"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "id",
                "type": "uint256"
            }
        ],
        "name": "ownerOf",
        "outputs": [
            {
                "internalType": "address",
                "name": "result",
                "type": "address"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "pendingOwner",
                "type": "address"
            }
        ],
        "name": "ownershipHandoverExpiresAt",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "result",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "name": "positions",
        "outputs": [
            {
                "internalType": "PoolId",
                "name": "perpId",
                "type": "bytes32"
            },
            {
                "internalType": "uint256",
                "name": "margin",
                "type": "uint256"
            },
            {
                "internalType": "int256",
                "name": "entryPerpDelta",
                "type": "int256"
            },
            {
                "internalType": "int256",
                "name": "entryUsdDelta",
                "type": "int256"
            },
            {
                "internalType": "int256",
                "name": "entryCumlFundingX96",
                "type": "int256"
            },
            {
                "internalType": "uint256",
                "name": "entryCumlBadDebtX96",
                "type": "uint256"
            },
            {
                "internalType": "uint256",
                "name": "entryCumlUtilizationX96",
                "type": "uint256"
            },
            {
                "components": [
                    {
                        "internalType": "uint24",
                        "name": "min",
                        "type": "uint24"
                    },
                    {
                        "internalType": "uint24",
                        "name": "max",
                        "type": "uint24"
                    },
                    {
                        "internalType": "uint24",
                        "name": "liq",
                        "type": "uint24"
                    }
                ],
                "internalType": "struct IMarginRatios.MarginRatios",
                "name": "marginRatios",
                "type": "tuple"
            },
            {
                "components": [
                    {
                        "internalType": "uint32",
                        "name": "unlockTimestamp",
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
                        "name": "entryCumlFundingBelowX96",
                        "type": "int256"
                    },
                    {
                        "internalType": "int256",
                        "name": "entryCumlFundingWithinX96",
                        "type": "int256"
                    },
                    {
                        "internalType": "int256",
                        "name": "entryCumlFundingDivSqrtPWithinX96",
                        "type": "int256"
                    }
                ],
                "internalType": "struct IPerpManager.MakerDetails",
                "name": "makerDetails",
                "type": "tuple"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "protocolFee",
        "outputs": [
            {
                "internalType": "uint24",
                "name": "",
                "type": "uint24"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "posId",
                "type": "uint256"
            }
        ],
        "name": "quoteClosePosition",
        "outputs": [
            {
                "internalType": "bool",
                "name": "success",
                "type": "bool"
            },
            {
                "internalType": "int256",
                "name": "pnl",
                "type": "int256"
            },
            {
                "internalType": "int256",
                "name": "funding",
                "type": "int256"
            },
            {
                "internalType": "uint256",
                "name": "netMargin",
                "type": "uint256"
            },
            {
                "internalType": "bool",
                "name": "wasLiquidated",
                "type": "bool"
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
        "name": "quoteOpenMakerPosition",
        "outputs": [
            {
                "internalType": "bool",
                "name": "success",
                "type": "bool"
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
                        "internalType": "address",
                        "name": "holder",
                        "type": "address"
                    },
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
        "name": "quoteOpenTakerPosition",
        "outputs": [
            {
                "internalType": "bool",
                "name": "success",
                "type": "bool"
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
            }
        ],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "contract IFees",
                "name": "feesModule",
                "type": "address"
            }
        ],
        "name": "registerFeesModule",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "contract ILockupPeriod",
                "name": "lockupPeriodModule",
                "type": "address"
            }
        ],
        "name": "registerLockupPeriodModule",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "contract IMarginRatios",
                "name": "marginRatiosModule",
                "type": "address"
            }
        ],
        "name": "registerMarginRatiosModule",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "contract ISqrtPriceImpactLimit",
                "name": "sqrtPriceImpactLimitModule",
                "type": "address"
            }
        ],
        "name": "registerSqrtPriceImpactLimitModule",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "renounceOwnership",
        "outputs": [],
        "stateMutability": "payable",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "requestOwnershipHandover",
        "outputs": [],
        "stateMutability": "payable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "from",
                "type": "address"
            },
            {
                "internalType": "address",
                "name": "to",
                "type": "address"
            },
            {
                "internalType": "uint256",
                "name": "id",
                "type": "uint256"
            }
        ],
        "name": "safeTransferFrom",
        "outputs": [],
        "stateMutability": "payable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "from",
                "type": "address"
            },
            {
                "internalType": "address",
                "name": "to",
                "type": "address"
            },
            {
                "internalType": "uint256",
                "name": "id",
                "type": "uint256"
            },
            {
                "internalType": "bytes",
                "name": "data",
                "type": "bytes"
            }
        ],
        "name": "safeTransferFrom",
        "outputs": [],
        "stateMutability": "payable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "operator",
                "type": "address"
            },
            {
                "internalType": "bool",
                "name": "isApproved",
                "type": "bool"
            }
        ],
        "name": "setApprovalForAll",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint24",
                "name": "newProtocolFee",
                "type": "uint24"
            }
        ],
        "name": "setProtocolFee",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "bytes4",
                "name": "interfaceId",
                "type": "bytes4"
            }
        ],
        "name": "supportsInterface",
        "outputs": [
            {
                "internalType": "bool",
                "name": "result",
                "type": "bool"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "symbol",
        "outputs": [
            {
                "internalType": "string",
                "name": "",
                "type": "string"
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
            }
        ],
        "name": "takerOpenInterest",
        "outputs": [
            {
                "internalType": "uint128",
                "name": "longOI",
                "type": "uint128"
            },
            {
                "internalType": "uint128",
                "name": "shortOI",
                "type": "uint128"
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
                "name": "lookbackWindow",
                "type": "uint32"
            }
        ],
        "name": "timeWeightedAvgSqrtPriceX96",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "twAvg",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "posId",
                "type": "uint256"
            }
        ],
        "name": "tokenURI",
        "outputs": [
            {
                "internalType": "string",
                "name": "",
                "type": "string"
            }
        ],
        "stateMutability": "pure",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "from",
                "type": "address"
            },
            {
                "internalType": "address",
                "name": "to",
                "type": "address"
            },
            {
                "internalType": "uint256",
                "name": "id",
                "type": "uint256"
            }
        ],
        "name": "transferFrom",
        "outputs": [],
        "stateMutability": "payable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "newOwner",
                "type": "address"
            }
        ],
        "name": "transferOwnership",
        "outputs": [],
        "stateMutability": "payable",
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
