import { setup } from './setup';
import { Perp, OpenPosition } from '../dist';

export async function openMakerPosition(perp: Perp) : Promise<OpenPosition> {
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
  const perp = new Perp(perpManager.context, "0x7a6f376ed26ed212e84ab8b3bec9df5b9c8d1ca543f0527c48675131a4bf9bae");
  await openMakerPosition(perp);
}

main();