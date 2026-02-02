export const BEACON_ABI = [
  {
      "inputs": [
          {
              "internalType": "address",
              "name": "owner",
              "type": "address"
          },
          {
              "internalType": "contract IVerifierAdapter",
              "name": "adapter",
              "type": "address"
          },
          {
              "internalType": "contract IIndexEngine",
              "name": "engine",
              "type": "address"
          },
          {
              "internalType": "uint256",
              "name": "initialIndex",
              "type": "uint256"
          }
      ],
      "stateMutability": "nonpayable",
      "type": "constructor"
  },
  {
      "inputs": [],
      "name": "AlreadyInitialized",
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
      "name": "Unauthorized",
      "type": "error"
  },
  {
      "anonymous": false,
      "inputs": [
          {
              "indexed": false,
              "internalType": "uint256",
              "name": "index",
              "type": "uint256"
          }
      ],
      "name": "IndexUpdated",
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
      "inputs": [],
      "name": "cancelOwnershipHandover",
      "outputs": [],
      "stateMutability": "payable",
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
              "internalType": "uint16",
              "name": "newCap",
              "type": "uint16"
          }
      ],
      "name": "increaseCardinalityCap",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
  },
  {
      "inputs": [],
      "name": "index",
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
      "inputs": [],
      "name": "indexEngine",
      "outputs": [
          {
              "internalType": "contract IIndexEngine",
              "name": "",
              "type": "address"
          }
      ],
      "stateMutability": "view",
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
              "internalType": "contract IIndexEngine",
              "name": "newIndexEngine",
              "type": "address"
          }
      ],
      "name": "setIndexEngine",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
  },
  {
      "inputs": [
          {
              "internalType": "contract IVerifierAdapter",
              "name": "newVerifierAdapter",
              "type": "address"
          }
      ],
      "name": "setVerifierAdapter",
      "outputs": [],
      "stateMutability": "nonpayable",
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
              "internalType": "uint32",
              "name": "secondsAgo",
              "type": "uint32"
          }
      ],
      "name": "twAvg",
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
      "inputs": [],
      "name": "twAvgState",
      "outputs": [
          {
              "internalType": "uint16",
              "name": "index",
              "type": "uint16"
          },
          {
              "internalType": "uint16",
              "name": "cardinality",
              "type": "uint16"
          },
          {
              "internalType": "uint16",
              "name": "cardinalityCap",
              "type": "uint16"
          }
      ],
      "stateMutability": "view",
      "type": "function"
  },
  {
      "inputs": [
          {
              "internalType": "bytes",
              "name": "proof",
              "type": "bytes"
          },
          {
              "internalType": "bytes",
              "name": "inputs",
              "type": "bytes"
          }
      ],
      "name": "updateIndex",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
  },
  {
      "inputs": [],
      "name": "verifierAdapter",
      "outputs": [
          {
              "internalType": "contract IVerifierAdapter",
              "name": "",
              "type": "address"
          }
      ],
      "stateMutability": "view",
      "type": "function"
  }
] as const;