# PerpCity SDK

TypeScript SDK for interacting with Perp City perpetual futures contracts on Base.

# Docs
You can find detailed docs in the strobe [docsite](docs.strobe.org/docs/developer/sdk)

## Installation

```bash
pnpm add @strobelabs/perpcity-sdk
```

## Quick Start

```typescript
import { PerpCityContext, getRpcUrl } from '@strobelabs/perpcity-sdk';
import { createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';

// Get RPC URL from environment
const rpcUrl = getRpcUrl();

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

# RPC Configuration
# For production, use a private RPC provider URL
RPC_URL=https://base-sepolia.g.alchemy.com/v2/YOUR_API_KEY

# Or for development/testing with public RPC
# RPC_URL=https://sepolia.base.org
```

## License

MIT

## Links

- [Perp City Documentation](https://docs.perpcity.io)
- [Strobe Labs](https://strobelabs.io)
