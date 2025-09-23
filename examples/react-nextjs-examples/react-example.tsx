import React from 'react';
import { 
  PerpCityProvider, 
  usePerps, 
  useCreatePerp, 
  usePerpOperations,
  usePositionOperations,
  PerpCityContextConfig,
  GOLDSKY_BASE_SEPOLIA_URL,
  PERP_MANAGER_BASE_SEPOLIA_ADDRESS,
  PERP_MANAGER_ABI,
  BEACON_ABI
} from '../dist';
import { createWalletClient, http } from "viem";
import { baseSepolia } from "viem/chains";
import { privateKeyToAccount } from 'viem/accounts';

// Example component showing how to use the React hooks
function PerpCityApp() {
  return (
    <PerpCityProvider config={getPerpCityConfig()}>
      <div>
        <h1>PerpCity SDK React Example</h1>
        <PerpsList />
        <CreatePerpForm />
        <PerpOperations />
      </div>
    </PerpCityProvider>
  );
}

// Component that lists all perps
function PerpsList() {
  const { perps, loading, error, refetch } = usePerps();

  if (loading) return <div>Loading perps...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <h2>Perps ({perps.length})</h2>
      <button onClick={refetch}>Refresh</button>
      <ul>
        {perps.map((perp) => (
          <li key={perp.id}>
            Perp ID: {perp.id}
          </li>
        ))}
      </ul>
    </div>
  );
}

// Component for creating new perps
function CreatePerpForm() {
  const { createPerp, loading, error } = useCreatePerp();
  const [startingPrice, setStartingPrice] = React.useState('50.0');
  const [beacon, setBeacon] = React.useState('0x7eb9ab957d417cd2c1923bd6a8d07ff94656d056');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
      <form onSubmit={handleSubmit}>
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
        <button type="submit" disabled={loading}>
          {loading ? 'Creating...' : 'Create Perp'}
        </button>
      </form>
    </div>
  );
}

// Component showing perp operations
function PerpOperations() {
  const [perpId, setPerpId] = React.useState('');
  const [margin, setMargin] = React.useState('100');
  const [priceLower, setPriceLower] = React.useState('45');
  const [priceUpper, setPriceUpper] = React.useState('55');

  const { openMakerPosition, loading, error } = usePerpOperations(perpId);

  const handleOpenMakerPosition = async () => {
    if (!perpId) return;
    
    try {
      const position = await openMakerPosition({
        margin: parseFloat(margin),
        priceLower: parseFloat(priceLower),
        priceUpper: parseFloat(priceUpper),
        maxAmt0In: 1000000,
        maxAmt1In: 1000000,
      });
      console.log('Opened maker position:', position.positionId);
    } catch (err) {
      console.error('Failed to open maker position:', err);
    }
  };

  return (
    <div>
      <h2>Perp Operations</h2>
      {error && <div style={{ color: 'red' }}>Error: {error.message}</div>}
      
      <div>
        <label>
          Perp ID:
          <input
            type="text"
            value={perpId}
            onChange={(e) => setPerpId(e.target.value)}
            placeholder="0x..."
          />
        </label>
      </div>
      
      <div>
        <label>
          Margin:
          <input
            type="number"
            value={margin}
            onChange={(e) => setMargin(e.target.value)}
          />
        </label>
      </div>
      
      <div>
        <label>
          Price Lower:
          <input
            type="number"
            value={priceLower}
            onChange={(e) => setPriceLower(e.target.value)}
          />
        </label>
      </div>
      
      <div>
        <label>
          Price Upper:
          <input
            type="number"
            value={priceUpper}
            onChange={(e) => setPriceUpper(e.target.value)}
          />
        </label>
      </div>
      
      <button onClick={handleOpenMakerPosition} disabled={loading || !perpId}>
        {loading ? 'Opening...' : 'Open Maker Position'}
      </button>
    </div>
  );
}

// Configuration helper
function getPerpCityConfig(): PerpCityContextConfig {
  if (!process.env['RPC_URL']) {
    throw new Error(`Missing required env var: RPC_URL`);
  }
  if (!process.env['PRIVATE_KEY']) {
    throw new Error(`Missing required env var: PRIVATE_KEY`);
  }

  const walletClient = createWalletClient({
    chain: baseSepolia,
    transport: http(process.env.RPC_URL),
    account: privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`),
  });

  return {
    walletClient: walletClient,
    goldskyEndpoint: GOLDSKY_BASE_SEPOLIA_URL,
    perpManagerAddress: PERP_MANAGER_BASE_SEPOLIA_ADDRESS,
    perpManagerAbi: PERP_MANAGER_ABI,
    beaconAbi: BEACON_ABI
  };
}

export default PerpCityApp;
