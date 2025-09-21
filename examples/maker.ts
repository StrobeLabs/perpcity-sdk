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
  const perp = new Perp(perpManager.context, "0xa48739b2be87ca2b84fbe9eb6bba0412dc53f501bd887a0a3ed1533ce5696097");
  await openMakerPosition(perp);
}

main();