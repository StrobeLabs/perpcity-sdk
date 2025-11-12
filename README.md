# PerpCity SDK

TypeScript SDK for interacting with Perp City perpetual futures contracts on Base.

## Installation

```bash
pnpm add @strobelabs/perpcity-sdk
```

## Configuration

The SDK requires configuration via environment variables. Create a `.env` file:

```bash
# Blockchain RPC endpoint
RPC_URL=https://sepolia.base.org

# Your private key (only for write operations)
PRIVATE_KEY=0x...

# Contract addresses
PERP_MANAGER_ADDRESS=0x59F1766b77fd67af6c80217C2025A0D536998000
USDC_ADDRESS=0xC1a5D4E99BB224713dd179eA9CA2Fa6600706210

# Optional: Module addresses (used as defaults when creating new perps)
# These can also be fetched dynamically from existing perp configs
FEES_MODULE_ADDRESS=0x...
MARGIN_RATIOS_MODULE_ADDRESS=0x...
LOCKUP_PERIOD_MODULE_ADDRESS=0x...
SQRT_PRICE_IMPACT_LIMIT_MODULE_ADDRESS=0x...
```

### Private RPC Providers (Recommended for Production)

For production applications, we recommend using a private RPC provider like [Alchemy](https://www.alchemy.com/) or [Infura](https://infura.io/) for better reliability, performance, and rate limits.

**Using Alchemy (Recommended):**

```bash
# Set your Alchemy API key
RPC_API_KEY=your_alchemy_api_key_here
RPC_PROVIDER=alchemy  # Optional, defaults to 'alchemy'
CHAIN_ID=84532  # REQUIRED when using RPC_API_KEY: 84532 for Base Sepolia, 8453 for Base Mainnet
```

The SDK will automatically construct the appropriate URL:
- Base Sepolia: `https://base-sepolia.g.alchemy.com/v2/{YOUR_KEY}`
- Base Mainnet: `https://base-mainnet.g.alchemy.com/v2/{YOUR_KEY}`

**IMPORTANT:** When using private RPC providers (RPC_API_KEY), you MUST specify a chain ID either via the `CHAIN_ID` environment variable or by passing `chainId` to `getRpcUrl()`. This requirement prevents production misrouting errors. For custom RPC URLs (RPC_URL), the chain ID is optional but recommended (defaults to Base Sepolia with a warning if omitted).

**Using Infura:**

```bash
RPC_API_KEY=your_infura_api_key_here
RPC_PROVIDER=infura
CHAIN_ID=84532  # REQUIRED when using RPC_API_KEY
```

**Priority:** If `RPC_API_KEY` is set, it takes priority over `RPC_URL`.

**Using the getRpcUrl helper:**

```typescript
import { getRpcUrl } from '@strobelabs/perpcity-sdk';

// Automatically uses RPC_API_KEY if set, otherwise falls back to RPC_URL
const rpcUrl = getRpcUrl({ chainId: 84532 });

// Or provide configuration directly
const rpcUrl = getRpcUrl({
  chainId: 8453,  // Base Mainnet
  provider: 'alchemy',
  apiKey: 'your_key'
});
```

## Quick Start

```typescript
import { PerpCityContext, getRpcUrl } from '@strobelabs/perpcity-sdk';
import { createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';

// Get RPC URL (supports both private providers and custom URLs)
const rpcUrl = getRpcUrl({ chainId: baseSepolia.id });

// Create wallet client
const account = privateKeyToAccount(process.env.PRIVATE_KEY);
const walletClient = createWalletClient({
  account,
  chain: baseSepolia,
  transport: http(rpcUrl)
});

// Initialize context with configuration
const context = new PerpCityContext({
  walletClient,
  deployments: {
    perpManager: process.env.PERP_MANAGER_ADDRESS as `0x${string}`,
    usdc: process.env.USDC_ADDRESS as `0x${string}`,
    // Optional: Module addresses for creating new perps
    feesModule: process.env.FEES_MODULE_ADDRESS as `0x${string}`,
    marginRatiosModule: process.env.MARGIN_RATIOS_MODULE_ADDRESS as `0x${string}`,
    lockupPeriodModule: process.env.LOCKUP_PERIOD_MODULE_ADDRESS as `0x${string}`,
    sqrtPriceImpactLimitModule: process.env.SQRT_PRICE_IMPACT_LIMIT_MODULE_ADDRESS as `0x${string}`,
  },
});
```

## Usage with Wagmi (React + Privy)

The SDK is fully compatible with [wagmi](https://wagmi.sh) and works seamlessly with [Privy](https://privy.io) wallets.

### Setup

```tsx
import { WagmiProvider, createConfig, http } from 'wagmi';
import { PrivyProvider } from '@privy-io/react-auth';
import { baseSepolia } from 'wagmi/chains';

// Configure wagmi
const wagmiConfig = createConfig({
  chains: [baseSepolia],
  transports: {
    [baseSepolia.id]: http(),
  },
});

// Wrap your app
<PrivyProvider appId="your-privy-app-id">
  <WagmiProvider config={wagmiConfig}>
    <App />
  </WagmiProvider>
</PrivyProvider>
```

### Use SDK with Wagmi

```tsx
import { useWalletClient, useChainId } from 'wagmi';
import { useMemo } from 'react';
import { PerpCityContext, openTakerPosition } from '@strobelabs/perpcity-sdk';

function usePerpCity() {
  const { data: walletClient } = useWalletClient();
  const chainId = useChainId();

  return useMemo(() => {
    if (!walletClient) return null;

    // Wagmi's WalletClient is viem-compatible - works directly with SDK!
    return new PerpCityContext({
      walletClient,
      deployments: {
        perpManager: process.env.PERP_MANAGER_ADDRESS as `0x${string}`,
        usdc: process.env.USDC_ADDRESS as `0x${string}`,
        // Optional: Module addresses for creating new perps
        feesModule: process.env.FEES_MODULE_ADDRESS as `0x${string}`,
        marginRatiosModule: process.env.MARGIN_RATIOS_MODULE_ADDRESS as `0x${string}`,
        lockupPeriodModule: process.env.LOCKUP_PERIOD_MODULE_ADDRESS as `0x${string}`,
        sqrtPriceImpactLimitModule: process.env.SQRT_PRICE_IMPACT_LIMIT_MODULE_ADDRESS as `0x${string}`,
      },
    });
  }, [walletClient, chainId]);
}

// In your component
function TradingComponent({ perpId }) {
  const context = usePerpCity();

  const handleOpenLong = async () => {
    if (!context) return;

    const position = await openTakerPosition(context, perpId, {
      isLong: true,
      margin: 100,    // $100 USDC
      leverage: 2,    // 2x leverage
      unspecifiedAmountLimit: 0,
    });

    console.log('Position opened:', position.positionId);
  };

  return <button onClick={handleOpenLong}>Open Long 2x</button>;
}
```

See `examples/wagmi-integration.ts` for complete example with React components.

## Features

### Config Caching
The SDK automatically caches perp configurations (including module addresses) to minimize redundant contract calls:

```typescript
// First call fetches from contract
const config1 = await context.getPerpConfig(perpId);

// Subsequent calls use cache
const config2 = await context.getPerpConfig(perpId); // Instant!
```

### Contract-Only Data Fetching
The SDK fetches all data directly from blockchain contracts, providing real-time, trustless data:

```typescript
// Fetch perp data with live information from contracts
const perpData = await context.getPerpData(perpId);

console.log(perpData.mark);       // Current mark price from contract
console.log(perpData.beacon);     // Oracle beacon address
console.log(perpData.tickSpacing);// Tick spacing
console.log(perpData.bounds);     // Margin and leverage bounds
console.log(perpData.fees);       // Fee structure
```

### Functional API
Pure functions for data extraction:

```typescript
import {
  getPerpMark,
  getPerpBeacon,
  getPerpBounds,
  getPerpFees,
  getPerpTickSpacing
} from '@strobelabs/perpcity-sdk';

// Use functional API for clean, composable code
const mark = getPerpMark(perpData);
const beacon = getPerpBeacon(perpData);
const bounds = getPerpBounds(perpData);
const fees = getPerpFees(perpData);
const tickSpacing = getPerpTickSpacing(perpData);
```

### Create and Manage Perps

```typescript
import { createPerp } from '@strobelabs/perpcity-sdk';

// Create a new perpetual market
// Module addresses will use deployment config defaults if not specified
const perpId = await createPerp(context, {
  startingPrice: 3000,
  beacon: '0x...', // Beacon address for price oracle
  // Optional: Override module addresses for this perp
  // fees: '0x...',
  // marginRatios: '0x...',
  // lockupPeriod: '0x...',
  // sqrtPriceImpactLimit: '0x...',
});

// Get cached config for a perp (includes module addresses)
const config = await context.getPerpConfig(perpId);
console.log(config.fees); // Fees module address
console.log(config.marginRatios); // Margin ratios module address

// Note: Perp discovery must be done externally (e.g., from events, databases, etc.)
// The SDK focuses on interacting with known perp IDs
```

### Manage Positions

```typescript
import { openTakerPosition, openMakerPosition } from '@strobelabs/perpcity-sdk';

// Open a taker (long/short) position
const takerPosition = await openTakerPosition(context, perpId, {
  isLong: true,
  margin: 100,    // $100 USDC
  leverage: 2,    // 2x leverage
  unspecifiedAmountLimit: 0,
});

// Open a maker (LP) position
const makerPosition = await openMakerPosition(context, perpId, {
  margin: 1000,
  priceLower: 2900,
  priceUpper: 3100,
  liquidity: 1000000n,
  maxAmt0In: 1000000,
  maxAmt1In: 1000000,
});

// Get live details for a position (requires position ID from transaction receipt)
const positionData = await context.getOpenPositionData(
  perpId,
  positionId,  // bigint from PositionOpened event
  isLong,      // boolean tracked from when position was opened
  isMaker      // boolean tracked from when position was opened
);

console.log('Position PnL:', positionData.liveDetails.pnl);
console.log('Funding Payment:', positionData.liveDetails.fundingPayment);
console.log('Is Liquidatable:', positionData.liveDetails.isLiquidatable);

// Note: Position tracking must be done externally (e.g., tracking PositionOpened events)
// The SDK requires you to provide position IDs and metadata
```

### Close Positions

```typescript
// Close a position
const closedPosition = await position.closePosition({
  minAmt0Out: 0,
  minAmt1Out: 0,
  maxAmt1In: 1000000
});
```

### User Data

```typescript
// Fetch user data with live details for tracked positions
// You must provide position metadata from your own tracking system
const positions = [
  { perpId: '0x...', positionId: 1n, isLong: true, isMaker: false },
  { perpId: '0x...', positionId: 2n, isLong: false, isMaker: false },
];

const userData = await context.getUserData(userAddress, positions);

console.log(userData.usdcBalance);
console.log(userData.openPositions); // Array with live details for each position

// Access individual position live details
for (const position of userData.openPositions) {
  console.log('Position:', position.positionId);
  console.log('PnL:', position.liveDetails.pnl);
  console.log('Funding:', position.liveDetails.fundingPayment);
  console.log('Margin:', position.liveDetails.effectiveMargin);
  console.log('Liquidatable:', position.liveDetails.isLiquidatable);
}
```

## API Reference

### Core Classes

#### `PerpCityContext`
Base context for all SDK operations. Includes:
- `getPerpConfig(perpId)` - Fetch and cache perp configuration (module addresses, pool settings)
- `getPerpData(perpId)` - Fetch perp data from contracts
- `getUserData(userAddress, positions)` - Fetch user data with live position details
- `getOpenPositionData(perpId, positionId, isLong, isMaker)` - Fetch live details for a single position
- `deployments()` - Get deployment addresses

### Main Functions

#### Perp Manager
- `createPerp(context, params)` - Create a new perp market
- `openTakerPosition(context, perpId, params)` - Open a taker (long/short) position
- `openMakerPosition(context, perpId, params)` - Open a maker (LP) position

#### Perp Data (Pure Functions)
- `getPerpMark(perpData)` - Get mark price
- `getPerpBeacon(perpData)` - Get oracle beacon address
- `getPerpTickSpacing(perpData)` - Get tick spacing
- `getPerpBounds(perpData)` - Get margin and leverage bounds
- `getPerpFees(perpData)` - Get fee structure

#### Position Functions
- `getPositionPnl(positionData)` - Get position PnL
- `getPositionFundingPayment(positionData)` - Get funding payment
- `getPositionEffectiveMargin(positionData)` - Get effective margin
- `getPositionIsLiquidatable(positionData)` - Check if liquidatable
- `closePosition(context, perpId, positionId, params)` - Close a position

#### User Functions
- `getUserUsdcBalance(userData)` - Get USDC balance
- `getUserOpenPositions(userData)` - Get open positions with live details
- `getUserWalletAddress(userData)` - Get user's wallet address

## Examples

Check the `/examples` directory for complete working examples:

- `create-perp.ts` - Create a new perpetual market
- `maker.ts` - Open a maker (liquidity provider) position
- `taker.ts` - Open a taker (long/short) position
- `close.ts` - Close an existing position
- `view.ts` - View perp and position data
- `optimized-view.ts` - Use optimized batch fetching

## Development

### Build

```bash
pnpm build
```

### Test

```bash
# Run unit tests
pnpm test:unit

# Run integration tests (requires .env.local with GOLDSKY_BEARER_TOKEN)
pnpm test:integration

# Run all tests
pnpm test:all

# Watch mode
pnpm test:watch

# UI mode
pnpm test:ui
```

### CI

```bash
# Run CI checks (build + unit tests)
pnpm ci
```

## Environment Setup

Create a `.env.local` file:

```env
# Required
PRIVATE_KEY=your_private_key_here
PERP_MANAGER_ADDRESS=0x59F1766b77fd67af6c80217C2025A0D536998000
USDC_ADDRESS=0xC1a5D4E99BB224713dd179eA9CA2Fa6600706210

# RPC Configuration (choose one option):

# Option 1: Private RPC (Recommended for production)
RPC_API_KEY=your_alchemy_or_infura_key
RPC_PROVIDER=alchemy  # or 'infura'
CHAIN_ID=84532  # 84532 for Base Sepolia, 8453 for Base Mainnet

# Option 2: Custom/Public RPC
# RPC_URL=https://sepolia.base.org
```

## License

GPL-3.0

## Links

- [Perp City Documentation](https://docs.perpcity.io)
- [Strobe Labs](https://strobelabs.io)
