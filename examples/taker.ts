import type { OpenPosition, PerpAddress, PerpCityContext } from '../dist';
import { calculateTakerSlippageLimit, estimateTakerPosition, openTakerPosition } from '../dist';
import { setup } from './setup';

// Slippage tolerance applied to the off-chain estimate, in percent.
const SLIPPAGE_PERCENT = 1;

async function openTaker(
  context: PerpCityContext,
  perpId: PerpAddress,
  isLong: boolean
): Promise<OpenPosition> {
  const margin = 25;
  const leverage = 1;

  console.log(`Opening taker ${isLong ? 'long' : 'short'} position...`);

  // Derive the contract-native perpDelta off-chain. NOTE: estimateTakerPosition
  // returns an estimate from the current mark only (no fees/price impact), so we
  // wrap it with a slippage tolerance to build amt1Limit.
  const estimate = await estimateTakerPosition(context, perpId, { isLong, margin, leverage });

  // amt1Limit caps USD paid for longs and floors USD received for shorts.
  const amt1Limit = calculateTakerSlippageLimit(estimate, isLong, SLIPPAGE_PERCENT);

  const position = await openTakerPosition(context, perpId, {
    margin,
    perpDelta: estimate.perpDelta,
    amt1Limit,
  });

  console.log(`Taker ${isLong ? 'long' : 'short'} position opened`);
  console.log('Position ID:', position.positionId.toString());
  console.log();

  return position;
}

async function main() {
  const { context, perpId } = setup();

  await openTaker(context, perpId, true);
  await openTaker(context, perpId, false);
}

main();
