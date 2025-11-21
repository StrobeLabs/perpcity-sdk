import { openMakerPosition } from '../src/functions/perp-manager';
import { setup } from './setup';

async function main() {
  const { context, perpId } = setup();

  // Get perp data for current price
  console.log('Fetching perp data...');
  const perpData = await context.getPerpData(perpId);
  console.log('Current mark price:', perpData.mark);

  // Open maker position around current price
  console.log('Opening maker position...');
  const makerPosition = await openMakerPosition(context, perpId, {
    margin: 100,
    priceLower: 45,
    priceUpper: 55,
    liquidity: BigInt(1000000), // Example: 1M liquidity units
    maxAmt0In: 1000000,
    maxAmt1In: 1000000,
  });

  console.log('Maker Position Opened');
  console.log('Position ID:', makerPosition.positionId.toString());
  console.log();
}

main();
