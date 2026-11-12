import 'dotenv/config';
import { createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { arbitrumSepolia } from 'viem/chains';
import { getRpcUrl, type PerpAddress, PerpCityContext, V1_DEPLOYMENTS } from '../dist';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

/**
 * Shared setup for the examples: Arbitrum Sepolia with the v1.0.0 deployment.
 * Each market is its own Perp contract, so the market address is the perp id.
 */
export function setup(): { context: PerpCityContext; perpId: PerpAddress } {
  const rpcUrl = getRpcUrl(); // reads RPC_URL
  const privateKey = requireEnv('PRIVATE_KEY') as `0x${string}`;
  const perpAddress = requireEnv('PERP_ADDRESS') as PerpAddress;

  const walletClient = createWalletClient({
    chain: arbitrumSepolia,
    transport: http(rpcUrl),
    account: privateKeyToAccount(privateKey),
  });

  const context = new PerpCityContext({
    walletClient,
    rpcUrl,
    deployments: { ...V1_DEPLOYMENTS.arbitrumSepolia, perpAddress },
  });

  return { context, perpId: perpAddress };
}
