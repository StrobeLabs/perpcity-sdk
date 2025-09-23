# React Integration Guide

The PerpCity SDK now includes React hooks and context providers for seamless integration with React and Next.js applications.

## Setup

### 1. Install Dependencies

```bash
npm install @strobelabs/perpcity-sdk react react-dom
# or
yarn add @strobelabs/perpcity-sdk react react-dom
# or
pnpm add @strobelabs/perpcity-sdk react react-dom
```

### 2. Wrap Your App with PerpCityProvider

#### For Next.js App Router (app/layout.tsx)

```tsx
import { PerpCityProvider } from '@strobelabs/perpcity-sdk';
import { createWalletClient, http } from "viem";
import { baseSepolia } from "viem/chains";
import { privateKeyToAccount } from 'viem/accounts';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <PerpCityProvider config={getPerpCityConfig()}>
          {children}
        </PerpCityProvider>
      </body>
    </html>
  );
}

function getPerpCityConfig() {
  const walletClient = createWalletClient({
    chain: baseSepolia,
    transport: http(process.env.NEXT_PUBLIC_RPC_URL!),
    account: privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`),
  });

  return {
    walletClient,
    goldskyEndpoint: GOLDSKY_BASE_SEPOLIA_URL,
    perpManagerAddress: PERP_MANAGER_BASE_SEPOLIA_ADDRESS,
    perpManagerAbi: PERP_MANAGER_ABI,
    beaconAbi: BEACON_ABI
  };
}
```

#### For Next.js Pages Router (pages/_app.tsx)

```tsx
import { PerpCityProvider } from '@strobelabs/perpcity-sdk';

export default function MyApp({ Component, pageProps }: any) {
  return (
    <PerpCityProvider config={getPerpCityConfig()}>
      <Component {...pageProps} />
    </PerpCityProvider>
  );
}
```

#### For Create React App or Vite

```tsx
import React from 'react';
import { PerpCityProvider } from '@strobelabs/perpcity-sdk';

function App() {
  return (
    <PerpCityProvider config={getPerpCityConfig()}>
      <YourAppComponents />
    </PerpCityProvider>
  );
}
```

## Available Hooks

### Core Hooks

#### `usePerpCity()`
Access the raw context and perp manager instance.

```tsx
import { usePerpCity } from '@strobelabs/perpcity-sdk';

function MyComponent() {
  const { context, perpManager } = usePerpCity();
  // Use context and perpManager directly
}
```

#### `usePerpManager()`
Get the perp manager instance.

```tsx
import { usePerpManager } from '@strobelabs/perpcity-sdk';

function MyComponent() {
  const perpManager = usePerpManager();
  // Use perpManager methods
}
```

### Data Fetching Hooks

#### `usePerps()`
Fetch and manage the list of all perps.

```tsx
import { usePerps } from '@strobelabs/perpcity-sdk';

function PerpsList() {
  const { perps, loading, error, refetch } = usePerps();

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <button onClick={refetch}>Refresh</button>
      {perps.map(perp => (
        <div key={perp.id}>{perp.id}</div>
      ))}
    </div>
  );
}
```

### Action Hooks

#### `useCreatePerp()`
Create new perps with loading and error states.

```tsx
import { useCreatePerp } from '@strobelabs/perpcity-sdk';

function CreatePerpForm() {
  const { createPerp, loading, error } = useCreatePerp();

  const handleSubmit = async () => {
    try {
      const perp = await createPerp({
        startingPrice: 100.0,
        beacon: '0x7eb9ab957d417cd2c1923bd6a8d07ff94656d056' as `0x${string}`,
      });
      console.log('Created perp:', perp.id);
    } catch (err) {
      console.error('Failed to create perp:', err);
    }
  };

  return (
    <button onClick={handleSubmit} disabled={loading}>
      {loading ? 'Creating...' : 'Create Perp'}
    </button>
  );
}
```

#### `usePerpOperations(perpId)`
Perform operations on a specific perp.

```tsx
import { usePerpOperations } from '@strobelabs/perpcity-sdk';

function PerpTrading({ perpId }: { perpId: string }) {
  const { 
    openMakerPosition, 
    openTakerPosition, 
    getTickSpacing,
    loading, 
    error 
  } = usePerpOperations(perpId);

  const handleOpenMakerPosition = async () => {
    try {
      const position = await openMakerPosition({
        margin: 100,
        priceLower: 45,
        priceUpper: 55,
        maxAmt0In: 1000000,
        maxAmt1In: 1000000,
      });
      console.log('Opened maker position:', position.positionId);
    } catch (err) {
      console.error('Failed to open maker position:', err);
    }
  };

  const handleOpenTakerPosition = async () => {
    try {
      const position = await openTakerPosition({
        isLong: true,
        margin: 100,
        leverage: 2,
        unspecifiedAmountLimit: 1000000,
      });
      console.log('Opened taker position:', position.positionId);
    } catch (err) {
      console.error('Failed to open taker position:', err);
    }
  };

  return (
    <div>
      <button onClick={handleOpenMakerPosition} disabled={loading}>
        Open Maker Position
      </button>
      <button onClick={handleOpenTakerPosition} disabled={loading}>
        Open Taker Position
      </button>
    </div>
  );
}
```

#### `usePositionOperations(perpId, positionId)`
Manage specific positions.

```tsx
import { usePositionOperations } from '@strobelabs/perpcity-sdk';

function PositionManager({ 
  perpId, 
  positionId 
}: { 
  perpId: string; 
  positionId: bigint 
}) {
  const { closePosition, loading, error } = usePositionOperations(perpId, positionId);

  const handleClosePosition = async () => {
    try {
      const result = await closePosition({
        minAmt0Out: 0,
        minAmt1Out: 0,
        maxAmt1In: 1000,
      });
      console.log('Position closed:', result);
    } catch (err) {
      console.error('Failed to close position:', err);
    }
  };

  return (
    <button onClick={handleClosePosition} disabled={loading}>
      {loading ? 'Closing...' : 'Close Position'}
    </button>
  );
}
```

## Complete Example

Here's a complete trading dashboard example:

```tsx
import React, { useState } from 'react';
import { 
  PerpCityProvider,
  usePerps, 
  useCreatePerp, 
  usePerpOperations 
} from '@strobelabs/perpcity-sdk';

function TradingDashboard() {
  return (
    <PerpCityProvider config={getPerpCityConfig()}>
      <div>
        <h1>PerpCity Trading Dashboard</h1>
        <PerpsList />
        <CreatePerpForm />
      </div>
    </PerpCityProvider>
  );
}

function PerpsList() {
  const { perps, loading, error, refetch } = usePerps();
  const [selectedPerpId, setSelectedPerpId] = useState<string>('');

  if (loading) return <div>Loading perps...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <h2>Available Perps</h2>
      <button onClick={refetch}>Refresh</button>
      
      {perps.map((perp) => (
        <div key={perp.id} style={{ margin: '10px', padding: '10px', border: '1px solid #ccc' }}>
          <div>Perp ID: {perp.id}</div>
          <button onClick={() => setSelectedPerpId(perp.id)}>
            Select for Trading
          </button>
        </div>
      ))}

      {selectedPerpId && (
        <TradingInterface perpId={selectedPerpId} />
      )}
    </div>
  );
}

function CreatePerpForm() {
  const { createPerp, loading, error } = useCreatePerp();
  const [startingPrice, setStartingPrice] = useState('100.0');
  const [beacon, setBeacon] = useState('0x7eb9ab957d417cd2c1923bd6a8d07ff94656d056');

  const handleSubmit = async () => {
    try {
      const perp = await createPerp({
        startingPrice: parseFloat(startingPrice),
        beacon: beacon as `0x${string}`,
      });
      console.log('Created perp:', perp.id);
    } catch (err) {
      console.error('Failed to create perp:', err);
    }
  };

  return (
    <div>
      <h2>Create New Perp</h2>
      {error && <div style={{ color: 'red' }}>Error: {error.message}</div>}
      
      <div>
        <label>
          Starting Price:
          <input
            type="number"
            value={startingPrice}
            onChange={(e) => setStartingPrice(e.target.value)}
            step="0.1"
          />
        </label>
      </div>
      
      <div>
        <label>
          Beacon Address:
          <input
            type="text"
            value={beacon}
            onChange={(e) => setBeacon(e.target.value)}
          />
        </label>
      </div>
      
      <button onClick={handleSubmit} disabled={loading}>
        {loading ? 'Creating...' : 'Create Perp'}
      </button>
    </div>
  );
}

function TradingInterface({ perpId }: { perpId: string }) {
  const { openMakerPosition, openTakerPosition, loading } = usePerpOperations(perpId);

  const handleOpenMakerPosition = async () => {
    try {
      const position = await openMakerPosition({
        margin: 100,
        priceLower: 45,
        priceUpper: 55,
        maxAmt0In: 1000000,
        maxAmt1In: 1000000,
      });
      console.log('Opened maker position:', position.positionId);
    } catch (error) {
      console.error('Failed to open maker position:', error);
    }
  };

  const handleOpenTakerPosition = async () => {
    try {
      const position = await openTakerPosition({
        isLong: true,
        margin: 100,
        leverage: 2,
        unspecifiedAmountLimit: 1000000,
      });
      console.log('Opened taker position:', position.positionId);
    } catch (error) {
      console.error('Failed to open taker position:', error);
    }
  };

  return (
    <div style={{ marginTop: '20px', padding: '20px', border: '2px solid #007bff' }}>
      <h3>Trading Interface for Perp: {perpId}</h3>
      
      <button onClick={handleOpenMakerPosition} disabled={loading}>
        Open Maker Position
      </button>
      
      <button onClick={handleOpenTakerPosition} disabled={loading}>
        Open Taker Position
      </button>
    </div>
  );
}

export default TradingDashboard;
```

## Benefits of React Integration

1. **Cleaner API**: No need to pass context to every entity constructor
2. **Automatic Context Sharing**: All components automatically have access to the same context
3. **Loading States**: Built-in loading and error state management
4. **Type Safety**: Full TypeScript support with proper typing
5. **React Patterns**: Follows modern React patterns and conventions
6. **Easy Integration**: Simple setup with provider pattern
7. **Flexible**: Works with any React setup (Next.js, Create React App, Vite, etc.)

## Migration from Class-based API

If you're currently using the class-based API, you can gradually migrate:

**Before (Class-based):**
```tsx
const context = new PerpCityContext(config);
const perpManager = new PerpManager(context);
const perp = new Perp(context, perpId);
const position = await perp.openMakerPosition(params);
```

**After (React Hooks):**
```tsx
// In your component
const { openMakerPosition } = usePerpOperations(perpId);
const position = await openMakerPosition(params);
```

The React integration provides the same functionality with a much cleaner and more React-idiomatic API.
