import type { Address, Hex } from 'viem';
import { createPerp, type PerpAddress, type PerpCityContext } from '../dist';
import { setup } from './setup';

/**
 * Creates a new v1 market via PerpFactory. The beacon (BEACON_ADDRESS) must be a
 * v1 beacon with an index newer than `latency` seconds: the factory reads it.
 */
export async function createMarket(context: PerpCityContext): Promise<PerpAddress> {
  const owner = context.walletClient.account?.address;
  if (!owner) throw new Error('Wallet account is required');

  const perpAddress = await createPerp(context, {
    owner: owner as Address,
    governor: owner as Address,
    beacon: process.env.BEACON_ADDRESS as Address,
    emaWindow: 900,
    latency: 3600,
    salt: `0x${'0'.repeat(64)}` as Hex,
    withdrawalConfig: {
      capacity: 100_000_000_000n, // $100k instant-withdrawal burst
      refillPerSecond: 1_000_000n, // $1 per second
      challengeWindow: 86_400, // 1 day claim delay
    },
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
