import { OpenPosition } from '../dist';
import { setup } from './setup';

export async function closePosition(position: OpenPosition) : Promise<OpenPosition | null> {
  const result = await position.closePosition({
    maxAmt1In: 1000000,
    minAmt0Out: 0,
    minAmt1Out: 0
  });

  if (result === null) {
    console.log('Taker Position Closed');
    console.log('Taker Position ID:', position.positionId);
    console.log
    return null;
  } else {
    console.log('Maker Position Closed');
    console.log('Maker Position ID:', position.positionId);
    console.log('Taker Position Opened');
    console.log('Taker Position ID: ', result.positionId);
    console.log();
    return result;
  }
}

async function main() {
  const { context, perpId } = setup();
  // Example: closing position with ID 6
  const position = new OpenPosition(context, perpId, 6n);
  await closePosition(position);
}

main();