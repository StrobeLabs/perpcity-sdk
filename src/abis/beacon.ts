export const BEACON_ABI = 
[
    {
        "inputs": [
            {
                "internalType": "contract IVerifierWrapper",
                "name": "verifierWrapper",
                "type": "address"
            },
            {
                "internalType": "uint256",
                "name": "initialData",
                "type": "uint256"
            },
            {
                "internalType": "uint32",
                "name": "initialCardinalityNext",
                "type": "uint32"
            }
        ],
        "stateMutability": "nonpayable",
        "type": "constructor"
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
                "name": "publicSignals",
                "type": "bytes"
            }
        ],
        "name": "InvalidProof",
        "type": "error"
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
                "name": "publicSignals",
                "type": "bytes"
            }
        ],
        "name": "ProofAlreadyUsed",
        "type": "error"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "data",
                "type": "uint256"
            }
        ],
        "name": "DataUpdated",
        "type": "event"
    },
    {
        "inputs": [],
        "name": "MAX_DATA",
        "outputs": [
            {
                "internalType": "int256",
                "name": "",
                "type": "int256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "MIN_DATA",
        "outputs": [
            {
                "internalType": "int256",
                "name": "",
                "type": "int256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "VERIFIER_WRAPPER",
        "outputs": [
            {
                "internalType": "contract IVerifierWrapper",
                "name": "",
                "type": "address"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "data",
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
        "name": "getData",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            },
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
                "internalType": "uint32",
                "name": "twapSecondsAgo",
                "type": "uint32"
            }
        ],
        "name": "getTwap",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "twapPrice",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint32",
                "name": "cardinalityNext",
                "type": "uint32"
            }
        ],
        "name": "increaseCardinalityNext",
        "outputs": [
            {
                "internalType": "uint32",
                "name": "cardinalityNextOld",
                "type": "uint32"
            },
            {
                "internalType": "uint32",
                "name": "cardinalityNextNew",
                "type": "uint32"
            }
        ],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "timestamp",
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
        "name": "twapState",
        "outputs": [
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
                "name": "publicSignals",
                "type": "bytes"
            }
        ],
        "name": "updateData",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "bytes",
                "name": "",
                "type": "bytes"
            }
        ],
        "name": "usedProofs",
        "outputs": [
            {
                "internalType": "bool",
                "name": "",
                "type": "bool"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    }
] as const;
