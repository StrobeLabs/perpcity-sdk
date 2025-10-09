import { setup } from './setup';
import { GlobalPerpCityContext } from '../src/context/global-context';
import { 
  getPerpMark, 
  getPerpIndex, 
  getPerpBeacon, 
  getPerpOpenInterest,
  getPerpBounds,
  getPerpFees,
  getPerpFundingRate,
  getPerpMarkTimeSeries,
  getPerpIndexTimeSeries,
  getPerpOpenInterestTimeSeries,
  getPerpFundingRateTimeSeries
} from '../src/functions/perp-functions';
import { 
  getUserUsdcBalance, 
  getUserOpenPositions, 
  getUserClosedPositions,
  getUserRealizedPnl,
  getUserUnrealizedPnl 
} from '../src/functions/user-functions';
import { 
  getPositionPnl, 
  getPositionFundingPayment,
  getPositionIsLiquidatable,
  getPositionLiveDetails
} from '../src/functions/position-functions';

// Example of how to use the new optimized API with caller-managed caching
export async function optimizedView(): Promise<void> {
  const perpManager = setup();
  const globalContext = new GlobalPerpCityContext(perpManager.context);
  
  // Example: Simple TTL cache implementation (caller responsibility)
  const cache = new Map<string, { data: any; timestamp: number }>();
  const TTL = 30000; // 30 seconds
  
  function getCached<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    const cached = cache.get(key);
    if (cached && Date.now() - cached.timestamp < TTL) {
      return Promise.resolve(cached.data);
    }
    
    return fetcher().then(data => {
      cache.set(key, { data, timestamp: Date.now() });
      return data;
    });
  }

  // Fetch all perps data in one batch call
  const perps = await perpManager.getPerps();
  const perpIds = perps.map(perp => perp.id);
  
  console.log("Fetching perp data...");
  const perpDataList = await globalContext.getMultiplePerpData(perpIds);
  
  console.log("Perps data:");
  for (const perpData of perpDataList) {
    console.log("id:", perpData.id);
    console.log("mark:", getPerpMark(perpData));
    console.log("index:", getPerpIndex(perpData));
    console.log("beacon:", getPerpBeacon(perpData));
    console.log("openInterest:", getPerpOpenInterest(perpData));
    console.log("markTimeSeries:", getPerpMarkTimeSeries(perpData));
    console.log("indexTimeSeries:", getPerpIndexTimeSeries(perpData));
    console.log("openInterestTimeSeries:", getPerpOpenInterestTimeSeries(perpData));
    console.log("fundingRateTimeSeries:", getPerpFundingRateTimeSeries(perpData));
    console.log("tradingBounds:", getPerpBounds(perpData));
    console.log("fees:", getPerpFees(perpData));
    console.log("fundingRate:", getPerpFundingRate(perpData));
    console.log();
  }

  // Fetch user data with caching
  console.log("Fetching user data...");
  const userData = await getCached('user-data', () => globalContext.getUserData());
  
  console.log("usdcBalance:", getUserUsdcBalance(userData));
  console.log("realizedPnl:", getUserRealizedPnl(userData));
  console.log("unrealizedPnl:", getUserUnrealizedPnl(userData));
  
  console.log("openPositions:");
  const openPositions = getUserOpenPositions(userData);
  for (const position of openPositions) {
    console.log("perpId:", position.perpId);
    console.log("inContractPosId:", position.positionId);
    console.log("pnl:", getPositionPnl(position));
    console.log("fundingPayment:", getPositionFundingPayment(position));
    console.log("isLiquidatable:", getPositionIsLiquidatable(position));
    console.log("liveDetails:", getPositionLiveDetails(position));
    console.log();
  }
  
  console.log("closedPositions:");
  const closedPositions = getUserClosedPositions(userData);
  for (const position of closedPositions) {
    console.log("perpId:", position.perpId);
    console.log("wasMaker:", position.wasMaker);
    console.log("wasLong:", position.wasLong);
    console.log("pnlAtClose:", position.pnlAtClose);
    console.log();
  }
}

// Example showing the performance difference
export async function performanceComparison(): Promise<void> {
  const perpManager = setup();
  const globalContext = new GlobalPerpCityContext(perpManager.context);
  const perpId = "0x7a6f376ed26ed212e84ab8b3bec9df5b9c8d1ca543f0527c48675131a4bf9bae";
  
  console.log("=== Performance Comparison ===");
  
  // Old way (multiple API calls)
  console.log("Old way (multiple API calls):");
  const startOld = Date.now();
  const perp = new (await import('../entities/perp')).Perp(perpManager.context, perpId);
  const [mark, index, beacon, openInterest, bounds, fees] = await Promise.all([
    perp.mark(),
    perp.index(),
    perp.beacon(),
    perp.openInterest(),
    perp.bounds(),
    perp.fees(),
  ]);
  const endOld = Date.now();
  console.log(`Time: ${endOld - startOld}ms`);
  console.log(`API calls: ~6 separate calls`);
  
  // New way (single batch call)
  console.log("\nNew way (single batch call):");
  const startNew = Date.now();
  const perpData = await globalContext.getPerpData(perpId);
  const newMark = getPerpMark(perpData);
  const newIndex = getPerpIndex(perpData);
  const newBeacon = getPerpBeacon(perpData);
  const newOpenInterest = getPerpOpenInterest(perpData);
  const newBounds = getPerpBounds(perpData);
  const newFees = getPerpFees(perpData);
  const endNew = Date.now();
  console.log(`Time: ${endNew - startNew}ms`);
  console.log(`API calls: 1 batch call`);
  
  console.log("\nResults match:", 
    mark === newMark && 
    index === newIndex && 
    beacon === newBeacon
  );
}

async function main() {
  await optimizedView();
  await performanceComparison();
}

main();
