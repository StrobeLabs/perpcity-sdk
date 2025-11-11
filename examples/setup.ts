import 'dotenv/config';
import { PerpCityContext, getRpcUrl } from "../dist";
import { createWalletClient, http } from "viem";
import { baseSepolia } from "viem/chains";
import { privateKeyToAccount } from 'viem/accounts';
import type { Hex } from 'viem';

export function setup(): { context: PerpCityContext; perpId: Hex } {
  // Validate RPC configuration (either RPC_URL or RPC_API_KEY must be set)
  if (!process.env['RPC_URL'] && !process.env['RPC_API_KEY']) {
    throw new Error(`Missing required env var: Either RPC_URL or RPC_API_KEY must be set`);
  }
  if (!process.env['PRIVATE_KEY']) {
    throw new Error(`Missing required env var: PRIVATE_KEY`);
  }
  if (!process.env['PERP_MANAGER_ADDRESS']) {
    throw new Error(`Missing required env var: PERP_MANAGER_ADDRESS`);
  }
  if (!process.env['USDC_ADDRESS']) {
    throw new Error(`Missing required env var: USDC_ADDRESS`);
  }
  if (!process.env['PERP_ID']) {
    throw new Error(`Missing required env var: PERP_ID`);
  }

  // Get RPC URL using the helper (supports private providers like Alchemy)
  const rpcUrl = getRpcUrl({ chainId: baseSepolia.id });

  const walletClient = createWalletClient({
    chain: baseSepolia,
    transport: http(rpcUrl),
    account: privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`),
  })

  const context = new PerpCityContext({
    walletClient: walletClient,
    deployments: {
      perpManager: process.env.PERP_MANAGER_ADDRESS as `0x${string}`,
      usdc: process.env.USDC_ADDRESS as `0x${string}`,
    },
  });

  return {
    context,
    perpId: process.env.PERP_ID as Hex,
  };
}