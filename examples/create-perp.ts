import { setup } from './setup';
import { Perp, PerpManager } from '../dist';

export async function createPerp(perpManager: PerpManager) : Promise<Perp> {
  const perp = await perpManager.createPerp({
    startingPrice: 50.0,
    beacon: '0x7eb9ab957d417cd2c1923bd6a8d07ff94656d056'
  });

  console.log('Perp Created');
  console.log('Perp ID:', perp.id);
  console.log();

  return perp;
}

async function main() {
    const perpManager = setup();
    const perp = await createPerp(perpManager);
}

main();