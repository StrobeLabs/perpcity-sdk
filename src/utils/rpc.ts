/**
 * RPC URL utilities for connecting to blockchain networks
 */

export interface RpcConfig {
  url?: string;
}

/**
 * Get the RPC URL from environment or configuration
 *
 * This is a simple helper that retrieves the RPC URL from the RPC_URL
 * environment variable or accepts a direct override. The function does
 * not construct URLs - it expects the full endpoint URL to be provided.
 *
 * @param config - Optional configuration with URL override
 * @returns The RPC URL to use for connections
 * @throws Error if no RPC URL is configured
 *
 * @example
 * // Get URL from RPC_URL environment variable
 * // RPC_URL=https://your-rpc-endpoint.example
 * const url = getRpcUrl();
 * // Returns: https://your-rpc-endpoint.example
 *
 * @example
 * // Override with custom URL
 * const url = getRpcUrl({
 *   url: 'https://custom-rpc.example'
 * });
 * // Returns: https://custom-rpc.example
 */
export function getRpcUrl(config: RpcConfig = {}): string {
  const rpcUrl = config.url ?? process.env.RPC_URL;

  if (!rpcUrl) {
    throw new Error(
      'RPC_URL is required. Please set the RPC_URL environment variable with your full RPC endpoint URL.\n' +
      'Example URLs (use your own provider and API key):\n' +
      '  https://base-sepolia.g.alchemy.com/v2/YOUR_API_KEY\n' +
      '  https://base-sepolia.infura.io/v3/YOUR_API_KEY\n' +
      '  https://sepolia.base.org'
    );
  }

  return rpcUrl;
}
