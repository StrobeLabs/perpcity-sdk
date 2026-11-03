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

### Queued withdrawal protection (explicit new generation)

`WITHDRAWAL_CONTROLLER_ABI`, `PROTECTED_PERP_ACTION_ABI` and the withdrawal helpers
track contracts source `e996edf638834e2559926947a457b529ddd41821`. Activation requires
pinning the release tag and verified per-chain deployment manifest. The existing
`PERP_ABI`, position builders and pricing math continue to describe supported live
legacy builds; do not use them for a new-generation Perp. `buildProtectedPerpCall`
encodes explicit, caller-reviewed parameters without pretending legacy sizing math
applies. New positions use the contract's ownership ledger, not ERC721 approvals.

Read the controller and its claim at the same block with `readWithdrawalController`
and `readWithdrawalClaim`, then evaluate `withdrawalEligibility`. The current
challenge window applies retroactively, and both claim and global pauses override
maturity. `buildReleaseWithdrawalClaimCall` supports owner-signed smart-account
batches; `releaseWithdrawalClaim` simulates and waits for an EOA transaction. Release
is permissionless but always pays the claim's immutable recipient.

Pass receipt logs and verified controller/Perp bindings to `decodeWithdrawalPayouts`.
Keep every result: a transaction can contain multiple claims and immediate payouts.
An emitted queued claim means the position action succeeded; never retry the close
because USDC has not arrived yet. Track claims by chain, controller and claim ID.
Keep old-controller bindings after rotations. Release reverts expose typed
`WITHDRAWAL_NOT_READY`, `WITHDRAWAL_PAUSED`, `WITHDRAWAL_NOT_PENDING`, and
`TVL_CAP_EXCEEDED` codes through the existing error decoder.
