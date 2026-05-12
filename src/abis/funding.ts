export const FUNDING_ABI = [
  {
    type: "function",
    name: "funding",
    inputs: [
      {
        name: "",
        type: "tuple",
        internalType: "struct PricePair",
        components: [
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
      },
      {
        name: "emas",
        type: "tuple",
        internalType: "struct PricePair",
        components: [
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
      },
    ],
    outputs: [
      {
        name: "",
        type: "int88",
        internalType: "int88",
      },
    ],
    stateMutability: "pure",
  },
] as const;
