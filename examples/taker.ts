import { setup } from './setup';
import { createPerp } from './create-perp';
import { Perp, Position } from '../dist';

export async function openTakerPosition(perp: Perp) : Promise<Position> {
  const takerPosition = await perp.approveAndOpenTakerPosition({
    isLong: true,
    margin: 10,
    leverage: 1,
    unspecifiedAmountLimit: 0
  });

  console.log('Taker Position Opened');
  console.log('Taker Position ID:', takerPosition.positionId);
  console.log();

  return takerPosition;
}

async function main() {
  const perpManager = setup();
  // const perp = await createPerp(perpManager);
  const perp = new Perp(perpManager.context, "0x89aac1c615f26033b67e6867dca90348e5e3481fb187f0ba901754fc3548b9cf");
  const takerPosition = await openTakerPosition(perp);
}

main();