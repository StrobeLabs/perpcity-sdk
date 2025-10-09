import 'dotenv/config';
import { PerpCityContext, PerpManager } from "../dist";
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
  if (!process.env['GOLDSKY_BEARER_TOKEN']) {
    throw new Error(`Missing required env var: GOLDSKY_BEARER_TOKEN`);
  }
  if (!process.env['GOLDSKY_ENDPOINT']) {
    throw new Error(`Missing required env var: GOLDSKY_ENDPOINT`);
  }
  if (!process.env['PERP_MANAGER_ADDRESS']) {
    throw new Error(`Missing required env var: PERP_MANAGER_ADDRESS`);
  }
  if (!process.env['USDC_ADDRESS']) {
    throw new Error(`Missing required env var: USDC_ADDRESS`);
  }

  const walletClient = createWalletClient({
    chain: baseSepolia,
    transport: http(process.env.RPC_URL),
    account: privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`),
  })

  const ctx = new PerpCityContext({
    walletClient: walletClient,
    goldskyBearerToken: process.env.GOLDSKY_BEARER_TOKEN,
    goldskyEndpoint: process.env.GOLDSKY_ENDPOINT,
    deployments: {
      perpManager: process.env.PERP_MANAGER_ADDRESS as `0x${string}`,
      usdc: process.env.USDC_ADDRESS as `0x${string}`,
    },
  });

  return new PerpManager(ctx);
}