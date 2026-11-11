import { OpenPosition } from '../dist';
import { setup } from './setup';

export async function closePosition(position: OpenPosition): Promise<void> {
  // A taker close sells the whole position with reduceOnly and needs a fee cap.
  const result = await position.closePosition({
    amt1Limit: 0n, // minimum USD received on a long close; set it from a quote
    maxTotalFee: 1_000_000n, // $1
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
