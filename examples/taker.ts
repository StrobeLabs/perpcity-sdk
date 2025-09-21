import { setup } from './setup';
import { Perp, Position } from '../dist';

export async function openTakerPosition(perp: Perp) : Promise<Position> {
  const takerPosition = await perp.approveAndOpenTakerPosition({
    isLong: true,
    margin: 50,
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
  const perp = new Perp(perpManager.context, "0xa48739b2be87ca2b84fbe9eb6bba0412dc53f501bd887a0a3ed1533ce5696097");
  await openTakerPosition(perp);
}

main();