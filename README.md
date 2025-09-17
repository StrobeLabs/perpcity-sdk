# perpcity-sdk

TypeScript SDK to interact with Perp City

### Installation

```
pnpm i @strobelabs/perpcity-sdk
```

### Getting Started

```typescript
import { PerpCityContext } from '@strobelabs/perpcity-sdk';

const ctx: PerpCityContext = {
  publicClient: publicClient,
  walletClient: walletClient,
  addresses: {
    perpManager: PERP_MANAGER_ADDRESS
  },
  abis: {
    perpManager: PERP_MANAGER_ABI,
    beacon: BEACON_ABI
  },
  endpoints: {
    goldsky: GOLDSKY_URL
  }
};

const perpManager = new PerpManager(ctx);
```

### PerpManager Actions

#### Creating a Perp

```typescript
const startingPrice = 12.3;
const beaconAddress = '0x123...';

const perp = await perpManager.createPerp(startingPrice, beaconAddress);
```

### Perp Actions



### Position Actions

