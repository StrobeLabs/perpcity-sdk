# perpcity-sdk

TypeScript SDK to interact with Perp City

### Installation

```
pnpm i @strobelabs/perpcity-sdk
```

### Getting Started

```typescript
import { PerpCityContext, PerpManager } from '@strobelabs/perpcity-sdk';

const ctx = new PerpCityContext({
  publicClient: publicClient,
  walletClient: walletClient,
  goldskyEndpoint: GOLDSKY_URL,
  perpManagerAddress: PERP_MANAGER_ADDRESS,
  perpManagerAbi: PERP_MANAGER_ABI,
  beaconAbi: BEACON_ABI
});

const perpManager = new PerpManager(ctx);
```

### Example Usage

#### Create a Perp

```typescript
await perpManager.createPerp({
  startingPrice: 50,
  beacon: '0x123...'
});
```

#### Open a Maker Position

```typescript
await perp.openMakerPosition({
  margin: 100,
  priceLower: 45,
  priceUpper: 55
});
```

