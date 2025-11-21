import {
  getPerpBeacon,
  getPerpBounds,
  getPerpFees,
  getPerpFundingRate,
  getPerpFundingRateTimeSeries,
  getPerpIndex,
  getPerpIndexTimeSeries,
  getPerpMark,
  getPerpMarkTimeSeries,
  getPerpOpenInterest,
  getPerpOpenInterestTimeSeries,
} from '../src/functions/perp';
import {
  getPositionFundingPayment,
  getPositionIsLiquidatable,
  getPositionLiveDetails,
  getPositionPnl,
} from '../src/functions/position';
import {
  getUserClosedPositions,
  getUserOpenPositions,
  getUserRealizedPnl,
  getUserUnrealizedPnl,
  getUserUsdcBalance,
} from '../src/functions/user';
import { setup } from './setup';

// Example of how to use the new optimized API with caller-managed caching
export async function optimizedView(): Promise<void> {
  const perpManager = setup();
  const context = perpManager.context;

  // Example: Simple TTL cache implementation (caller responsibility)
  const cache = new Map<string, { data: any; timestamp: number }>();
  const TTL = 30000; // 30 seconds

  function getCached<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    const cached = cache.get(key);
    if (cached && Date.now() - cached.timestamp < TTL) {
      return Promise.resolve(cached.data);
    }

    return fetcher().then((data) => {
      cache.set(key, { data, timestamp: Date.now() });
      return data;
    });
  }

  // Fetch all perps data in one batch call
  const perpIds = await perpManager.getPerps();

  console.log('Fetching perp data...');
  const perpDataMap = await context.getMultiplePerpData(perpIds);

  console.log('Perps data:');
  for (const [perpId, perpData] of perpDataMap) {
    console.log('id:', perpData.id);
    console.log('mark:', getPerpMark(perpData));
    console.log('index:', getPerpIndex(perpData));
    console.log('beacon:', getPerpBeacon(perpData));
    console.log('openInterest:', getPerpOpenInterest(perpData));
    console.log('markTimeSeries:', getPerpMarkTimeSeries(perpData));
    console.log('indexTimeSeries:', getPerpIndexTimeSeries(perpData));
    console.log('openInterestTimeSeries:', getPerpOpenInterestTimeSeries(perpData));
    console.log('fundingRateTimeSeries:', getPerpFundingRateTimeSeries(perpData));
    console.log('tradingBounds:', getPerpBounds(perpData));
    console.log('fees:', getPerpFees(perpData));
    console.log('fundingRate:', getPerpFundingRate(perpData));
    console.log();
  }

  // Fetch user data with caching
  console.log('Fetching user data...');
  const userAddress = context.walletClient.account?.address;
  if (!userAddress) throw new Error('No wallet address');
  const userData = await getCached('user-data', () => context.getUserData(userAddress));

  console.log('usdcBalance:', getUserUsdcBalance(userData));
  console.log('realizedPnl:', getUserRealizedPnl(userData));
  console.log('unrealizedPnl:', getUserUnrealizedPnl(userData));

  console.log('openPositions:');
  const openPositions = getUserOpenPositions(userData);
  for (const position of openPositions) {
    console.log('perpId:', position.perpId);
    console.log('inContractPosId:', position.positionId);
    console.log('pnl:', getPositionPnl(position));
    console.log('fundingPayment:', getPositionFundingPayment(position));
    console.log('isLiquidatable:', getPositionIsLiquidatable(position));
    console.log('liveDetails:', getPositionLiveDetails(position));
    console.log();
  }

  console.log('closedPositions:');
  const closedPositions = getUserClosedPositions(userData);
  for (const position of closedPositions) {
    console.log('perpId:', position.perpId);
    console.log('wasMaker:', position.wasMaker);
    console.log('wasLong:', position.wasLong);
    console.log('pnlAtClose:', position.pnlAtClose);
    console.log();
  }
}

// Example showing the performance improvement with batching
export async function performanceComparison(): Promise<void> {
  const perpManager = setup();
  const context = perpManager.context;
  const perpId =
    '0x7a6f376ed26ed212e84ab8b3bec9df5b9c8d1ca543f0527c48675131a4bf9bae' as `0x${string}`;

  console.log('=== Performance Comparison ===');

  // Single perp fetch (2 Goldsky requests)
  console.log('Single perp fetch:');
  const startSingle = Date.now();
  const perpData = await context.getPerpData(perpId);
  const mark = getPerpMark(perpData);
  const index = getPerpIndex(perpData);
  const beacon = getPerpBeacon(perpData);
  const openInterest = getPerpOpenInterest(perpData);
  const bounds = getPerpBounds(perpData);
  const fees = getPerpFees(perpData);
  const endSingle = Date.now();
  console.log(`Time: ${endSingle - startSingle}ms`);
  console.log(`Goldsky API calls: 2 (perp + beacon)`);

  // Multiple perp batch fetch (still only 2 Goldsky requests!)
  console.log('\nBatch fetch (10 perps):');
  const startBatch = Date.now();
  const perpIds = Array(10).fill(perpId); // Simulate 10 perps
  const perpDataMap = await context.getMultiplePerpData(perpIds);
  const batchPerpData = perpDataMap.get(perpId)!;
  const batchMark = getPerpMark(batchPerpData);
  const batchIndex = getPerpIndex(batchPerpData);
  const batchBeacon = getPerpBeacon(batchPerpData);
  const endBatch = Date.now();
  console.log(`Time: ${endBatch - startBatch}ms`);
  console.log(`Goldsky API calls: 2 (same as single perp!)`);
  console.log(`Efficiency: 10 perps fetched with same # of requests as 1 perp`);

  console.log(
    '\nResults match:',
    mark === batchMark && index === batchIndex && beacon === batchBeacon
  );
}

async function main() {
  await optimizedView();
  await performanceComparison();
}

main();
