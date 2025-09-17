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

### PerpManager Actions

#### Creating a Perp

```typescript
const perp = await perpManager.createPerp({
  startingPrice: 12.3,
  beacon: '0x123...'
});
```

### Perp Actions



### Position Actions

