import { setup } from './setup';
import { Perp, Position } from '../dist';

export async function openMakerPosition(perp: Perp) : Promise<Position> {
  const makerPosition = await perp.approveAndOpenMakerPosition({
    margin: 100,
    priceLower: 45,
    priceUpper: 55,
    maxAmt0In: 1000000,
    maxAmt1In: 1000000,
  });

  console.log('Maker Position Opened');
  console.log('Maker Position ID:', makerPosition.positionId);
  console.log();

  return makerPosition;
}

async function main() {
  const perpManager = setup();
  const perp = new Perp(perpManager.context, "0xc60199e01fb787c8b26c769de0accc577474fffcc2ed150ea665a92d83fb2830");
  await openMakerPosition(perp);
}

main();