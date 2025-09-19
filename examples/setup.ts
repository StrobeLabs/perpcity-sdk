import 'dotenv/config';
import { PerpCityContext, PerpManager, GOLDSKY_BASE_SEPOLIA_URL, PERP_MANAGER_BASE_SEPOLIA_ADDRESS, PERP_MANAGER_ABI, BEACON_ABI } from "../dist";
import { createWalletClient, http } from "viem";
import { baseSepolia } from "viem/chains";
import { privateKeyToAccount } from 'viem/accounts';

export function setup() : PerpManager {
  if (!process.env['RPC_URL']) {
    throw new Error(`Missing required env var: RPC_URL`);
  }
  if (!process.env['PRIVATE_KEY']) {
    throw new Error(`Missing required env var: PRIVATE_KEY`);
  }

  const walletClient = createWalletClient({
    chain: baseSepolia,
    transport: http(process.env.RPC_URL),
    account: privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`),
  })

  const ctx = new PerpCityContext({
    walletClient: walletClient,
    goldskyEndpoint: GOLDSKY_BASE_SEPOLIA_URL,
    perpManagerAddress: PERP_MANAGER_BASE_SEPOLIA_ADDRESS,
    perpManagerAbi: PERP_MANAGER_ABI,
    beaconAbi: BEACON_ABI
  });

  return new PerpManager(ctx);
}