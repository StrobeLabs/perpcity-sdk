/**
 * Anvil test infrastructure for integration tests.
 * Deploys lightweight v2-shaped Perp contracts and a configured SDK context.
 */

import { type ChildProcess, spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { createServer } from "node:net";
import { join } from "node:path";
import {
  type Address,
  createPublicClient,
  createWalletClient,
  defineChain,
  getAddress,
  type Hex,
  http,
  type PublicClient,
  type WalletClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { PerpCityContext } from "../../context";

const ANVIL_PRIVATE_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as const;
const ANVIL_ACCOUNT_ADDRESS = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" as const;
const SQRT_PRICE_X96_ONE = 79228162514264337593543950336n;

export interface AnvilSetup {
  rpcUrl: string;
  cleanup: () => void;
  addresses: {
    perp: Address;
    perpFactory: Address;
    protocolFeeManager: Address;
    usdc: Address;
    beacon: Address;
    fees: Address;
    marginRatios: Address;
    funding: Address;
    pricing: Address;
    priceImpact: Address;
  };
  testPerpId: Hex;
  account: Address;
  walletClient: WalletClient;
  publicClient: PublicClient;
  context: PerpCityContext;
}

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

function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Failed to allocate an Anvil port"));
        return;
      }
      const port = address.port;
      server.close(() => resolve(port));
    });
    server.on("error", reject);
  });
}

function startAnvil(port: number): Promise<{ process: ChildProcess; rpcUrl: string }> {
  return new Promise((resolve, reject) => {
    const anvilProcess = spawn(
      "anvil",
      ["--chain-id", "31337", "--block-time", "1", "--port", String(port)],
      { stdio: ["ignore", "pipe", "pipe"] }
    );

    let resolved = false;
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        anvilProcess.kill();
        reject(new Error("Anvil failed to start within 10 seconds"));
      }
    }, 10000);

    const onOutput = (data: Buffer) => {
      const output = data.toString();
      if (!resolved && output.includes("Listening on")) {
        resolved = true;
        clearTimeout(timeout);
        resolve({ process: anvilProcess, rpcUrl: `http://127.0.0.1:${port}` });
      }
    };

    anvilProcess.stdout?.on("data", onOutput);
    anvilProcess.stderr?.on("data", onOutput);
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

export async function setupAnvil(): Promise<AnvilSetup> {
  const port = await getFreePort();
  const { process: anvilProcess, rpcUrl } = await startAnvil(port);

  const anvilChain = defineChain({
    id: 31337,
    name: "Anvil",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] } },
  });

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

  const beaconArtifact = loadArtifact("MockBeacon");
  const feesArtifact = loadArtifact("MockFees");
  const marginRatiosArtifact = loadArtifact("MockMarginRatios");
  const usdcArtifact = loadArtifact("MockUSDC");
  const perpArtifact = loadArtifact("MockPerp");
  const perpFactoryArtifact = loadArtifact("MockPerpFactory");
  const protocolFeeManagerArtifact = loadArtifact("MockProtocolFeeManager");

  const beaconAddress = await deployContract(
    walletClient,
    publicClient,
    beaconArtifact.abi,
    beaconArtifact.bytecode,
    [SQRT_PRICE_X96_ONE]
  );
  const feesAddress = await deployContract(
    walletClient,
    publicClient,
    feesArtifact.abi,
    feesArtifact.bytecode,
    [1000, 500, 2000, 5000]
  );
  const marginRatiosAddress = await deployContract(
    walletClient,
    publicClient,
    marginRatiosArtifact.abi,
    marginRatiosArtifact.bytecode,
    [100000, 500000, 50000, 100000, 500000, 50000]
  );
  const usdcAddress = await deployContract(
    walletClient,
    publicClient,
    usdcArtifact.abi,
    usdcArtifact.bytecode
  );
  const protocolFeeManagerAddress = await deployContract(
    walletClient,
    publicClient,
    protocolFeeManagerArtifact.abi,
    protocolFeeManagerArtifact.bytecode,
    [100]
  );

  const fundingAddress = ANVIL_ACCOUNT_ADDRESS;
  const pricingAddress = ANVIL_ACCOUNT_ADDRESS;
  const priceImpactAddress = ANVIL_ACCOUNT_ADDRESS;
  const dummyPerpToken = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8" as Address;
  const poolKey = {
    currency0: dummyPerpToken,
    currency1: usdcAddress,
    fee: 0,
    tickSpacing: 60,
    hooks: "0x0000000000000000000000000000000000000000" as Address,
  };
  const modules = {
    beacon: beaconAddress,
    fees: feesAddress,
    funding: fundingAddress,
    marginRatios: marginRatiosAddress,
    priceImpact: priceImpactAddress,
    pricing: pricingAddress,
  };
  const perpAddress = await deployContract(
    walletClient,
    publicClient,
    perpArtifact.abi,
    perpArtifact.bytecode,
    [
      ANVIL_ACCOUNT_ADDRESS,
      poolKey,
      modules,
      protocolFeeManagerAddress,
      100,
      900,
      SQRT_PRICE_X96_ONE,
      SQRT_PRICE_X96_ONE,
    ]
  );
  const perpFactoryAddress = await deployContract(
    walletClient,
    publicClient,
    perpFactoryArtifact.abi,
    perpFactoryArtifact.bytecode,
    [ANVIL_ACCOUNT_ADDRESS, protocolFeeManagerAddress]
  );

  const mintHash = await walletClient.writeContract({
    address: usdcAddress,
    abi: usdcArtifact.abi,
    functionName: "mint",
    args: [ANVIL_ACCOUNT_ADDRESS, 1000000_000000n],
    account,
    chain: anvilChain,
  });
  await publicClient.waitForTransactionReceipt({ hash: mintHash });

  const context = new PerpCityContext({
    walletClient: walletClient as any,
    rpcUrl,
    deployments: {
      perpAddress,
      perpFactory: perpFactoryAddress,
      protocolFeeManager: protocolFeeManagerAddress,
      usdc: usdcAddress,
      feesModule: feesAddress,
      marginRatiosModule: marginRatiosAddress,
      fundingModule: fundingAddress,
      pricingModule: pricingAddress,
      priceImpactModule: priceImpactAddress,
    },
  });

  const cleanup = () => {
    anvilProcess.kill();
  };

  return {
    rpcUrl,
    cleanup,
    addresses: {
      perp: perpAddress,
      perpFactory: perpFactoryAddress,
      protocolFeeManager: protocolFeeManagerAddress,
      usdc: usdcAddress,
      beacon: beaconAddress,
      fees: feesAddress,
      marginRatios: marginRatiosAddress,
      funding: fundingAddress,
      pricing: pricingAddress,
      priceImpact: priceImpactAddress,
    },
    testPerpId: perpAddress as Hex,
    account: ANVIL_ACCOUNT_ADDRESS,
    walletClient: walletClient as any,
    publicClient: publicClient as any,
    context,
  };
}

export async function setupMockPosition(
  setup: AnvilSetup,
  posId: bigint,
  margin: bigint,
  entryPerpDelta: bigint,
  entryUsdDelta: bigint,
  liqRatio = 50000
): Promise<void> {
  const perpArtifact = loadArtifact("MockPerp");
  const account = privateKeyToAccount(ANVIL_PRIVATE_KEY);

  const hash = await setup.walletClient.writeContract({
    address: setup.addresses.perp,
    abi: perpArtifact.abi,
    functionName: "setupPosition",
    args: [posId, setup.account, margin, entryPerpDelta, entryUsdDelta, liqRatio],
    account,
    chain: setup.walletClient.chain!,
  });
  await setup.publicClient.waitForTransactionReceipt({ hash });
}

export async function setupMockMaker(
  setup: AnvilSetup,
  posId: bigint,
  tickLower: number,
  tickUpper: number,
  liquidity: bigint
): Promise<void> {
  const perpArtifact = loadArtifact("MockPerp");
  const account = privateKeyToAccount(ANVIL_PRIVATE_KEY);

  const hash = await setup.walletClient.writeContract({
    address: setup.addresses.perp,
    abi: perpArtifact.abi,
    functionName: "setupMaker",
    args: [posId, tickLower, tickUpper, liquidity],
    account,
    chain: setup.walletClient.chain!,
  });
  await setup.publicClient.waitForTransactionReceipt({ hash });
}
