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

# Goldsky GraphQL API endpoint
GOLDSKY_ENDPOINT=https://api.goldsky.com/api/private/project_xxx/subgraphs/perp-city/xxx/gn

# Goldsky bearer token
GOLDSKY_BEARER_TOKEN=your_token_here

# Contract addresses
PERP_MANAGER_ADDRESS=0x59F1766b77fd67af6c80217C2025A0D536998000
USDC_ADDRESS=0xC1a5D4E99BB224713dd179eA9CA2Fa6600706210
```

## Quick Start

```typescript
import { PerpCityContext } from '@strobelabs/perpcity-sdk';
import { createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';

// Create wallet client
const account = privateKeyToAccount(process.env.PRIVATE_KEY);
const walletClient = createWalletClient({
  account,
  chain: baseSepolia,
  transport: http(process.env.RPC_URL)
});

// Initialize context with configuration
const context = new PerpCityContext({
  walletClient,
  goldskyBearerToken: process.env.GOLDSKY_BEARER_TOKEN,
  goldskyEndpoint: process.env.GOLDSKY_ENDPOINT,
  deployments: {
    perpManager: process.env.PERP_MANAGER_ADDRESS as `0x${string}`,
    usdc: process.env.USDC_ADDRESS as `0x${string}`,
  },
});
```

## Features

### Optimized Data Fetching
The SDK batches multiple GraphQL queries into single requests, dramatically improving performance:

```typescript
// Fetch perp data with all related information in one call
const perpData = await context.getPerpData(perpId);

console.log(perpData.mark);              // Current mark price
console.log(perpData.index);             // Current index price
console.log(perpData.fundingRate);       // Current funding rate
console.log(perpData.openInterest);      // Open interest
console.log(perpData.markTimeSeries);    // Historical mark prices
console.log(perpData.indexTimeSeries);   // Historical index prices
```

### Functional API
Pure functions for data extraction:

```typescript
import { 
  getPerpMark, 
  getPerpIndex, 
  getPerpFundingRate,
  getPerpBounds,
  getPerpFees
} from '@strobelabs/perpcity-sdk';

// Use functional API for clean, composable code
const mark = getPerpMark(perpData);
const index = getPerpIndex(perpData);
const fundingRate = getPerpFundingRate(perpData);
```

### Create and Manage Perps

```typescript
import { createPerp, getPerps } from '@strobelabs/perpcity-sdk';

// Create a new perpetual market
const perpId = await createPerp(context, {
  startingPrice: 3000,
  beacon: '0x...' // Beacon address for price oracle
});

// Get all perps
const allPerps = await getPerps(context);
```

### Open Positions

```typescript
import { OpenPosition } from '@strobelabs/perpcity-sdk';

// Open a taker position (long or short)
const position = await perp.openTakerPosition({
  isLong: true,
  margin: 1000,      // USDC
  leverage: 10,
  unspecifiedAmountLimit: 1000000
});

// Open a maker position (provide liquidity)
const makerPosition = await perp.openMakerPosition({
  margin: 5000,
  priceLower: 2900,
  priceUpper: 3100,
  maxAmt0In: 1000000,
  maxAmt1In: 1000000
});

// Check position details
const liveDetails = await position.liveDetails();
console.log(liveDetails.pnl);
console.log(liveDetails.fundingPayment);
console.log(liveDetails.isLiquidatable);
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
// Fetch comprehensive user data
const userData = await globalContext.getUserData(userAddress);

console.log(userData.usdcBalance);
console.log(userData.openPositions);
console.log(userData.closedPositions);
console.log(userData.realizedPnl);
console.log(userData.unrealizedPnl);
```

## API Reference

### Core Classes

#### `PerpCityContext`
Base context for all SDK operations.

#### `GlobalPerpCityContext`
Optimized context that batches GraphQL queries for better performance.

### Main Functions

#### Perp Manager
- `getPerps(context)` - Get all perp IDs
- `createPerp(context, params)` - Create a new perp market

#### Perp Data (Pure Functions)
- `getPerpMark(perpData)` - Get mark price
- `getPerpIndex(perpData)` - Get index price  
- `getPerpFundingRate(perpData)` - Get funding rate
- `getPerpBounds(perpData)` - Get margin and leverage bounds
- `getPerpFees(perpData)` - Get fee structure
- `getPerpOpenInterest(perpData)` - Get open interest
- `getPerpMarkTimeSeries(perpData)` - Get historical mark prices
- `getPerpIndexTimeSeries(perpData)` - Get historical index prices

#### Position Functions
- `getPositionPnl(positionData)` - Get position PnL
- `getPositionFundingPayment(positionData)` - Get funding payment
- `getPositionEffectiveMargin(positionData)` - Get effective margin
- `getPositionIsLiquidatable(positionData)` - Check if liquidatable
- `closePosition(context, perpId, positionId, params)` - Close a position

#### User Functions
- `getUserUsdcBalance(userData)` - Get USDC balance
- `getUserOpenPositions(userData)` - Get open positions
- `getUserClosedPositions(userData)` - Get closed positions
- `getUserRealizedPnl(userData)` - Get realized PnL
- `getUserUnrealizedPnl(userData)` - Get unrealized PnL

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
PRIVATE_KEY=your_private_key_here
GOLDSKY_BEARER_TOKEN=your_goldsky_api_key_here
```

## License

GPL-3.0

## Links

- [Perp City Documentation](https://docs.perpcity.io)
- [Strobe Labs](https://strobelabs.io)
