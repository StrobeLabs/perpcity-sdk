/**
 * RPC URL utilities for connecting to blockchain networks
 */

export interface RpcConfig {
  url?: string;
}

/**
 * Get the appropriate RPC URL based on environment configuration
 *
 * @param config - Optional configuration with URL override
 * @returns The RPC URL to use for connections
 * @throws Error if no RPC URL is configured
 *
 * @example
 * // Using environment variable
 * // RPC_URL=https://base-sepolia.g.alchemy.com/v2/YOUR_KEY
 * const url = getRpcUrl();
 * // Returns: https://base-sepolia.g.alchemy.com/v2/YOUR_KEY
 *
 * @example
 * // Using config override
 * const url = getRpcUrl({
 *   url: 'https://base-mainnet.g.alchemy.com/v2/YOUR_KEY'
 * });
 * // Returns: https://base-mainnet.g.alchemy.com/v2/YOUR_KEY
 */
export function getRpcUrl(config: RpcConfig = {}): string {
  const rpcUrl = config.url ?? process.env.RPC_URL;

  if (!rpcUrl) {
    throw new Error(
      'RPC_URL is required. Please set the RPC_URL environment variable with your full RPC endpoint URL.\n' +
      'Examples:\n' +
      '  - Alchemy: https://base-sepolia.g.alchemy.com/v2/YOUR_API_KEY\n' +
      '  - Infura: https://base-sepolia.infura.io/v3/YOUR_API_KEY\n' +
      '  - Public RPC: https://sepolia.base.org'
    );
  }

  return rpcUrl;
}
