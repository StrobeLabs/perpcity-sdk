import {
  getFundingRate,
  getIndexValue,
  getPerpBeacon,
  getPerpBounds,
  getPerpFees,
  getPerpMark,
  getPerpTickSpacing,
  getUserOpenPositions,
  getUserUsdcBalance,
} from '../dist';
import { setup } from './setup';

/**
 * Read-side example with caller-managed caching.
 *
 * In the v0.1.0 model each market is its own `Perp` contract, so reads are keyed
 * by perp address. The PerpCityContext already batches its per-perp RPC calls
 * (transport `batch: true`); this example layers a simple TTL cache on top for
 * values you read repeatedly in a UI.
 */
export async function optimizedView(): Promise<void> {
  const { context, perpId } = setup();

  const cache = new Map<string, { data: unknown; timestamp: number }>();
  const TTL = 30_000; // 30 seconds

  function getCached<T>(key: string, fetcher: () => Promise<T>, now: number): Promise<T> {
    const cached = cache.get(key);
    if (cached && now - cached.timestamp < TTL) {
      return Promise.resolve(cached.data as T);
    }
    return fetcher().then((data) => {
      cache.set(key, { data, timestamp: now });
      return data;
    });
  }

  const now = Date.now();

  // Perp market data (cached).
  const perpData = await getCached(`perp:${perpId}`, () => context.getPerpData(perpId), now);
  console.log('Perp data:');
  console.log('  id:', perpData.id);
  console.log('  mark:', getPerpMark(perpData));
  console.log('  beacon:', getPerpBeacon(perpData));
  console.log('  tickSpacing:', getPerpTickSpacing(perpData));
  console.log('  bounds:', getPerpBounds(perpData));
  console.log('  fees:', getPerpFees(perpData));

  // On-chain reads that are not part of PerpData.
  const funding = await getFundingRate(context, perpId);
  console.log('  fundingRate %/day:', funding.ratePerDay);
  console.log('  fundingPerDayRaw:', funding.fundingPerDayRaw.toString());
  console.log('  index:', (await getIndexValue(context, perpId)).toString());
  console.log();

  // User data. Position metadata (perp address + position id + side) is tracked
  // by the caller from open transactions; pass [] when you only need balances.
  const userAddress = context.walletClient.account?.address;
  if (!userAddress) throw new Error('No wallet address');

  const userData = await context.getUserData(userAddress, []);
  console.log('usdcBalance:', getUserUsdcBalance(userData));

  console.log('openPositions:');
  for (const position of getUserOpenPositions(userData)) {
    console.log('  perpId:', position.perpId);
    console.log('  positionId:', position.positionId.toString());
    console.log('  isLong:', position.isLong);
    console.log('  isMaker:', position.isMaker);

    // Raw on-chain position state (margin, entry deltas, margin ratios).
    const raw = await context.getPositionRawData(position.perpId, position.positionId);
    console.log('  margin:', raw.margin);
    console.log('  marginRatios:', raw.marginRatios);
    console.log();
  }
}

async function main() {
  await optimizedView();
}

main();
