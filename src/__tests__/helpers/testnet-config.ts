/**
 * Testnet configuration helper for integration tests
 * Loads configuration from .env.local
 */

import { createWalletClient, createPublicClient, http, type WalletClient, type PublicClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import { PerpCityContext } from '../../context';

/**
 * Get testnet configuration from environment variables
 */
export function getTestnetConfig() {
  const rpcUrl = process.env.RPC_URL;
  const privateKey = process.env.PRIVATE_KEY as `0x${string}`;
  const perpManagerAddress = process.env.PERP_MANAGER_ADDRESS as `0x${string}`;
  const usdcAddress = process.env.USDC_ADDRESS as `0x${string}`;
  const chainId = process.env.CHAIN_ID ? parseInt(process.env.CHAIN_ID) : 84532;

  if (!rpcUrl || !privateKey || !perpManagerAddress || !usdcAddress) {
    throw new Error('Missing required environment variables. Check .env.local.example');
  }

  // Ensure TEST_PERP_ID has 0x prefix if provided
  let testPerpId = process.env.TEST_PERP_ID;
  if (testPerpId && !testPerpId.startsWith('0x')) {
    testPerpId = `0x${testPerpId}`;
  }

  return {
    rpcUrl,
    privateKey,
    perpManagerAddress,
    usdcAddress,
    chainId,
    testPerpId: testPerpId as `0x${string}` | undefined,
  };
}

/**
 * Create a wallet client for testing
 */
export function createTestWalletClient(): WalletClient {
  const config = getTestnetConfig();
  const account = privateKeyToAccount(config.privateKey);

  return createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(config.rpcUrl),
  });
}

/**
 * Create a public client for read-only operations
 */
export function createTestPublicClient(): PublicClient {
  const config = getTestnetConfig();

  return createPublicClient({
    chain: baseSepolia,
    transport: http(config.rpcUrl),
  });
}

/**
 * Create a PerpCityContext instance for testing
 */
export function createTestContext() {
  const config = getTestnetConfig();
  const walletClient = createTestWalletClient();

  return new PerpCityContext({
    walletClient,
    deployments: {
      perpManager: config.perpManagerAddress,
      usdc: config.usdcAddress,
    },
  });
}

/**
 * Helper to wait for a transaction to be mined
 */
export async function waitForTransaction(hash: `0x${string}`, publicClient: PublicClient) {
  return await publicClient.waitForTransactionReceipt({
    hash,
    confirmations: 1,
  });
}
