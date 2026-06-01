import { calculateAlignedTicks, estimateLiquidity, openMakerPosition, scale6Decimals } from '../dist';
import { setup } from './setup';

async function main() {
  const { context, perpId } = setup();

  console.log('Fetching perp data...');
  const perpData = await context.getPerpData(perpId);
  console.log('Current mark price:', perpData.mark);

  // Provide liquidity in a band around the current mark.
  const margin = 100;
  const priceLower = perpData.mark * 0.9;
  const priceUpper = perpData.mark * 1.1;

  // Size liquidity off-chain from the USDC we are willing to commit.
  const { alignedTickLower, alignedTickUpper } = calculateAlignedTicks(
    priceLower,
    priceUpper,
    perpData.tickSpacing
  );
  const liquidity = await estimateLiquidity(
    context,
    alignedTickLower,
    alignedTickUpper,
    scale6Decimals(margin)
  );

  console.log('Opening maker position...');
  const makerPosition = await openMakerPosition(context, perpId, {
    margin,
    priceLower,
    priceUpper,
    liquidity,
    // Max underlying the position may pull in (human units; bigint = raw).
    maxAmt0In: margin,
    maxAmt1In: margin,
  });

  console.log('Maker Position Opened');
  console.log('Position ID:', makerPosition.positionId.toString());
  console.log();
}

main();
