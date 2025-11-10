export const PERP_MANAGER_ABI = [
  {
    "type": "constructor",
    "inputs": [
      {
        "name": "poolManager",
        "type": "address",
        "internalType": "contract IPoolManager"
      },
      {
        "name": "usdc",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "POOL_MANAGER",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract IPoolManager"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "USDC",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "addMargin",
    "inputs": [
      {
        "name": "perpId",
        "type": "bytes32",
        "internalType": "PoolId"
      },
      {
        "name": "params",
        "type": "tuple",
        "internalType": "struct IPerpManager.AddMarginParams",
        "components": [
          {
            "name": "posId",
            "type": "uint128",
            "internalType": "uint128"
          },
          {
            "name": "margin",
            "type": "uint256",
            "internalType": "uint256"
          }
        ]
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "closePosition",
    "inputs": [
      {
        "name": "perpId",
        "type": "bytes32",
        "internalType": "PoolId"
      },
      {
        "name": "params",
        "type": "tuple",
        "internalType": "struct IPerpManager.ClosePositionParams",
        "components": [
          {
            "name": "posId",
            "type": "uint128",
            "internalType": "uint128"
          },
          {
            "name": "minAmt0Out",
            "type": "uint128",
            "internalType": "uint128"
          },
          {
            "name": "minAmt1Out",
            "type": "uint128",
            "internalType": "uint128"
          },
          {
            "name": "maxAmt1In",
            "type": "uint128",
            "internalType": "uint128"
          }
        ]
      }
    ],
    "outputs": [
      {
        "name": "posId",
        "type": "uint128",
        "internalType": "uint128"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "createPerp",
    "inputs": [
      {
        "name": "params",
        "type": "tuple",
        "internalType": "struct IPerpManager.CreatePerpParams",
        "components": [
          {
            "name": "startingSqrtPriceX96",
            "type": "uint160",
            "internalType": "uint160"
          },
          {
            "name": "beacon",
            "type": "address",
            "internalType": "address"
          }
        ]
      }
    ],
    "outputs": [
      {
        "name": "perpId",
        "type": "bytes32",
        "internalType": "PoolId"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "estimateLiquidityForAmount1",
    "inputs": [
      {
        "name": "tickA",
        "type": "int24",
        "internalType": "int24"
      },
      {
        "name": "tickB",
        "type": "int24",
        "internalType": "int24"
      },
      {
        "name": "amount1",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "liquidity",
        "type": "uint128",
        "internalType": "uint128"
      }
    ],
    "stateMutability": "pure"
  },
  {
    "type": "function",
    "name": "fees",
    "inputs": [
      {
        "name": "perpId",
        "type": "bytes32",
        "internalType": "PoolId"
      }
    ],
    "outputs": [
      {
        "name": "creatorFee",
        "type": "uint24",
        "internalType": "uint24"
      },
      {
        "name": "insuranceFee",
        "type": "uint24",
        "internalType": "uint24"
      },
      {
        "name": "lpFee",
        "type": "uint24",
        "internalType": "uint24"
      },
      {
        "name": "liquidationFee",
        "type": "uint24",
        "internalType": "uint24"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getPosition",
    "inputs": [
      {
        "name": "perpId",
        "type": "bytes32",
        "internalType": "PoolId"
      },
      {
        "name": "posId",
        "type": "uint128",
        "internalType": "uint128"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "tuple",
        "internalType": "struct IPerpManager.Position",
        "components": [
          {
            "name": "holder",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "margin",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "perpDelta",
            "type": "int256",
            "internalType": "int256"
          },
          {
            "name": "usdDelta",
            "type": "int256",
            "internalType": "int256"
          },
          {
            "name": "entryCumlFundingX96",
            "type": "int256",
            "internalType": "int256"
          },
          {
            "name": "entryADLGrowth",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "makerDetails",
            "type": "tuple",
            "internalType": "struct IPerpManager.MakerDetails",
            "components": [
              {
                "name": "entryTimestamp",
                "type": "uint32",
                "internalType": "uint32"
              },
              {
                "name": "tickLower",
                "type": "int24",
                "internalType": "int24"
              },
              {
                "name": "tickUpper",
                "type": "int24",
                "internalType": "int24"
              },
              {
                "name": "liquidity",
                "type": "uint128",
                "internalType": "uint128"
              },
              {
                "name": "entryCumlFundingBelowX96",
                "type": "int256",
                "internalType": "int256"
              },
              {
                "name": "entryCumlFundingWithinX96",
                "type": "int256",
                "internalType": "int256"
              },
              {
                "name": "entryCumlFundingDivSqrtPWithinX96",
                "type": "int256",
                "internalType": "int256"
              }
            ]
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "increaseCardinalityCap",
    "inputs": [
      {
        "name": "perpId",
        "type": "bytes32",
        "internalType": "PoolId"
      },
      {
        "name": "cardinalityCap",
        "type": "uint16",
        "internalType": "uint16"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "livePositionDetails",
    "inputs": [
      {
        "name": "perpId",
        "type": "bytes32",
        "internalType": "PoolId"
      },
      {
        "name": "posId",
        "type": "uint128",
        "internalType": "uint128"
      }
    ],
    "outputs": [
      {
        "name": "pnl",
        "type": "int256",
        "internalType": "int256"
      },
      {
        "name": "fundingPayment",
        "type": "int256",
        "internalType": "int256"
      },
      {
        "name": "effectiveMargin",
        "type": "int256",
        "internalType": "int256"
      },
      {
        "name": "isLiquidatable",
        "type": "bool",
        "internalType": "bool"
      },
      {
        "name": "newPriceX96",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "openMakerPosition",
    "inputs": [
      {
        "name": "perpId",
        "type": "bytes32",
        "internalType": "PoolId"
      },
      {
        "name": "params",
        "type": "tuple",
        "internalType": "struct IPerpManager.OpenMakerPositionParams",
        "components": [
          {
            "name": "margin",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "liquidity",
            "type": "uint128",
            "internalType": "uint128"
          },
          {
            "name": "tickLower",
            "type": "int24",
            "internalType": "int24"
          },
          {
            "name": "tickUpper",
            "type": "int24",
            "internalType": "int24"
          },
          {
            "name": "maxAmt0In",
            "type": "uint128",
            "internalType": "uint128"
          },
          {
            "name": "maxAmt1In",
            "type": "uint128",
            "internalType": "uint128"
          }
        ]
      }
    ],
    "outputs": [
      {
        "name": "makerPosId",
        "type": "uint128",
        "internalType": "uint128"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "openTakerPosition",
    "inputs": [
      {
        "name": "perpId",
        "type": "bytes32",
        "internalType": "PoolId"
      },
      {
        "name": "params",
        "type": "tuple",
        "internalType": "struct IPerpManager.OpenTakerPositionParams",
        "components": [
          {
            "name": "isLong",
            "type": "bool",
            "internalType": "bool"
          },
          {
            "name": "margin",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "levX96",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "unspecifiedAmountLimit",
            "type": "uint128",
            "internalType": "uint128"
          }
        ]
      }
    ],
    "outputs": [
      {
        "name": "takerPosId",
        "type": "uint128",
        "internalType": "uint128"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "perps",
    "inputs": [
      {
        "name": "",
        "type": "bytes32",
        "internalType": "PoolId"
      }
    ],
    "outputs": [
      {
        "name": "vault",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "beacon",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "creator",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "creationTimestamp",
        "type": "uint32",
        "internalType": "uint32"
      },
      {
        "name": "makerLockupPeriod",
        "type": "uint32",
        "internalType": "uint32"
      },
      {
        "name": "twapWindow",
        "type": "uint32",
        "internalType": "uint32"
      },
      {
        "name": "lastTwPremiumsUpdate",
        "type": "uint32",
        "internalType": "uint32"
      },
      {
        "name": "creatorFee",
        "type": "uint24",
        "internalType": "uint24"
      },
      {
        "name": "insuranceFee",
        "type": "uint24",
        "internalType": "uint24"
      },
      {
        "name": "liquidationFee",
        "type": "uint24",
        "internalType": "uint24"
      },
      {
        "name": "liquidatorFeeSplit",
        "type": "uint24",
        "internalType": "uint24"
      },
      {
        "name": "nextPosId",
        "type": "uint128",
        "internalType": "uint128"
      },
      {
        "name": "sqrtPriceLowerMultiX96",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "sqrtPriceUpperMultiX96",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "minOpeningMargin",
        "type": "uint24",
        "internalType": "uint24"
      },
      {
        "name": "minMakerOpeningMarginRatio",
        "type": "uint24",
        "internalType": "uint24"
      },
      {
        "name": "maxMakerOpeningMarginRatio",
        "type": "uint24",
        "internalType": "uint24"
      },
      {
        "name": "makerLiquidationMarginRatio",
        "type": "uint24",
        "internalType": "uint24"
      },
      {
        "name": "minTakerOpeningMarginRatio",
        "type": "uint24",
        "internalType": "uint24"
      },
      {
        "name": "maxTakerOpeningMarginRatio",
        "type": "uint24",
        "internalType": "uint24"
      },
      {
        "name": "takerLiquidationMarginRatio",
        "type": "uint24",
        "internalType": "uint24"
      },
      {
        "name": "twPremiumX96",
        "type": "int256",
        "internalType": "int256"
      },
      {
        "name": "twPremiumDivBySqrtPriceX96",
        "type": "int256",
        "internalType": "int256"
      },
      {
        "name": "premiumPerSecondX96",
        "type": "int256",
        "internalType": "int256"
      },
      {
        "name": "key",
        "type": "tuple",
        "internalType": "struct PoolKey",
        "components": [
          {
            "name": "currency0",
            "type": "address",
            "internalType": "Currency"
          },
          {
            "name": "currency1",
            "type": "address",
            "internalType": "Currency"
          },
          {
            "name": "fee",
            "type": "uint24",
            "internalType": "uint24"
          },
          {
            "name": "tickSpacing",
            "type": "int24",
            "internalType": "int24"
          },
          {
            "name": "hooks",
            "type": "address",
            "internalType": "contract IHooks"
          }
        ]
      },
      {
        "name": "tradingFeeConfig",
        "type": "tuple",
        "internalType": "struct TradingFee.Config",
        "components": [
          {
            "name": "baseFeeX96",
            "type": "uint128",
            "internalType": "uint128"
          },
          {
            "name": "startFeeX96",
            "type": "uint128",
            "internalType": "uint128"
          },
          {
            "name": "targetFeeX96",
            "type": "uint128",
            "internalType": "uint128"
          },
          {
            "name": "decay",
            "type": "uint128",
            "internalType": "uint128"
          },
          {
            "name": "volatilityScalerX96",
            "type": "uint128",
            "internalType": "uint128"
          },
          {
            "name": "maxFeeMultiplierX96",
            "type": "uint128",
            "internalType": "uint128"
          }
        ]
      },
      {
        "name": "twapState",
        "type": "tuple",
        "internalType": "struct TimeWeightedAvg.State",
        "components": [
          {
            "name": "index",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "cardinality",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "cardinalityNext",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "observations",
            "type": "tuple[65535]",
            "internalType": "struct TimeWeightedAvg.Observation[65535]",
            "components": [
              {
                "name": "blockTimestamp",
                "type": "uint32",
                "internalType": "uint32"
              },
              {
                "name": "cumulativeValue",
                "type": "uint216",
                "internalType": "uint216"
              },
              {
                "name": "initialized",
                "type": "bool",
                "internalType": "bool"
              }
            ]
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "quoteClosePosition",
    "inputs": [
      {
        "name": "perpId",
        "type": "bytes32",
        "internalType": "PoolId"
      },
      {
        "name": "posId",
        "type": "uint128",
        "internalType": "uint128"
      }
    ],
    "outputs": [
      {
        "name": "success",
        "type": "bool",
        "internalType": "bool"
      },
      {
        "name": "quote",
        "type": "tuple",
        "internalType": "struct QuoteReverter.CloseQuote",
        "components": [
          {
            "name": "pnl",
            "type": "int256",
            "internalType": "int256"
          },
          {
            "name": "funding",
            "type": "int256",
            "internalType": "int256"
          },
          {
            "name": "effectiveMargin",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "wasLiquidated",
            "type": "bool",
            "internalType": "bool"
          }
        ]
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "quoteOpenMakerPosition",
    "inputs": [
      {
        "name": "perpId",
        "type": "bytes32",
        "internalType": "PoolId"
      },
      {
        "name": "params",
        "type": "tuple",
        "internalType": "struct IPerpManager.OpenMakerPositionParams",
        "components": [
          {
            "name": "margin",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "liquidity",
            "type": "uint128",
            "internalType": "uint128"
          },
          {
            "name": "tickLower",
            "type": "int24",
            "internalType": "int24"
          },
          {
            "name": "tickUpper",
            "type": "int24",
            "internalType": "int24"
          },
          {
            "name": "maxAmt0In",
            "type": "uint128",
            "internalType": "uint128"
          },
          {
            "name": "maxAmt1In",
            "type": "uint128",
            "internalType": "uint128"
          }
        ]
      }
    ],
    "outputs": [
      {
        "name": "success",
        "type": "bool",
        "internalType": "bool"
      },
      {
        "name": "quote",
        "type": "tuple",
        "internalType": "struct QuoteReverter.OpenQuote",
        "components": [
          {
            "name": "perpDelta",
            "type": "int256",
            "internalType": "int256"
          },
          {
            "name": "usdDelta",
            "type": "int256",
            "internalType": "int256"
          },
          {
            "name": "creatorFee",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "insuranceFee",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "lpFee",
            "type": "uint256",
            "internalType": "uint256"
          }
        ]
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "quoteOpenTakerPosition",
    "inputs": [
      {
        "name": "perpId",
        "type": "bytes32",
        "internalType": "PoolId"
      },
      {
        "name": "params",
        "type": "tuple",
        "internalType": "struct IPerpManager.OpenTakerPositionParams",
        "components": [
          {
            "name": "isLong",
            "type": "bool",
            "internalType": "bool"
          },
          {
            "name": "margin",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "levX96",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "unspecifiedAmountLimit",
            "type": "uint128",
            "internalType": "uint128"
          }
        ]
      }
    ],
    "outputs": [
      {
        "name": "success",
        "type": "bool",
        "internalType": "bool"
      },
      {
        "name": "quote",
        "type": "tuple",
        "internalType": "struct QuoteReverter.OpenQuote",
        "components": [
          {
            "name": "perpDelta",
            "type": "int256",
            "internalType": "int256"
          },
          {
            "name": "usdDelta",
            "type": "int256",
            "internalType": "int256"
          },
          {
            "name": "creatorFee",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "insuranceFee",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "lpFee",
            "type": "uint256",
            "internalType": "uint256"
          }
        ]
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "sqrtPriceX96",
    "inputs": [
      {
        "name": "perpId",
        "type": "bytes32",
        "internalType": "PoolId"
      }
    ],
    "outputs": [
      {
        "name": "sqrtPrice",
        "type": "uint160",
        "internalType": "uint160"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "tickSpacing",
    "inputs": [
      {
        "name": "perpId",
        "type": "bytes32",
        "internalType": "PoolId"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "int24",
        "internalType": "int24"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "timeWeightedAvgSqrtPriceX96",
    "inputs": [
      {
        "name": "perpId",
        "type": "bytes32",
        "internalType": "PoolId"
      },
      {
        "name": "lookbackWindow",
        "type": "uint32",
        "internalType": "uint32"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "tradingBounds",
    "inputs": [
      {
        "name": "perpId",
        "type": "bytes32",
        "internalType": "PoolId"
      }
    ],
    "outputs": [
      {
        "name": "minOpeningMargin",
        "type": "uint24",
        "internalType": "uint24"
      },
      {
        "name": "minMakerMarginRatio",
        "type": "uint24",
        "internalType": "uint24"
      },
      {
        "name": "maxMakerMarginRatio",
        "type": "uint24",
        "internalType": "uint24"
      },
      {
        "name": "makerLiquidationMarginRatio",
        "type": "uint24",
        "internalType": "uint24"
      },
      {
        "name": "minTakerMarginRatio",
        "type": "uint24",
        "internalType": "uint24"
      },
      {
        "name": "maxTakerMarginRatio",
        "type": "uint24",
        "internalType": "uint24"
      },
      {
        "name": "takerLiquidationMarginRatio",
        "type": "uint24",
        "internalType": "uint24"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "unlockCallback",
    "inputs": [
      {
        "name": "data",
        "type": "bytes",
        "internalType": "bytes"
      }
    ],
    "outputs": [
      {
        "name": "encodedDelta",
        "type": "bytes",
        "internalType": "bytes"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "event",
    "name": "MarginAdded",
    "inputs": [
      {
        "name": "perpId",
        "type": "bytes32",
        "indexed": false,
        "internalType": "PoolId"
      },
      {
        "name": "posId",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "newMargin",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "PerpCreated",
    "inputs": [
      {
        "name": "perpId",
        "type": "bytes32",
        "indexed": false,
        "internalType": "PoolId"
      },
      {
        "name": "beacon",
        "type": "address",
        "indexed": false,
        "internalType": "address"
      },
      {
        "name": "startingSqrtPriceX96",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "indexPriceX96",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "PositionClosed",
    "inputs": [
      {
        "name": "perpId",
        "type": "bytes32",
        "indexed": false,
        "internalType": "PoolId"
      },
      {
        "name": "posId",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "holder",
        "type": "address",
        "indexed": false,
        "internalType": "address"
      },
      {
        "name": "wasMaker",
        "type": "bool",
        "indexed": false,
        "internalType": "bool"
      },
      {
        "name": "perpDelta",
        "type": "int256",
        "indexed": false,
        "internalType": "int256"
      },
      {
        "name": "pnl",
        "type": "int256",
        "indexed": false,
        "internalType": "int256"
      },
      {
        "name": "wasLiquidated",
        "type": "bool",
        "indexed": false,
        "internalType": "bool"
      },
      {
        "name": "sqrtPriceX96",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "fundingPremiumPerSecX96",
        "type": "int256",
        "indexed": false,
        "internalType": "int256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "PositionOpened",
    "inputs": [
      {
        "name": "perpId",
        "type": "bytes32",
        "indexed": false,
        "internalType": "PoolId"
      },
      {
        "name": "posId",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "holder",
        "type": "address",
        "indexed": false,
        "internalType": "address"
      },
      {
        "name": "isMaker",
        "type": "bool",
        "indexed": false,
        "internalType": "bool"
      },
      {
        "name": "perpDelta",
        "type": "int256",
        "indexed": false,
        "internalType": "int256"
      },
      {
        "name": "sqrtPriceX96",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "fundingPremiumPerSecX96",
        "type": "int256",
        "indexed": false,
        "internalType": "int256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "error",
    "name": "InvalidAction",
    "inputs": [
      {
        "name": "action",
        "type": "uint8",
        "internalType": "uint8"
      }
    ]
  },
  {
    "type": "error",
    "name": "InvalidCaller",
    "inputs": [
      {
        "name": "caller",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "expectedCaller",
        "type": "address",
        "internalType": "address"
      }
    ]
  },
  {
    "type": "error",
    "name": "InvalidClose",
    "inputs": [
      {
        "name": "caller",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "holder",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "isLiquidated",
        "type": "bool",
        "internalType": "bool"
      }
    ]
  },
  {
    "type": "error",
    "name": "InvalidLiquidity",
    "inputs": [
      {
        "name": "liquidity",
        "type": "uint128",
        "internalType": "uint128"
      }
    ]
  },
  {
    "type": "error",
    "name": "InvalidMargin",
    "inputs": [
      {
        "name": "margin",
        "type": "uint256",
        "internalType": "uint256"
      }
    ]
  },
  {
    "type": "error",
    "name": "MakerPositionLocked",
    "inputs": [
      {
        "name": "currentTimestamp",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "lockupPeriodEnd",
        "type": "uint256",
        "internalType": "uint256"
      }
    ]
  },
  {
    "type": "error",
    "name": "MaximumAmountExceeded",
    "inputs": [
      {
        "name": "maximumAmount",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "amountRequested",
        "type": "uint256",
        "internalType": "uint256"
      }
    ]
  },
  {
    "type": "error",
    "name": "MinimumAmountInsufficient",
    "inputs": [
      {
        "name": "minimumAmount",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "amountReceived",
        "type": "uint256",
        "internalType": "uint256"
      }
    ]
  },
  {
    "type": "error",
    "name": "NotPoolManager",
    "inputs": []
  },
  {
    "type": "error",
    "name": "ZeroSizePosition",
    "inputs": [
      {
        "name": "perpDelta",
        "type": "int256",
        "internalType": "int256"
      },
      {
        "name": "usdDelta",
        "type": "int256",
        "internalType": "int256"
      }
    ]
  }
] as const;
