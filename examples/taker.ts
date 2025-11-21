import type { Hex } from 'viem';
import type { PerpCityContext } from '../src/context';
import type { OpenPosition } from '../src/functions/open-position';
import { openTakerPosition } from '../src/functions/perp-manager';
import { setup } from './setup';

export async function openTakerLongPosition(
  context: PerpCityContext,
  perpId: Hex
): Promise<OpenPosition> {
  console.log('Opening taker long position...');

  const longPosition = await openTakerPosition(context, perpId, {
    isLong: true,
    margin: 25,
    leverage: 1,
    unspecifiedAmountLimit: 0,
  });

  console.log('Taker Long Position Opened');
  console.log('Position ID:', longPosition.positionId.toString());
  console.log();

  return longPosition;
}

export async function openTakerShortPosition(
  context: PerpCityContext,
  perpId: Hex
): Promise<OpenPosition> {
  console.log('Opening taker short position...');

  const shortPosition = await openTakerPosition(context, perpId, {
    isLong: false,
    margin: 25,
    leverage: 1,
    unspecifiedAmountLimit: 1000000,
  });

  console.log('Taker Short Position Opened');
  console.log('Position ID:', shortPosition.positionId.toString());
  console.log();

  return shortPosition;
}

async function main() {
  const { context, perpId } = setup();

  // Open long position
  await openTakerLongPosition(context, perpId);

  // Open short position
  await openTakerShortPosition(context, perpId);
}

main();
