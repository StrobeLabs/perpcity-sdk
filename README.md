# PerpCity SDK

TypeScript SDK for interacting with Perp City perpetual futures contracts on Arbitrum.

# Docs
You can find detailed docs in the [Perp City docsite](https://docs.perp.city)

## Installation

```bash
pnpm add @strobelabs/perpcity-sdk
```

## Quick Start

```typescript
import { PerpCityContext, getRpcUrl } from '@strobelabs/perpcity-sdk';
import { createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { arbitrumSepolia } from 'viem/chains';

// Get RPC URL from environment
const rpcUrl = getRpcUrl();

// Create wallet client
const account = privateKeyToAccount(process.env.PRIVATE_KEY);
const walletClient = createWalletClient({
  account,
  chain: arbitrumSepolia,
  transport: http(rpcUrl)
});

// Initialize context with configuration
const context = new PerpCityContext({
  rpcUrl,
  walletClient,
  deployments: {
    perpAddress: process.env.PERP_ADDRESS as `0x${string}`,
    usdc: process.env.USDC_ADDRESS as `0x${string}`,
    // Optional: Module addresses for creating new perps
    perpFactory: process.env.PERP_FACTORY_ADDRESS as `0x${string}`,
    feesModule: process.env.FEES_MODULE_ADDRESS as `0x${string}`,
    fundingModule: process.env.FUNDING_MODULE_ADDRESS as `0x${string}`,
    marginRatiosModule: process.env.MARGIN_RATIOS_MODULE_ADDRESS as `0x${string}`,
    priceImpactModule: process.env.PRICE_IMPACT_MODULE_ADDRESS as `0x${string}`,
    pricingModule: process.env.PRICING_MODULE_ADDRESS as `0x${string}`,
  },
});
```

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
PERP_ADDRESS=0x...  # Address of the perp market you want to trade
USDC_ADDRESS=0xBEF280BefeE2Cb28c20D1E4Cc1da999B4DA0f1fD  # Perp City test USDC on Arbitrum Sepolia

# RPC Configuration
# For production, use a private RPC provider URL
RPC_URL=https://arb-sepolia.g.alchemy.com/v2/YOUR_API_KEY

# Or for development/testing with public RPC
# RPC_URL=https://sepolia-rollup.arbitrum.io/rpc
```

## License

MIT

## Links

- [Perp City Documentation](https://docs.perp.city)
- [Perp City App](https://app.perp.city)
