import { setup } from './setup';
import { Perp, OpenPosition } from '../dist';

export async function openTakerLongPosition(perp: Perp) : Promise<OpenPosition> {
  const params = {
    isLong: true,
    margin: 25,
    leverage: 1,
    unspecifiedAmountLimit: 0
  };

  const results = await perp.simulateTaker(params);
  if (!results.success) {
    throw new Error('Failed to simulate taker position');
  }
  console.log('Taker Long Position Simulated');
  console.log(results);

  const takerPosition = await perp.approveAndOpenTakerPosition(params);

  console.log('Taker Long Position Opened');
  console.log('Taker Long Position ID:', takerPosition.positionId);
  console.log();

  return takerPosition;
}

export async function openTakerShortPosition(perp: Perp) : Promise<OpenPosition> {
  const params = {
    isLong: false,
    margin: 25,
    leverage: 1,
    unspecifiedAmountLimit: 1000000
  };
  
  const results = await perp.simulateTaker(params);
  if (!results.success) {
    throw new Error('Failed to simulate taker position');
  }
  console.log('Taker Long Position Simulated');
  console.log(results);

  const takerPosition = await perp.approveAndOpenTakerPosition(params);

  console.log('Taker Short Position Opened');
  console.log('Taker Short Position ID:', takerPosition.positionId);
  console.log();

  return takerPosition;
}

async function main() {
  const perpManager = setup();
  const perp = new Perp(perpManager.context, "0x7a6f376ed26ed212e84ab8b3bec9df5b9c8d1ca543f0527c48675131a4bf9bae");
  await openTakerLongPosition(perp);
  await openTakerShortPosition(perp);
}

main();