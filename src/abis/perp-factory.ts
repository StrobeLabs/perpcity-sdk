export const PERP_FACTORY_ABI = [
  {
    type: "constructor",
    inputs: [
      {
        name: "accountingTokenImplementation",
        type: "address",
        internalType: "address",
      },
      {
        name: "protocolFeeManager",
        type: "address",
        internalType: "contract IProtocolFeeManager",
      },
    ],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "ACCOUNTING_TOKEN_IMPLEMENTATION",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "address",
        internalType: "address",
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
    name: "createPerp",
    inputs: [
      {
        name: "owner",
        type: "address",
        internalType: "address",
      },
      {
        name: "name",
        type: "string",
        internalType: "string",
      },
      {
        name: "symbol",
        type: "string",
        internalType: "string",
      },
      {
        name: "tokenUri",
        type: "string",
        internalType: "string",
      },
      {
        name: "modules",
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
        name: "emaWindow",
        type: "uint24",
        internalType: "uint24",
      },
      {
        name: "salt",
        type: "bytes32",
        internalType: "bytes32",
      },
    ],
    outputs: [
      {
        name: "perp",
        type: "address",
        internalType: "address",
      },
    ],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "perps",
    inputs: [
      {
        name: "",
        type: "address",
        internalType: "address",
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
        name: "",
        type: "bytes",
        internalType: "bytes",
      },
    ],
    stateMutability: "nonpayable",
  },
  {
    type: "event",
    name: "PerpCreated",
    inputs: [
      {
        name: "perp",
        type: "address",
        indexed: false,
        internalType: "address",
      },
      {
        name: "poolId",
        type: "bytes32",
        indexed: false,
        internalType: "PoolId",
      },
      {
        name: "modules",
        type: "tuple",
        indexed: false,
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
        name: "initialIndex",
        type: "uint256",
        indexed: false,
        internalType: "uint256",
      },
      {
        name: "emaWindow",
        type: "uint24",
        indexed: false,
        internalType: "uint24",
      },
      {
        name: "protocolFee",
        type: "uint256",
        indexed: false,
        internalType: "uint256",
      },
      {
        name: "sqrtPriceX96",
        type: "uint160",
        indexed: false,
        internalType: "uint160",
      },
      {
        name: "tick",
        type: "int24",
        indexed: false,
        internalType: "int24",
      },
      {
        name: "owner",
        type: "address",
        indexed: false,
        internalType: "address",
      },
      {
        name: "name",
        type: "string",
        indexed: false,
        internalType: "string",
      },
      {
        name: "symbol",
        type: "string",
        indexed: false,
        internalType: "string",
      },
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
    type: "error",
    name: "EmaWindowTooLow",
    inputs: [],
  },
  {
    type: "error",
    name: "NotPoolManager",
    inputs: [],
  },
  {
    type: "error",
    name: "StartingPriceTooHigh",
    inputs: [],
  },
  {
    type: "error",
    name: "StartingPriceTooLow",
    inputs: [],
  },
] as const;
