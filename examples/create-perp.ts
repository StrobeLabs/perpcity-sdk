import type { Address, Hex } from 'viem';
import { createPerp, type PerpAddress, type PerpCityContext } from '../dist';
import { setup } from './setup';

/**
 * Creates a new Perp market via PerpFactory. Requires PERP_FACTORY_ADDRESS plus
 * the module addresses (or pass them explicitly here) in the environment.
 */
export async function createMarket(context: PerpCityContext): Promise<PerpAddress> {
  const owner = context.walletClient.account?.address;
  if (!owner) throw new Error('Wallet account is required');

  const perpAddress = await createPerp(context, {
    owner: owner as Address,
    name: 'Example Perp',
    symbol: 'EXMPL',
    tokenUri: '',
    beacon: '0x7eb9ab957d417cd2c1923bd6a8d07ff94656d056' as Address,
    emaWindow: 900,
    salt: `0x${'0'.repeat(64)}` as Hex,
    // Module addresses fall back to the deployment config when omitted.
  });

  console.log('Perp Created');
  console.log('Perp address:', perpAddress);
  console.log();

  return perpAddress;
}

async function main() {
  const { context } = setup();
  await createMarket(context);
}

main();
