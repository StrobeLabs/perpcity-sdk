import 'dotenv/config';
import type { Hex } from 'viem';
import { createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import { getRpcUrl, PerpCityContext } from '../dist';

export function setup(): { context: PerpCityContext; perpId: Hex } {
  // Validate required environment variables
  if (!process.env['RPC_URL']) {
    throw new Error(`Missing required env var: RPC_URL`);
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

  // Get RPC URL from environment
  const rpcUrl = getRpcUrl();

  const walletClient = createWalletClient({
    chain: baseSepolia,
    transport: http(rpcUrl),
    account: privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`),
  });

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
