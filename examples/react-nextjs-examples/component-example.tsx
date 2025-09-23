// Example component showing how to use the hooks in any component
import React, { useState } from 'react';
import { 
  usePerps, 
  useCreatePerp, 
  usePerpOperations,
  usePositionOperations 
} from '@strobelabs/perpcity-sdk';

// Example: Trading Dashboard Component
export function TradingDashboard() {
  const { perps, loading: perpsLoading, refetch } = usePerps();
  const { createPerp, loading: createLoading } = useCreatePerp();
  const [selectedPerpId, setSelectedPerpId] = useState<string>('');

  const handleCreatePerp = async () => {
    try {
      const perp = await createPerp({
        startingPrice: 100.0,
        beacon: '0x7eb9ab957d417cd2c1923bd6a8d07ff94656d056' as `0x${string}`,
      });
      console.log('Created perp:', perp.id);
      refetch(); // Refresh the list
    } catch (error) {
      console.error('Failed to create perp:', error);
    }
  };

  return (
    <div>
      <h1>Trading Dashboard</h1>
      
      <div>
        <h2>Available Perps</h2>
        {perpsLoading ? (
          <div>Loading perps...</div>
        ) : (
          <div>
            {perps.map((perp) => (
              <div key={perp.id} style={{ margin: '10px', padding: '10px', border: '1px solid #ccc' }}>
                <div>Perp ID: {perp.id}</div>
                <button onClick={() => setSelectedPerpId(perp.id)}>
                  Select for Trading
                </button>
              </div>
            ))}
          </div>
        )}
        
        <button onClick={handleCreatePerp} disabled={createLoading}>
          {createLoading ? 'Creating...' : 'Create New Perp'}
        </button>
      </div>

      {selectedPerpId && (
        <TradingInterface perpId={selectedPerpId} />
      )}
    </div>
  );
}

// Example: Trading Interface Component
function TradingInterface({ perpId }: { perpId: string }) {
  const { openMakerPosition, openTakerPosition, loading } = usePerpOperations(perpId);
  const [isLong, setIsLong] = useState(true);
  const [margin, setMargin] = useState('100');
  const [leverage, setLeverage] = useState('2');

  const handleOpenMakerPosition = async () => {
    try {
      const position = await openMakerPosition({
        margin: parseFloat(margin),
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
        isLong,
        margin: parseFloat(margin),
        leverage: parseFloat(leverage),
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
      
      <div>
        <h4>Maker Position</h4>
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
        <button onClick={handleOpenMakerPosition} disabled={loading}>
          Open Maker Position
        </button>
      </div>

      <div>
        <h4>Taker Position</h4>
        <div>
          <label>
            <input
              type="checkbox"
              checked={isLong}
              onChange={(e) => setIsLong(e.target.checked)}
            />
            Long Position
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
            Leverage: 
            <input
              type="number"
              value={leverage}
              onChange={(e) => setLeverage(e.target.value)}
              step="0.1"
            />
          </label>
        </div>
        <button onClick={handleOpenTakerPosition} disabled={loading}>
          Open Taker Position
        </button>
      </div>
    </div>
  );
}

// Example: Position Management Component
export function PositionManager({ perpId, positionId }: { perpId: string; positionId: bigint }) {
  const { closePosition, loading } = usePositionOperations(perpId, positionId);
  const [minAmt0Out, setMinAmt0Out] = useState('0');
  const [minAmt1Out, setMinAmt1Out] = useState('0');
  const [maxAmt1In, setMaxAmt1In] = useState('1000');

  const handleClosePosition = async () => {
    try {
      const result = await closePosition({
        minAmt0Out: parseFloat(minAmt0Out),
        minAmt1Out: parseFloat(minAmt1Out),
        maxAmt1In: parseFloat(maxAmt1In),
      });
      console.log('Position closed:', result);
    } catch (error) {
      console.error('Failed to close position:', error);
    }
  };

  return (
    <div style={{ marginTop: '20px', padding: '20px', border: '2px solid #dc3545' }}>
      <h3>Position Management</h3>
      <p>Perp ID: {perpId}</p>
      <p>Position ID: {positionId.toString()}</p>
      
      <div>
        <label>
          Min Amount 0 Out: 
          <input
            type="number"
            value={minAmt0Out}
            onChange={(e) => setMinAmt0Out(e.target.value)}
          />
        </label>
      </div>
      <div>
        <label>
          Min Amount 1 Out: 
          <input
            type="number"
            value={minAmt1Out}
            onChange={(e) => setMinAmt1Out(e.target.value)}
          />
        </label>
      </div>
      <div>
        <label>
          Max Amount 1 In: 
          <input
            type="number"
            value={maxAmt1In}
            onChange={(e) => setMaxAmt1In(e.target.value)}
          />
        </label>
      </div>
      
      <button onClick={handleClosePosition} disabled={loading}>
        {loading ? 'Closing...' : 'Close Position'}
      </button>
    </div>
  );
}
