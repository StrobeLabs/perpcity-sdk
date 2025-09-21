import { Position } from '../dist';
import { setup } from './setup';

export async function closePosition(position: Position) : Promise<Position | null> {
  const result = await position.closePosition({
    maxAmt1In: 1000000,
    minAmt0Out: 0,
    minAmt1Out: 0
  });

  if (result === null) {
    console.log('Taker Position Closed');
    console.log('Taker Position ID:', position.positionId);
    console.log
    return null;
  } else {
    console.log('Maker Position Closed');
    console.log('Maker Position ID:', position.positionId);
    console.log('Taker Position Opened');
    console.log('Taker Position ID: ', result);
    console.log();
    return result;
  }
}

async function main() {
  const perpManager = setup();
  const position = new Position(perpManager.context, "0xa48739b2be87ca2b84fbe9eb6bba0412dc53f501bd887a0a3ed1533ce5696097", 2n);
  await closePosition(position);
}
  
main();