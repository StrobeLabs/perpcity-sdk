export const PERP_ABI = [
  {
    type: "constructor",
    inputs: [
      {
        name: "protocolFeeManager",
        type: "address",
        internalType: "contract IProtocolFeeManager",
      },
      {
        name: "owner",
        type: "address",
        internalType: "address",
      },
      {
        name: "_name",
        type: "string",
        internalType: "string",
      },
      {
        name: "_symbol",
        type: "string",
        internalType: "string",
      },
      {
        name: "_tokenUri",
        type: "string",
        internalType: "string",
      },
      {
        name: "_modules",
        type: "tuple",
        internalType: "struct Modules",
        components: [
          {
            name: "beacon",
            type: "address",
            internalType: "contract IBeacon",
          },
          {
            name: "fees",
            type: "address",
            internalType: "contract IFees",
          },
          {
            name: "funding",
            type: "address",
            internalType: "contract IFunding",
          },
          {
            name: "marginRatios",
            type: "address",
            internalType: "contract IMarginRatios",
          },
          {
            name: "priceImpact",
            type: "address",
            internalType: "contract IPriceImpact",
          },
          {
            name: "pricing",
            type: "address",
            internalType: "contract IPricing",
          },
        ],
      },
      {
        name: "_poolKey",
        type: "tuple",
        internalType: "struct PoolKey",
        components: [
          {
            name: "currency0",
            type: "address",
            internalType: "Currency",
          },
          {
            name: "currency1",
            type: "address",
            internalType: "Currency",
          },
          {
            name: "fee",
            type: "uint24",
            internalType: "uint24",
          },
          {
            name: "tickSpacing",
            type: "int24",
            internalType: "int24",
          },
          {
            name: "hooks",
            type: "address",
            internalType: "contract IHooks",
          },
        ],
      },
      {
        name: "emaWindow",
        type: "uint24",
        internalType: "uint24",
      },
      {
        name: "index",
        type: "uint128",
        internalType: "uint128",
      },
    ],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "CURRENCY_0",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "address",
        internalType: "Currency",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "CURRENCY_1",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "address",
        internalType: "Currency",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "EMA_WINDOW",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "POOL_ID",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "bytes32",
        internalType: "PoolId",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "PROTOCOL_FEE_MANAGER",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "address",
        internalType: "contract IProtocolFeeManager",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "abdicate",
    inputs: [
      {
        name: "selector",
        type: "bytes4",
        internalType: "bytes4",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "abdicated",
    inputs: [
      {
        name: "",
        type: "bytes4",
        internalType: "bytes4",
      },
    ],
    outputs: [
      {
        name: "",
        type: "bool",
        internalType: "bool",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "adjustMaker",
    inputs: [
      {
        name: "params",
        type: "tuple",
        internalType: "struct AdjustMakerParams",
        components: [
          {
            name: "posId",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "marginDelta",
            type: "int128",
            internalType: "int128",
          },
          {
            name: "liquidityDelta",
            type: "int128",
            internalType: "int128",
          },
          {
            name: "amt0Limit",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "amt1Limit",
            type: "uint256",
            internalType: "uint256",
          },
        ],
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "adjustTaker",
    inputs: [
      {
        name: "params",
        type: "tuple",
        internalType: "struct AdjustTakerParams",
        components: [
          {
            name: "posId",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "marginDelta",
            type: "int128",
            internalType: "int128",
          },
          {
            name: "perpDelta",
            type: "int256",
            internalType: "int256",
          },
          {
            name: "amt1Limit",
            type: "uint256",
            internalType: "uint256",
          },
        ],
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "approve",
    inputs: [
      {
        name: "account",
        type: "address",
        internalType: "address",
      },
      {
        name: "id",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "backstopMaker",
    inputs: [
      {
        name: "posId",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "marginIn",
        type: "uint128",
        internalType: "uint128",
      },
      {
        name: "positionRecipient",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "backstopTaker",
    inputs: [
      {
        name: "posId",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "marginIn",
        type: "uint128",
        internalType: "uint128",
      },
      {
        name: "positionRecipient",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "balanceOf",
    inputs: [
      {
        name: "owner",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [
      {
        name: "result",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "cancelOwnershipHandover",
    inputs: [],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "capacity",
    inputs: [],
    outputs: [
      {
        name: "long",
        type: "uint128",
        internalType: "uint128",
      },
      {
        name: "short",
        type: "uint128",
        internalType: "uint128",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "collectCreatorFees",
    inputs: [
      {
        name: "recipient",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "collectProtocolFees",
    inputs: [
      {
        name: "recipient",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "completeOwnershipHandover",
    inputs: [
      {
        name: "pendingOwner",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "cumulatives",
    inputs: [],
    outputs: [
      {
        name: "fundingX96",
        type: "int256",
        internalType: "int256",
      },
      {
        name: "fundingDivSqrtPX96",
        type: "int256",
        internalType: "int256",
      },
      {
        name: "longUtilPaymentsX96",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "shortUtilPaymentsX96",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "longUtilEarningsX96",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "shortUtilEarningsX96",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "donate",
    inputs: [
      {
        name: "amount",
        type: "uint128",
        internalType: "uint128",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "emas",
    inputs: [],
    outputs: [
      {
        name: "ammPrice",
        type: "uint128",
        internalType: "uint128",
      },
      {
        name: "index",
        type: "uint128",
        internalType: "uint128",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "executableAt",
    inputs: [
      {
        name: "",
        type: "bytes",
        internalType: "bytes",
      },
    ],
    outputs: [
      {
        name: "",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "feeFund",
    inputs: [],
    outputs: [
      {
        name: "insurance",
        type: "uint80",
        internalType: "uint80",
      },
      {
        name: "creatorFees",
        type: "uint80",
        internalType: "uint80",
      },
      {
        name: "protocolFees",
        type: "uint80",
        internalType: "uint80",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getApproved",
    inputs: [
      {
        name: "id",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    outputs: [
      {
        name: "result",
        type: "address",
        internalType: "address",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "isApprovedForAll",
    inputs: [
      {
        name: "owner",
        type: "address",
        internalType: "address",
      },
      {
        name: "operator",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [
      {
        name: "result",
        type: "bool",
        internalType: "bool",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "liquidateMaker",
    inputs: [
      {
        name: "posId",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "liquidationFeeRecipient",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "liquidateTaker",
    inputs: [
      {
        name: "posId",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "liquidationFeeRecipient",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "makerDetails",
    inputs: [
      {
        name: "posId",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    outputs: [
      {
        name: "tickLower",
        type: "int24",
        internalType: "int24",
      },
      {
        name: "tickUpper",
        type: "int24",
        internalType: "int24",
      },
      {
        name: "liquidity",
        type: "uint128",
        internalType: "uint128",
      },
      {
        name: "lastLongUtilEarningsX96",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "lastShortUtilEarningsX96",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "capacity_",
        type: "tuple",
        internalType: "struct Capacity",
        components: [
          {
            name: "long",
            type: "uint128",
            internalType: "uint128",
          },
          {
            name: "short",
            type: "uint128",
            internalType: "uint128",
          },
        ],
      },
      {
        name: "lastCumlFunding",
        type: "tuple",
        internalType: "struct MakerFunding",
        components: [
          {
            name: "belowX96",
            type: "int256",
            internalType: "int256",
          },
          {
            name: "withinX96",
            type: "int256",
            internalType: "int256",
          },
          {
            name: "divSqrtPriceWithinX96",
            type: "int256",
            internalType: "int256",
          },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "modules",
    inputs: [],
    outputs: [
      {
        name: "beacon",
        type: "address",
        internalType: "contract IBeacon",
      },
      {
        name: "fees",
        type: "address",
        internalType: "contract IFees",
      },
      {
        name: "funding",
        type: "address",
        internalType: "contract IFunding",
      },
      {
        name: "marginRatios",
        type: "address",
        internalType: "contract IMarginRatios",
      },
      {
        name: "priceImpact",
        type: "address",
        internalType: "contract IPriceImpact",
      },
      {
        name: "pricing",
        type: "address",
        internalType: "contract IPricing",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "name",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "string",
        internalType: "string",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "nextPosId",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "openInterest",
    inputs: [],
    outputs: [
      {
        name: "long",
        type: "uint128",
        internalType: "uint128",
      },
      {
        name: "short",
        type: "uint128",
        internalType: "uint128",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "openMaker",
    inputs: [
      {
        name: "params",
        type: "tuple",
        internalType: "struct OpenMakerParams",
        components: [
          {
            name: "holder",
            type: "address",
            internalType: "address",
          },
          {
            name: "margin",
            type: "uint128",
            internalType: "uint128",
          },
          {
            name: "tickLower",
            type: "int24",
            internalType: "int24",
          },
          {
            name: "tickUpper",
            type: "int24",
            internalType: "int24",
          },
          {
            name: "liquidity",
            type: "uint128",
            internalType: "uint128",
          },
          {
            name: "maxAmt0In",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "maxAmt1In",
            type: "uint256",
            internalType: "uint256",
          },
        ],
      },
    ],
    outputs: [
      {
        name: "posId",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "openTaker",
    inputs: [
      {
        name: "params",
        type: "tuple",
        internalType: "struct OpenTakerParams",
        components: [
          {
            name: "holder",
            type: "address",
            internalType: "address",
          },
          {
            name: "margin",
            type: "uint128",
            internalType: "uint128",
          },
          {
            name: "perpDelta",
            type: "int256",
            internalType: "int256",
          },
          {
            name: "amt1Limit",
            type: "uint256",
            internalType: "uint256",
          },
        ],
      },
    ],
    outputs: [
      {
        name: "posId",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "owner",
    inputs: [],
    outputs: [
      {
        name: "result",
        type: "address",
        internalType: "address",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "ownerOf",
    inputs: [
      {
        name: "id",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    outputs: [
      {
        name: "result",
        type: "address",
        internalType: "address",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "ownershipHandoverExpiresAt",
    inputs: [
      {
        name: "pendingOwner",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [
      {
        name: "result",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "poolKey",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "tuple",
        internalType: "struct PoolKey",
        components: [
          {
            name: "currency0",
            type: "address",
            internalType: "Currency",
          },
          {
            name: "currency1",
            type: "address",
            internalType: "Currency",
          },
          {
            name: "fee",
            type: "uint24",
            internalType: "uint24",
          },
          {
            name: "tickSpacing",
            type: "int24",
            internalType: "int24",
          },
          {
            name: "hooks",
            type: "address",
            internalType: "contract IHooks",
          },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "poolState",
    inputs: [],
    outputs: [
      {
        name: "tick",
        type: "int24",
        internalType: "int24",
      },
      {
        name: "sqrtPriceX96",
        type: "uint160",
        internalType: "uint160",
      },
      {
        name: "ammPriceX96",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "liquidity",
        type: "uint128",
        internalType: "uint128",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "positions",
    inputs: [
      {
        name: "posId",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    outputs: [
      {
        name: "delta",
        type: "int256",
        internalType: "BalanceDelta",
      },
      {
        name: "margin",
        type: "uint128",
        internalType: "uint128",
      },
      {
        name: "liqMarginRatio",
        type: "uint24",
        internalType: "uint24",
      },
      {
        name: "backstopMarginRatio",
        type: "uint24",
        internalType: "uint24",
      },
      {
        name: "lastCumlFundingX96",
        type: "int256",
        internalType: "int256",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "protocolFee",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "rates",
    inputs: [],
    outputs: [
      {
        name: "fundingPerDay",
        type: "int88",
        internalType: "int88",
      },
      {
        name: "longUtilFeePerDay",
        type: "uint64",
        internalType: "uint64",
      },
      {
        name: "shortUtilFeePerDay",
        type: "uint64",
        internalType: "uint64",
      },
      {
        name: "lastTouch",
        type: "uint40",
        internalType: "uint40",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "renounceOwnership",
    inputs: [],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "requestOwnershipHandover",
    inputs: [],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "revoke",
    inputs: [
      {
        name: "data",
        type: "bytes",
        internalType: "bytes",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "safeTransferFrom",
    inputs: [
      {
        name: "from",
        type: "address",
        internalType: "address",
      },
      {
        name: "to",
        type: "address",
        internalType: "address",
      },
      {
        name: "id",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "safeTransferFrom",
    inputs: [
      {
        name: "from",
        type: "address",
        internalType: "address",
      },
      {
        name: "to",
        type: "address",
        internalType: "address",
      },
      {
        name: "id",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "data",
        type: "bytes",
        internalType: "bytes",
      },
    ],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "setApprovalForAll",
    inputs: [
      {
        name: "operator",
        type: "address",
        internalType: "address",
      },
      {
        name: "isApproved",
        type: "bool",
        internalType: "bool",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "setBeacon",
    inputs: [
      {
        name: "newBeacon",
        type: "address",
        internalType: "contract IBeacon",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "setFeesModule",
    inputs: [
      {
        name: "newFees",
        type: "address",
        internalType: "contract IFees",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "setFundingModule",
    inputs: [
      {
        name: "newFunding",
        type: "address",
        internalType: "contract IFunding",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "setMarginRatiosModule",
    inputs: [
      {
        name: "newMarginRatios",
        type: "address",
        internalType: "contract IMarginRatios",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "setName",
    inputs: [
      {
        name: "newName",
        type: "string",
        internalType: "string",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "setPriceImpactModule",
    inputs: [
      {
        name: "newPriceImpact",
        type: "address",
        internalType: "contract IPriceImpact",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "setPricingModule",
    inputs: [
      {
        name: "newPricing",
        type: "address",
        internalType: "contract IPricing",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "setSymbol",
    inputs: [
      {
        name: "newSymbol",
        type: "string",
        internalType: "string",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "setTimelock",
    inputs: [
      {
        name: "newTimelock",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "setTokenURI",
    inputs: [
      {
        name: "newTokenUri",
        type: "string",
        internalType: "string",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "solvencyState",
    inputs: [],
    outputs: [
      {
        name: "badDebt",
        type: "uint128",
        internalType: "uint128",
      },
      {
        name: "totalMargin",
        type: "uint128",
        internalType: "uint128",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "submit",
    inputs: [
      {
        name: "data",
        type: "bytes",
        internalType: "bytes",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "supportsInterface",
    inputs: [
      {
        name: "interfaceId",
        type: "bytes4",
        internalType: "bytes4",
      },
    ],
    outputs: [
      {
        name: "result",
        type: "bool",
        internalType: "bool",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "symbol",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "string",
        internalType: "string",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "syncProtocolFee",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "takerDetails",
    inputs: [
      {
        name: "posId",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    outputs: [
      {
        name: "lastLongUtilPaymentsX96",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "lastShortUtilPaymentsX96",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "timelock",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "tokenURI",
    inputs: [
      {
        name: "",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    outputs: [
      {
        name: "",
        type: "string",
        internalType: "string",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "touch",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "transferFrom",
    inputs: [
      {
        name: "from",
        type: "address",
        internalType: "address",
      },
      {
        name: "to",
        type: "address",
        internalType: "address",
      },
      {
        name: "id",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "transferOwnership",
    inputs: [
      {
        name: "newOwner",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "unlockCallback",
    inputs: [
      {
        name: "data",
        type: "bytes",
        internalType: "bytes",
      },
    ],
    outputs: [
      {
        name: "encodedDelta",
        type: "bytes",
        internalType: "bytes",
      },
    ],
    stateMutability: "nonpayable",
  },
  {
    type: "event",
    name: "Abdicate",
    inputs: [
      {
        name: "selector",
        type: "bytes4",
        indexed: true,
        internalType: "bytes4",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "Accept",
    inputs: [
      {
        name: "selector",
        type: "bytes4",
        indexed: true,
        internalType: "bytes4",
      },
      {
        name: "data",
        type: "bytes",
        indexed: false,
        internalType: "bytes",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "Approval",
    inputs: [
      {
        name: "owner",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "account",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "id",
        type: "uint256",
        indexed: true,
        internalType: "uint256",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "ApprovalForAll",
    inputs: [
      {
        name: "owner",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "operator",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "isApproved",
        type: "bool",
        indexed: false,
        internalType: "bool",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "CreatorFeesCollected",
    inputs: [
      {
        name: "amount",
        type: "uint256",
        indexed: false,
        internalType: "uint256",
      },
      {
        name: "recipient",
        type: "address",
        indexed: false,
        internalType: "address",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "OwnershipHandoverCanceled",
    inputs: [
      {
        name: "pendingOwner",
        type: "address",
        indexed: true,
        internalType: "address",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "OwnershipHandoverRequested",
    inputs: [
      {
        name: "pendingOwner",
        type: "address",
        indexed: true,
        internalType: "address",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "OwnershipTransferred",
    inputs: [
      {
        name: "oldOwner",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "newOwner",
        type: "address",
        indexed: true,
        internalType: "address",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "ProtocolFeeSynced",
    inputs: [
      {
        name: "protocolFee",
        type: "uint256",
        indexed: false,
        internalType: "uint256",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "ProtocolFeesCollected",
    inputs: [
      {
        name: "amount",
        type: "uint256",
        indexed: false,
        internalType: "uint256",
      },
      {
        name: "recipient",
        type: "address",
        indexed: false,
        internalType: "address",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "Revoke",
    inputs: [
      {
        name: "caller",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "selector",
        type: "bytes4",
        indexed: true,
        internalType: "bytes4",
      },
      {
        name: "data",
        type: "bytes",
        indexed: false,
        internalType: "bytes",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "SetBeacon",
    inputs: [
      {
        name: "beacon",
        type: "address",
        indexed: true,
        internalType: "address",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "SetFeesModule",
    inputs: [
      {
        name: "fees",
        type: "address",
        indexed: true,
        internalType: "address",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "SetFundingModule",
    inputs: [
      {
        name: "funding",
        type: "address",
        indexed: true,
        internalType: "address",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "SetMarginRatiosModule",
    inputs: [
      {
        name: "marginRatios",
        type: "address",
        indexed: true,
        internalType: "address",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "SetName",
    inputs: [
      {
        name: "name",
        type: "string",
        indexed: false,
        internalType: "string",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "SetPriceImpactModule",
    inputs: [
      {
        name: "priceImpact",
        type: "address",
        indexed: true,
        internalType: "address",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "SetPricingModule",
    inputs: [
      {
        name: "pricing",
        type: "address",
        indexed: true,
        internalType: "address",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "SetSymbol",
    inputs: [
      {
        name: "symbol",
        type: "string",
        indexed: false,
        internalType: "string",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "SetTimelock",
    inputs: [
      {
        name: "timelock",
        type: "uint256",
        indexed: false,
        internalType: "uint256",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "SetTokenURI",
    inputs: [
      {
        name: "tokenUri",
        type: "string",
        indexed: false,
        internalType: "string",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "Submit",
    inputs: [
      {
        name: "selector",
        type: "bytes4",
        indexed: true,
        internalType: "bytes4",
      },
      {
        name: "data",
        type: "bytes",
        indexed: false,
        internalType: "bytes",
      },
      {
        name: "executableAt",
        type: "uint256",
        indexed: false,
        internalType: "uint256",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "Transfer",
    inputs: [
      {
        name: "from",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "to",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "id",
        type: "uint256",
        indexed: true,
        internalType: "uint256",
      },
    ],
    anonymous: false,
  },
  {
    type: "error",
    name: "Abdicated",
    inputs: [],
  },
  {
    type: "error",
    name: "AccountBalanceOverflow",
    inputs: [],
  },
  {
    type: "error",
    name: "AlreadyInitialized",
    inputs: [],
  },
  {
    type: "error",
    name: "BalanceQueryForZeroAddress",
    inputs: [],
  },
  {
    type: "error",
    name: "DataAlreadyPending",
    inputs: [],
  },
  {
    type: "error",
    name: "DataNotTimelocked",
    inputs: [],
  },
  {
    type: "error",
    name: "NewOwnerIsZeroAddress",
    inputs: [],
  },
  {
    type: "error",
    name: "NoHandoverRequest",
    inputs: [],
  },
  {
    type: "error",
    name: "NonMakerPosition",
    inputs: [],
  },
  {
    type: "error",
    name: "NonTakerPosition",
    inputs: [],
  },
  {
    type: "error",
    name: "NotOwnerNorApproved",
    inputs: [],
  },
  {
    type: "error",
    name: "NotPoolManager",
    inputs: [],
  },
  {
    type: "error",
    name: "PositionDoesNotExist",
    inputs: [],
  },
  {
    type: "error",
    name: "TimelockNotExpired",
    inputs: [],
  },
  {
    type: "error",
    name: "TokenAlreadyExists",
    inputs: [],
  },
  {
    type: "error",
    name: "TokenDoesNotExist",
    inputs: [],
  },
  {
    type: "error",
    name: "TransferFromIncorrectOwner",
    inputs: [],
  },
  {
    type: "error",
    name: "TransferToNonERC721ReceiverImplementer",
    inputs: [],
  },
  {
    type: "error",
    name: "TransferToZeroAddress",
    inputs: [],
  },
  {
    type: "error",
    name: "Unauthorized",
    inputs: [],
  },
  {
    type: "error",
    name: "UnauthorizedCaller",
    inputs: [],
  },
] as const;
