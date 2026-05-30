import { OpenPosition } from '../dist';
import { setup } from './setup';

export async function closePosition(position: OpenPosition): Promise<void> {
  const result = await position.closePosition({
    amt1Limit: 1000000n,
  });

  console.log('Transaction Hash:', result.txHash);
  console.log('Position Closed');
  console.log('Position ID:', position.positionId);
  console.log();
}

async function main() {
  const { context, perpId } = setup();
  // Example: closing position with ID 6
  const position = new OpenPosition(context, perpId, 6n);
  await closePosition(position);
}

main();
