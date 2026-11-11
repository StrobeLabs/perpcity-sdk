import type { OpenPosition, PerpAddress, PerpCityContext } from '../dist';
import {
  calculateTakerSlippageLimit,
  estimateTakerPosition,
  maxTotalFeeFor,
  openTakerPosition,
} from '../dist';
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

  // Size the order at the cached mark and quote the pool fill.
  const estimate = await estimateTakerPosition(context, perpId, { isLong, margin, leverage });
  // amt1Limit caps USD paid for longs and floors USD received for shorts.
  const amt1Limit = calculateTakerSlippageLimit(estimate, isLong, SLIPPAGE_PERCENT);
  // The fee cap: the fees module's maxSwapFee plus the protocol fee.
  const perpData = await context.getPerpData(perpId);
  const maxTotalFee = maxTotalFeeFor(estimate.usdDelta, {
    maxSwapFeeE6: BigInt(Math.round(perpData.fees.maxSwapFee * 1e6)),
    protocolFeeE6: BigInt(Math.round(perpData.fees.protocolFee * 1e6)),
  });

  const position = await openTakerPosition(context, perpId, {
    margin,
    perpDelta: estimate.perpDelta,
    amt1Limit,
    maxTotalFee,
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
