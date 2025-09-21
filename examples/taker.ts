import { setup } from './setup';
import { Perp, Position } from '../dist';

export async function openTakerPosition(perp: Perp) : Promise<Position> {
  const takerPosition = await perp.approveAndOpenTakerPosition({
    isLong: true,
    margin: 10,
    leverage: 2,
    unspecifiedAmountLimit: 0
  });

  console.log('Taker Position Opened');
  console.log('Taker Position ID:', takerPosition.positionId);
  console.log();

  return takerPosition;
}

async function main() {
  const perpManager = setup();
  const perp = new Perp(perpManager.context, "0xc60199e01fb787c8b26c769de0accc577474fffcc2ed150ea665a92d83fb2830");
  await openTakerPosition(perp);
}

main();