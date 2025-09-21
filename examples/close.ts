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
    console.log('Taker Position ID:', this.positionId);
    console.log
    return null;
  } else {
      console.log('Maker Position Closed');
      console.log('Maker Position ID:', this.positionId);
      console.log('Taker Position Opened');
      console.log('Taker Position ID: ', result);
      console.log();
  }

  return result;
}

async function main() {
  const perpManager = setup();
  const position = new Position(perpManager.context, "0xc60199e01fb787c8b26c769de0accc577474fffcc2ed150ea665a92d83fb2830", 2n);
  await closePosition(position);
}
  
main();