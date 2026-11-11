import { openMakerPosition } from '../dist';
import { setup } from './setup';

async function main() {
  const { context, perpId } = setup();

  console.log('Fetching perp data...');
  const perpData = await context.getPerpData(perpId);
  console.log('Pool price:', perpData.ammPrice);

  // Provide liquidity in a band around the pool price. LIQUIDITY is the Uniswap
  // v4 liquidity amount; size it with getAmountsForLiquidity for your budget.
  const margin = 100;
  const liquidity = BigInt(process.env.LIQUIDITY ?? '1000000000');

  console.log('Opening maker position...');
  const makerPosition = await openMakerPosition(context, perpId, {
    margin,
    priceLower: perpData.ammPrice * 0.9,
    priceUpper: perpData.ammPrice * 1.1,
    liquidity,
    // Max perp and USD the range may take in (human units; bigint = raw).
    maxAmt0In: 1_000_000,
    maxAmt1In: 1_000_000,
  });

  console.log('Maker Position Opened');
  console.log('Position ID:', makerPosition.positionId.toString());
  console.log();
}

main();
