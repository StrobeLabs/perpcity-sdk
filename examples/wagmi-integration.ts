/**
 * Example: Using perpcity-sdk with Wagmi in React
 *
 * This example shows how to use the SDK in a React app with Privy + Wagmi.
 * The SDK is fully compatible with wagmi's useWalletClient hook - no conversion needed!
 */

import { useWalletClient, useChainId } from 'wagmi';
import { useMemo, useState } from 'react';
import { PerpCityContext } from '../src/context';
import { openTakerPosition, openMakerPosition } from '../src/functions/perp-manager';
import type { Hex } from 'viem';

// ============================================================================
// Setup Functions
// ============================================================================

function getDeployments(chainId: number) {
  const deployments: Record<number, { perpManager: Hex; usdc: Hex }> = {
    84532: {
      perpManager: '0x...' as Hex, // Replace with actual address
      usdc: '0x...' as Hex,         // Replace with actual address
    },
    8453: {
      perpManager: '0x...' as Hex, // Replace with actual address
      usdc: '0x...' as Hex,         // Replace with actual address
    },
  };
  return deployments[chainId] || deployments[84532];
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
      deployments: getDeployments(chainId),
    });
  }, [walletClient, chainId]);
}

// ============================================================================
// React Component: Open Taker Long Position
// ============================================================================

export function OpenLongButton({ perpId }: { perpId: Hex }) {
  const context = usePerpCity();
  const [loading, setLoading] = useState(false);

  const handleOpenLong = async () => {
    if (!context) {
      alert('Please connect wallet');
      return;
    }

    setLoading(true);
    try {
      const position = await openTakerPosition(context, perpId, {
        isLong: true,
        margin: 100,      // $100 USDC
        leverage: 2,      // 2x leverage
        unspecifiedAmountLimit: 0, // No limit (max slippage)
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
      {loading ? 'Opening...' : 'Open Long 2x'}
    </button>
  );
}

// ============================================================================
// React Component: Open Taker Short Position
// ============================================================================

export function OpenShortButton({ perpId }: { perpId: Hex }) {
  const context = usePerpCity();
  const [loading, setLoading] = useState(false);

  const handleOpenShort = async () => {
    if (!context) {
      alert('Please connect wallet');
      return;
    }

    setLoading(true);
    try {
      const position = await openTakerPosition(context, perpId, {
        isLong: false,
        margin: 100,      // $100 USDC
        leverage: 3,      // 3x leverage
        unspecifiedAmountLimit: 1000000,
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
      {loading ? 'Opening...' : 'Open Short 3x'}
    </button>
  );
}

// ============================================================================
// React Component: Open Maker Position
// ============================================================================

export function OpenMakerButton({ perpId }: { perpId: Hex }) {
  const context = usePerpCity();
  const [loading, setLoading] = useState(false);

  const handleOpenMaker = async () => {
    if (!context) {
      alert('Please connect wallet');
      return;
    }

    setLoading(true);
    try {
      // Get current mark price
      const perpData = await context.getPerpData(perpId);
      const markPrice = perpData.mark;

      // Calculate liquidity for desired position size
      // This is simplified - in production you'd use proper liquidity calculation
      // based on desired position size and price range
      const liquidity = BigInt(1000000); // Example: 1M liquidity units

      const position = await openMakerPosition(context, perpId, {
        margin: 100,
        priceLower: markPrice * 0.9,  // 10% below mark
        priceUpper: markPrice * 1.1,  // 10% above mark
        liquidity,
        maxAmt0In: 1000000,  // Max perps
        maxAmt1In: 1000000,  // Max USDC
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
      {loading ? 'Opening...' : 'Open Maker Position'}
    </button>
  );
}

// ============================================================================
// Example: Full Trading Interface Component
// ============================================================================

export function TradingInterface({ perpId }: { perpId: Hex }) {
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

      <div style={{ marginBottom: '20px' }}>
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
 *    import { baseSepolia } from 'wagmi/chains';
 *
 *    // Option 1: Using Alchemy (recommended for production)
 *    const wagmiConfig = createConfig({
 *      chains: [baseSepolia],
 *      transports: {
 *        [baseSepolia.id]: http(`https://base-sepolia.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`),
 *      },
 *    });
 *
 *    // Option 2: Using public RPC (for development)
 *    const wagmiConfig = createConfig({
 *      chains: [baseSepolia],
 *      transports: {
 *        [baseSepolia.id]: http('https://sepolia.base.org'),
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
