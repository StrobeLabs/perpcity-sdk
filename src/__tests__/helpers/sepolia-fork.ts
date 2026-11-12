/**
 * An anvil fork of Arbitrum Sepolia with a fresh v1.0.0 market on it, made
 * through the deployed v1 factories (perpcity-deployments PR #3). Used by the
 * v1 fork test until a Sepolia v1 perp is listed; then set PERPCITY_V1_PERP.
 */
import { type ChildProcess, spawn } from "node:child_process";
import { createServer } from "node:net";
import {
  type Address,
  createPublicClient,
  createWalletClient,
  http,
  type PublicClient,
  parseAbi,
  type WalletClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arbitrumSepolia } from "viem/chains";
import { PerpCityContext } from "../../context";
import { V1_BEACON_DEPLOYMENTS, V1_DEPLOYMENTS } from "../../deployments";

/** anvil account 0 (public test key). */
export const FORK_PRIVATE_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as const;

export const SEPOLIA = V1_DEPLOYMENTS.arbitrumSepolia;
const BEACONS = V1_BEACON_DEPLOYMENTS.arbitrumSepolia;

const FACTORY_ABI = parseAbi([
  "function createVerifier(address signer) returns (address)",
  "function createBeacon(address verifier, uint256 initialIndex) returns (address)",
]);
const TEST_USDC_ABI = parseAbi(["function mint(address to, uint256 amount)"]);

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") return reject(new Error("no port"));
      server.close(() => resolve(address.port));
    });
    server.on("error", reject);
  });
}

function startAnvil(forkUrl: string, port: number): Promise<ChildProcess> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "anvil",
      ["--fork-url", forkUrl, "--port", String(port), "--block-time", "1"],
      {
        stdio: ["ignore", "pipe", "pipe"],
      }
    );
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error("anvil fork did not start within 60 s"));
    }, 60_000);
    const onOutput = (data: Buffer) => {
      if (data.toString().includes("Listening on")) {
        clearTimeout(timer);
        resolve(child);
      }
    };
    child.stdout?.on("data", onOutput);
    child.stderr?.on("data", onOutput);
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`anvil exited with code ${code}`));
    });
  });
}

export type SepoliaFork = {
  rpcUrl: string;
  account: Address;
  publicClient: PublicClient;
  walletClient: WalletClient;
  context: PerpCityContext;
  cleanup: () => void;
};

export async function startSepoliaFork(forkUrl: string): Promise<SepoliaFork> {
  const port = await freePort();
  const child = await startAnvil(forkUrl, port);
  const rpcUrl = `http://127.0.0.1:${port}`;
  const account = privateKeyToAccount(FORK_PRIVATE_KEY);
  const walletClient = createWalletClient({
    account,
    chain: arbitrumSepolia,
    transport: http(rpcUrl),
  });
  const publicClient = createPublicClient({ chain: arbitrumSepolia, transport: http(rpcUrl) });
  const context = new PerpCityContext({ walletClient, rpcUrl, deployments: SEPOLIA });
  return {
    rpcUrl,
    account: account.address,
    publicClient: publicClient as PublicClient,
    walletClient,
    context,
    cleanup: () => child.kill(),
  };
}

async function send(
  fork: SepoliaFork,
  request: Parameters<PublicClient["simulateContract"]>[0]
): Promise<unknown> {
  const { request: prepared, result } = await fork.publicClient.simulateContract({
    ...request,
    account: fork.walletClient.account,
  } as Parameters<PublicClient["simulateContract"]>[0]);
  const hash = await fork.walletClient.writeContract(
    prepared as Parameters<WalletClient["writeContract"]>[0]
  );
  const receipt = await fork.publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error(`setup transaction reverted: ${hash}`);
  return result;
}

/** A v1 identity beacon at `indexX96`, bound to a fresh ECDSA verifier (signer = fork account). */
export async function createFreshBeacon(fork: SepoliaFork, indexX96: bigint): Promise<Address> {
  const verifier = (await send(fork, {
    address: BEACONS.ecdsaVerifierFactory,
    abi: FACTORY_ABI,
    functionName: "createVerifier",
    args: [fork.account],
  })) as Address;
  return (await send(fork, {
    address: BEACONS.identityBeaconFactory,
    abi: FACTORY_ABI,
    functionName: "createBeacon",
    args: [verifier, indexX96],
  })) as Address;
}

/** Testnet USDC has a public mint. */
export async function mintTestUsdc(fork: SepoliaFork, amount: bigint): Promise<void> {
  await send(fork, {
    address: SEPOLIA.usdc,
    abi: TEST_USDC_ABI,
    functionName: "mint",
    args: [fork.account, amount],
  });
}
