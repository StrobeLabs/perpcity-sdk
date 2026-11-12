/**
 * Example: Using perpcity-sdk with Wagmi in React
 *
 * This example shows how to use the SDK in a React app with Privy + Wagmi.
 * The SDK is fully compatible with wagmi's useWalletClient hook - no conversion needed!
 */

import { useMemo, useState } from 'react';
import type { Hex } from 'viem';
import { useChainId, useWalletClient } from 'wagmi';
import {
  type PerpAddress,
  PerpCityContext,
  calculateTakerSlippageLimit,
  estimateTakerPosition,
  maxTotalFeeFor,
  openMakerPosition,
  openTakerPosition,
  V1_DEPLOYMENTS,
} from '../src';

// Slippage tolerance applied to off-chain taker estimates, in percent.
const SLIPPAGE_PERCENT = 1;

// ============================================================================
// Setup Functions
// ============================================================================

function getDeployments(chainId: number) {
  // v1.0.0 deployments. Pass the specific market (perp) address per trade.
  return chainId === 42161 ? V1_DEPLOYMENTS.arbitrum : V1_DEPLOYMENTS.arbitrumSepolia;
}

function getRpcUrl(chainId: number): string {
  const rpcUrls: Record<number, string> = {
    421614: process.env.NEXT_PUBLIC_RPC_URL || 'https://sepolia-rollup.arbitrum.io/rpc',
    42161: process.env.NEXT_PUBLIC_RPC_URL || 'https://arb1.arbitrum.io/rpc',
  };
  return rpcUrls[chainId] || rpcUrls[421614];
}

/** The fee cap for a quote: maxSwapFee + protocol fee on the quoted USD leg. */
async function feeCap(context: PerpCityContext, perpId: PerpAddress, usdDelta: bigint) {
  const { fees } = await context.getPerpData(perpId);
  return maxTotalFeeFor(usdDelta, {
    maxSwapFeeE6: BigInt(Math.round(fees.maxSwapFee * 1e6)),
    protocolFeeE6: BigInt(Math.round(fees.protocolFee * 1e6)),
  });
}

// ============================================================================
// React Hook: Get SDK Context from Wagmi
// ============================================================================

/**
 * Hook to get PerpCityContext from wagmi's wallet client.
 *
 * Usage:
 * ```tsx
 * const context = usePerpCity();
 * if (!context) return <div>Please connect wallet</div>;
 * ```
 */
export function usePerpCity(): PerpCityContext | null {
  const { data: walletClient } = useWalletClient();
  const chainId = useChainId();

  return useMemo(() => {
    if (!walletClient) return null;

    // Wagmi's WalletClient is viem-compatible - works directly with SDK!
    return new PerpCityContext({
      walletClient,
      rpcUrl: getRpcUrl(chainId),
      deployments: getDeployments(chainId),
    });
  }, [walletClient, chainId]);
}

// ============================================================================
// React Component: Open Taker Long Position
// ============================================================================

export function OpenLongButton({ perpId }: { perpId: PerpAddress }) {
  const context = usePerpCity();
  const [loading, setLoading] = useState(false);

  const handleOpenLong = async () => {
    if (!context) {
      alert('Please connect wallet');
      return;
    }

    setLoading(true);
    try {
      // Derive the contract-native perpDelta off-chain, then bound USD paid.
      const estimate = await estimateTakerPosition(context, perpId, {
        isLong: true,
        margin: 100, // $100 USDC
        leverage: 2, // 2x leverage
      });
      const amt1Limit = calculateTakerSlippageLimit(estimate, true, SLIPPAGE_PERCENT);

      const position = await openTakerPosition(context, perpId, {
        margin: 100,
        perpDelta: estimate.perpDelta,
        amt1Limit,
        maxTotalFee: await feeCap(context, perpId, estimate.usdDelta),
      });

      console.log('Position opened:', position.positionId);
      alert(`Long position opened! ID: ${position.positionId}`);
    } catch (error: any) {
      console.error('Failed to open position:', error);
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button onClick={handleOpenLong} disabled={loading || !context}>
      {loading ? "Opening..." : "Open Long 2x"}
    </button>
  );
}

// ============================================================================
// React Component: Open Taker Short Position
// ============================================================================

export function OpenShortButton({ perpId }: { perpId: PerpAddress }) {
  const context = usePerpCity();
  const [loading, setLoading] = useState(false);

  const handleOpenShort = async () => {
    if (!context) {
      alert('Please connect wallet');
      return;
    }

    setLoading(true);
    try {
      // Derive the contract-native perpDelta off-chain, then floor USD received.
      const estimate = await estimateTakerPosition(context, perpId, {
        isLong: false,
        margin: 100, // $100 USDC
        leverage: 3, // 3x leverage
      });
      const amt1Limit = calculateTakerSlippageLimit(estimate, false, SLIPPAGE_PERCENT);

      const position = await openTakerPosition(context, perpId, {
        margin: 100,
        perpDelta: estimate.perpDelta,
        amt1Limit,
        maxTotalFee: await feeCap(context, perpId, estimate.usdDelta),
      });

      console.log('Position opened:', position.positionId);
      alert(`Short position opened! ID: ${position.positionId}`);
    } catch (error: any) {
      console.error('Failed to open position:', error);
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button onClick={handleOpenShort} disabled={loading || !context}>
      {loading ? "Opening..." : "Open Short 3x"}
    </button>
  );
}

// ============================================================================
// React Component: Open Maker Position
// ============================================================================

export function OpenMakerButton({ perpId }: { perpId: PerpAddress }) {
  const context = usePerpCity();
  const [loading, setLoading] = useState(false);

  const handleOpenMaker = async () => {
    if (!context) {
      alert('Please connect wallet');
      return;
    }

    setLoading(true);
    try {
      const perpData = await context.getPerpData(perpId);
      const margin = 100;

      const position = await openMakerPosition(context, perpId, {
        margin,
        priceLower: perpData.ammPrice * 0.9, // 10% below the pool price
        priceUpper: perpData.ammPrice * 1.1, // 10% above the pool price
        liquidity: 1_000_000_000n, // size with getAmountsForLiquidity for your budget
        maxAmt0In: 1_000_000, // Max perp the range takes in
        maxAmt1In: 1_000_000, // Slippage limit on the USD leg (accounting only; v1 transfers only the margin)
      });

      console.log('Maker position opened:', position.positionId);
      alert(`Maker position opened! ID: ${position.positionId}`);
    } catch (error: any) {
      console.error('Failed to open maker position:', error);
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button onClick={handleOpenMaker} disabled={loading || !context}>
      {loading ? "Opening..." : "Open Maker Position"}
    </button>
  );
}

// ============================================================================
// Example: Full Trading Interface Component
// ============================================================================

export function TradingInterface({ perpId }: { perpId: PerpAddress }) {
  const context = usePerpCity();

  if (!context) {
    return (
      <div>
        <h2>Connect Wallet to Trade</h2>
        <p>Please connect your wallet using Privy to start trading.</p>
      </div>
    );
  }

  return (
    <div>
      <h2>Trading Interface</h2>
      <div style={{ marginBottom: "20px" }}>
        <h3>Taker Positions</h3>
        <OpenLongButton perpId={perpId} />
        <OpenShortButton perpId={perpId} />
      </div>
      <div>
        <h3>Maker Positions</h3>
        <OpenMakerButton perpId={perpId} />
      </div>
    </div>
  );
}

// ============================================================================
// Setup Instructions
// ============================================================================

/*
 * To use this in your React app:
 *
 * 1. Install dependencies:
 *    npm install @privy-io/react-auth @privy-io/wagmi wagmi viem
 *
 * 2. Wrap your app with providers:
 *
 *    import { WagmiProvider, createConfig, http } from 'wagmi';
 *    import { PrivyProvider } from '@privy-io/react-auth';
 *    import { arbitrumSepolia } from 'wagmi/chains';
 *
 *    // Option 1: Using Alchemy (recommended for production)
 *    const wagmiConfig = createConfig({
 *      chains: [arbitrumSepolia],
 *      transports: {
 *        [arbitrumSepolia.id]: http(`https://arb-sepolia.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`),
 *      },
 *    });
 *
 *    // Option 2: Using public RPC (for development)
 *    const wagmiConfig = createConfig({
 *      chains: [arbitrumSepolia],
 *      transports: {
 *        [arbitrumSepolia.id]: http('https://sepolia-rollup.arbitrum.io/rpc'),
 *      },
 *    });
 *
 *    export default function App() {
 *      return (
 *        <PrivyProvider appId="your-privy-app-id">
 *          <WagmiProvider config={wagmiConfig}>
 *            <TradingInterface perpId="0x..." />
 *          </WagmiProvider>
 *        </PrivyProvider>
 *      );
 *    }
 *
 * 3. Use the components:
 *    <TradingInterface perpId={perpId} />
 */
