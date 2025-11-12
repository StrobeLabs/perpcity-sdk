/**
 * RPC URL utilities for connecting to blockchain networks with private RPC providers
 */

export type RpcProvider = 'alchemy' | 'infura';

export interface RpcConfig {
  chainId?: number;
  provider?: RpcProvider;
  apiKey?: string;
  fallbackUrl?: string;
}

/**
 * Chain ID constants
 */
export const CHAIN_IDS = {
  BASE_SEPOLIA: 84532,
  BASE_MAINNET: 8453,
} as const;

/**
 * Get the appropriate RPC URL based on environment configuration
 *
 * Priority order:
 * 1. If RPC_API_KEY is set, use private RPC provider (Alchemy or Infura)
 * 2. If RPC_URL is set, use that custom URL
 * 3. Throw error if neither is configured
 *
 * @param config - Optional configuration overrides
 * @returns The RPC URL to use for connections
 *
 * @example
 * // Using environment variables
 * // RPC_API_KEY=abc123 RPC_PROVIDER=alchemy
 * const url = getRpcUrl({ chainId: 84532 });
 * // Returns: https://base-sepolia.g.alchemy.com/v2/abc123
 *
 * @example
 * // Using custom config
 * const url = getRpcUrl({
 *   chainId: 8453,
 *   provider: 'alchemy',
 *   apiKey: 'my-key'
 * });
 * // Returns: https://base-mainnet.g.alchemy.com/v2/my-key
 *
 * @example
 * // Fallback to RPC_URL
 * // RPC_URL=https://my-custom-rpc.com
 * const url = getRpcUrl();
 * // Returns: https://my-custom-rpc.com
 */
export function getRpcUrl(config: RpcConfig = {}): string {
  const apiKey = config.apiKey ?? process.env.RPC_API_KEY;
  const envProvider = process.env.RPC_PROVIDER;
  if (envProvider && envProvider !== 'alchemy' && envProvider !== 'infura') {
    throw new Error(
      `Invalid RPC_PROVIDER: "${envProvider}". Supported providers: alchemy, infura`
    );
  }
  const provider = config.provider ?? (envProvider as RpcProvider) ?? 'alchemy';
  const fallbackUrl = config.fallbackUrl ?? process.env.RPC_URL;
  const chainId = config.chainId;

  // If API key is provided, construct private RPC URL
  if (apiKey) {
    const networkUrl = getProviderUrl(chainId, provider);
    return `${networkUrl}${apiKey}`;
  }

  // Fall back to RPC_URL environment variable or provided fallback
  if (fallbackUrl) {
    return fallbackUrl;
  }

  // No configuration provided
  throw new Error(
    'RPC configuration missing. Please set either RPC_API_KEY (for private RPC providers) or RPC_URL (for custom RPC endpoints).'
  );
}

/**
 * Get the provider URL base for a given chain and provider
 *
 * @param chainId - The chain ID (e.g., 84532 for Base Sepolia)
 * @param provider - The RPC provider (alchemy or infura)
 * @returns The base URL for the provider (without API key)
 */
function getProviderUrl(chainId: number | undefined, provider: RpcProvider): string {
  // Determine chain network name
  const network = getNetworkName(chainId);

  switch (provider) {
    case 'alchemy':
      return `https://${network}.g.alchemy.com/v2/`;
    case 'infura':
      return `https://${network}.infura.io/v3/`;
    default:
      throw new Error(`Unsupported RPC provider: ${provider}`);
  }
}

/**
 * Get the network name for a given chain ID
 *
 * @param chainId - The chain ID
 * @returns The network name used by RPC providers
 */
function getNetworkName(chainId: number | undefined): string {
  // If no chainId provided, try to infer from environment or default to Base Sepolia
  const effectiveChainId = chainId ?? getChainIdFromEnv() ?? CHAIN_IDS.BASE_SEPOLIA;

  switch (effectiveChainId) {
    case CHAIN_IDS.BASE_SEPOLIA:
      return 'base-sepolia';
    case CHAIN_IDS.BASE_MAINNET:
      return 'base-mainnet';
    default:
      throw new Error(
        `Unsupported chain ID: ${effectiveChainId}. Supported chains: Base Sepolia (84532), Base Mainnet (8453)`
      );
  }
}

/**
 * Attempt to infer chain ID from environment variables
 *
 * @returns The chain ID from environment, or undefined if not set
 */
function getChainIdFromEnv(): number | undefined {
  const chainIdEnv = process.env.CHAIN_ID;
  if (chainIdEnv) {
    const parsed = parseInt(chainIdEnv, 10);
    if (!isNaN(parsed)) {
      return parsed;
    }
  }
  return undefined;
}
