/**
 * Anvil (local EVM) test infrastructure for integration tests.
 * Deploys mock Solidity contracts and provides a fully configured PerpCityContext.
 */

import { type ChildProcess, spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  type Address,
  createPublicClient,
  createWalletClient,
  defineChain,
  getAddress,
  type Hex,
  http,
  keccak256,
  type PublicClient,
  toHex,
  type WalletClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { PerpCityContext } from "../../context";

// Anvil default account 0
const ANVIL_PRIVATE_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as const;
const ANVIL_ACCOUNT_ADDRESS = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" as const;

// sqrtPriceX96 for price = 1.0 (= 2^96)
const SQRT_PRICE_X96_ONE = 79228162514264337593543950336n;

// Test perp ID
const TEST_PERP_ID = keccak256(toHex("test-perp"));

export interface AnvilSetup {
  rpcUrl: string;
  cleanup: () => void;
  addresses: {
    perpManager: Address;
    usdc: Address;
    fees: Address;
    marginRatios: Address;
  };
  testPerpId: Hex;
  account: Address;
  walletClient: WalletClient;
  publicClient: PublicClient;
  context: PerpCityContext;
}

/**
 * Load compiled bytecode from a Forge artifact.
 */
function loadArtifact(contractName: string): {
  abi: any[];
  bytecode: `0x${string}`;
} {
  const artifactPath = join(
    __dirname,
    "../../../tests/contracts/out",
    `${contractName}.sol`,
    `${contractName}.json`
  );
  const artifact = JSON.parse(readFileSync(artifactPath, "utf-8"));
  return {
    abi: artifact.abi,
    bytecode: artifact.bytecode.object as `0x${string}`,
  };
}

/**
 * Start Anvil as a child process and wait for it to be ready.
 * Uses a fixed port (8546) to avoid conflicts with other services.
 */
function startAnvil(port: number): Promise<{ process: ChildProcess; rpcUrl: string }> {
  return new Promise((resolve, reject) => {
    const anvilProcess = spawn(
      "anvil",
      ["--chain-id", "31337", "--block-time", "1", "--port", String(port)],
      {
        stdio: ["ignore", "pipe", "pipe"],
      }
    );

    let resolved = false;

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        anvilProcess.kill();
        reject(new Error("Anvil failed to start within 10 seconds"));
      }
    }, 10000);

    anvilProcess.stdout?.on("data", (data: Buffer) => {
      const output = data.toString();
      if (!resolved && output.includes("Listening on")) {
        resolved = true;
        clearTimeout(timeout);
        resolve({
          process: anvilProcess,
          rpcUrl: `http://127.0.0.1:${port}`,
        });
      }
    });

    anvilProcess.stderr?.on("data", (data: Buffer) => {
      const output = data.toString();
      // Anvil sometimes prints info to stderr
      if (!resolved && output.includes("Listening on")) {
        resolved = true;
        clearTimeout(timeout);
        resolve({
          process: anvilProcess,
          rpcUrl: `http://127.0.0.1:${port}`,
        });
      }
    });

    anvilProcess.on("error", (err) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        reject(new Error(`Failed to start Anvil: ${err.message}`));
      }
    });

    anvilProcess.on("exit", (code) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        reject(new Error(`Anvil exited with code ${code}`));
      }
    });
  });
}

/**
 * Deploy a contract and return its address.
 */
async function deployContract(
  walletClient: WalletClient,
  publicClient: PublicClient,
  abi: any[],
  bytecode: `0x${string}`,
  args: any[] = []
): Promise<Address> {
  const hash = await walletClient.deployContract({
    abi,
    bytecode,
    args,
    account: privateKeyToAccount(ANVIL_PRIVATE_KEY),
    chain: walletClient.chain!,
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (!receipt.contractAddress) {
    throw new Error(`Contract deployment failed. Tx hash: ${hash}`);
  }
  return getAddress(receipt.contractAddress);
}

/**
 * Start Anvil, deploy all mock contracts, configure state, and return
 * everything needed for integration tests.
 */
export async function setupAnvil(): Promise<AnvilSetup> {
  // Start Anvil
  const port = 8546;
  const { process: anvilProcess, rpcUrl } = await startAnvil(port);

  // Define the Anvil chain
  const anvilChain = defineChain({
    id: 31337,
    name: "Anvil",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] } },
  });

  // Create clients
  const account = privateKeyToAccount(ANVIL_PRIVATE_KEY);
  const walletClient = createWalletClient({
    account,
    chain: anvilChain,
    transport: http(rpcUrl),
  });
  const publicClient = createPublicClient({
    chain: anvilChain,
    transport: http(rpcUrl),
  });

  // Load artifacts
  const feesArtifact = loadArtifact("MockFees");
  const marginRatiosArtifact = loadArtifact("MockMarginRatios");
  const usdcArtifact = loadArtifact("MockUSDC");
  const perpManagerArtifact = loadArtifact("MockPerpManager");

  // Deploy contracts
  // 1. MockFees: (creatorFee=1000, insuranceFee=500, lpFee=2000, liquidationFee=5000)
  const feesAddress = await deployContract(
    walletClient,
    publicClient,
    feesArtifact.abi,
    feesArtifact.bytecode,
    [1000, 500, 2000, 5000]
  );

  // 2. MockMarginRatios: (minTaker=100000, maxTaker=500000, liqTaker=50000, minMaker=100000, maxMaker=500000, liqMaker=50000)
  const marginRatiosAddress = await deployContract(
    walletClient,
    publicClient,
    marginRatiosArtifact.abi,
    marginRatiosArtifact.bytecode,
    [100000, 500000, 50000, 100000, 500000, 50000]
  );

  // 3. MockUSDC (no constructor args)
  const usdcAddress = await deployContract(
    walletClient,
    publicClient,
    usdcArtifact.abi,
    usdcArtifact.bytecode
  );

  // 4. MockPerpManager (no constructor args)
  const perpManagerAddress = await deployContract(
    walletClient,
    publicClient,
    perpManagerArtifact.abi,
    perpManagerArtifact.bytecode
  );

  // Configure the mock perp
  // Note: currency0 must NOT be zero address because the SDK's getPerpConfig
  // uses currency0 == 0x0 as a signal that the perp doesn't exist.
  // Use a dummy non-zero address (Anvil account 1) as the perp token.
  const DUMMY_PERP_TOKEN = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8" as Address;
  const poolKey = {
    currency0: DUMMY_PERP_TOKEN,
    currency1: usdcAddress,
    fee: 3000,
    tickSpacing: 60,
    hooks: perpManagerAddress,
  };

  // Call setupPerp on MockPerpManager
  const setupPerpHash = await walletClient.writeContract({
    address: perpManagerAddress,
    abi: perpManagerArtifact.abi,
    functionName: "setupPerp",
    args: [
      TEST_PERP_ID,
      poolKey,
      ANVIL_ACCOUNT_ADDRESS, // creator
      ANVIL_ACCOUNT_ADDRESS, // vault
      ANVIL_ACCOUNT_ADDRESS, // beacon
      feesAddress, // fees module
      marginRatiosAddress, // margin ratios module
      ANVIL_ACCOUNT_ADDRESS, // lockup (use account address as placeholder)
      ANVIL_ACCOUNT_ADDRESS, // sqrtPriceImpactLimit (use account address as placeholder)
      SQRT_PRICE_X96_ONE, // sqrtPriceX96 for price = 1.0
    ],
    account,
    chain: anvilChain,
  });
  await publicClient.waitForTransactionReceipt({ hash: setupPerpHash });

  // Mint USDC to test account: 1M USDC (6 decimals)
  const mintHash = await walletClient.writeContract({
    address: usdcAddress,
    abi: usdcArtifact.abi,
    functionName: "mint",
    args: [ANVIL_ACCOUNT_ADDRESS, 1000000_000000n],
    account,
    chain: anvilChain,
  });
  await publicClient.waitForTransactionReceipt({ hash: mintHash });

  // Create PerpCityContext
  const context = new PerpCityContext({
    walletClient: walletClient as any,
    rpcUrl,
    deployments: {
      perpManager: perpManagerAddress,
      usdc: usdcAddress,
      feesModule: feesAddress,
      marginRatiosModule: marginRatiosAddress,
    },
  });

  const cleanup = () => {
    anvilProcess.kill();
  };

  return {
    rpcUrl,
    cleanup,
    addresses: {
      perpManager: perpManagerAddress,
      usdc: usdcAddress,
      fees: feesAddress,
      marginRatios: marginRatiosAddress,
    },
    testPerpId: TEST_PERP_ID,
    account: ANVIL_ACCOUNT_ADDRESS,
    walletClient: walletClient as any,
    publicClient: publicClient as any,
    context,
  };
}

/**
 * Convenience function to set up a position in the mock contract
 * for testing raw data reads.
 */
export async function setupMockPosition(
  setup: AnvilSetup,
  posId: bigint,
  perpId: Hex,
  margin: bigint,
  entryPerpDelta: bigint,
  entryUsdDelta: bigint,
  marginRatios: { min: number; max: number; liq: number }
): Promise<void> {
  const perpManagerArtifact = loadArtifact("MockPerpManager");
  const account = privateKeyToAccount(ANVIL_PRIVATE_KEY);

  const hash = await setup.walletClient.writeContract({
    address: setup.addresses.perpManager,
    abi: perpManagerArtifact.abi,
    functionName: "setupPosition",
    args: [posId, perpId, margin, entryPerpDelta, entryUsdDelta, marginRatios],
    account,
    chain: setup.walletClient.chain!,
  });
  await setup.publicClient.waitForTransactionReceipt({ hash });
}

/**
 * Convenience function to set up a quote result in the mock contract
 * for testing position live details.
 */
export async function setupMockQuoteResult(
  setup: AnvilSetup,
  posId: bigint,
  pnl: bigint,
  funding: bigint,
  netMargin: bigint,
  wasLiquidated: boolean
): Promise<void> {
  const perpManagerArtifact = loadArtifact("MockPerpManager");
  const account = privateKeyToAccount(ANVIL_PRIVATE_KEY);

  const hash = await setup.walletClient.writeContract({
    address: setup.addresses.perpManager,
    abi: perpManagerArtifact.abi,
    functionName: "setupQuoteResult",
    args: [posId, pnl, funding, netMargin, wasLiquidated],
    account,
    chain: setup.walletClient.chain!,
  });
  await setup.publicClient.waitForTransactionReceipt({ hash });
}
