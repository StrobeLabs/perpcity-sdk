import { setup } from './setup';
import { createPerp } from './create-perp';
import { Perp, Position } from '../dist';

export async function openMakerPosition(perp: Perp) : Promise<Position> {
  const makerPosition = await perp.approveAndOpenMakerPosition({
    margin: 100,
    priceLower: 49,
    priceUpper: 51,
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
  // const perp = await createPerp(perpManager);
  const perp = new Perp(perpManager.context, "0x89aac1c615f26033b67e6867dca90348e5e3481fb187f0ba901754fc3548b9cf");
  const makerPosition = await openMakerPosition(perp);
}

main();