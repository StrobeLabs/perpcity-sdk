import 'dotenv/config';
import { createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import { getRpcUrl, type PerpAddress, PerpCityContext } from '../dist';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

/**
 * Shared setup for the examples.
 *
 * In the v0.1.0 contract model each market is its own `Perp` contract, so the
 * market address IS the perp id. Optional module/factory addresses are passed
 * through for the create-perp example.
 */
export function setup(): { context: PerpCityContext; perpId: PerpAddress } {
  const rpcUrl = getRpcUrl(); // reads RPC_URL
  const privateKey = requireEnv('PRIVATE_KEY') as `0x${string}`;
  const usdc = requireEnv('USDC_ADDRESS') as `0x${string}`;
  const perpAddress = requireEnv('PERP_ADDRESS') as PerpAddress;

  const walletClient = createWalletClient({
    chain: baseSepolia,
    transport: http(rpcUrl),
    account: privateKeyToAccount(privateKey),
  });

  const context = new PerpCityContext({
    walletClient,
    rpcUrl,
    deployments: {
      usdc,
      perpAddress,
      // Optional - only needed by the create-perp example.
      perpFactory: process.env.PERP_FACTORY_ADDRESS as `0x${string}` | undefined,
      protocolFeeManager: process.env.PROTOCOL_FEE_MANAGER_ADDRESS as `0x${string}` | undefined,
      feesModule: process.env.FEES_MODULE_ADDRESS as `0x${string}` | undefined,
      fundingModule: process.env.FUNDING_MODULE_ADDRESS as `0x${string}` | undefined,
      marginRatiosModule: process.env.MARGIN_RATIOS_MODULE_ADDRESS as `0x${string}` | undefined,
      priceImpactModule: process.env.PRICE_IMPACT_MODULE_ADDRESS as `0x${string}` | undefined,
      pricingModule: process.env.PRICING_MODULE_ADDRESS as `0x${string}` | undefined,
    },
  });

  return { context, perpId: perpAddress };
}
