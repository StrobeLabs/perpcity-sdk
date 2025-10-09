# Migration Guide: From Entity-Based to Functional API

This guide helps you migrate from the old entity-based API to the new optimized functional API.

## Overview

The new API provides significant performance improvements by:
- **Batching API calls**: Fetch related data in single requests instead of multiple separate calls
- **Functional approach**: Pure functions that operate on data instead of instance methods
- **Caller-controlled caching**: You manage caching and refresh strategies
- **Unopinionated design**: No built-in assumptions about caching or refresh patterns

## Performance Benefits

| Operation | Old API | New API | Improvement |
|-----------|---------|---------|-------------|
| Get perp data | 6+ separate API calls | 1 batch call | ~6x faster |
| Get user data | 3+ separate API calls | 1 batch call | ~3x faster |
| Multiple perps | N × 6+ calls | N parallel batch calls | ~6x faster |

## Migration Examples

### Before (Entity-Based API)

```typescript
import { Perp, User } from 'perpcity-sdk';

// Multiple API calls for related data
const perp = new Perp(context, perpId);
const mark = await perp.mark();           // API call 1
const index = await perp.index();         // API call 2
const beacon = await perp.beacon();       // API call 3
const openInterest = await perp.openInterest(); // API call 4
const bounds = await perp.bounds();       // API call 5
const fees = await perp.fees();           // API call 6

// User data also requires multiple calls
const user = new User(context);
const balance = await user.usdcBalance(); // API call 1
const positions = await user.openPositions(); // API call 2
const closedPositions = await user.closedPositions(); // API call 3
```

### After (Functional API)

```typescript
import { 
  GlobalPerpCityContext, 
  getPerpMark, 
  getPerpIndex, 
  getPerpBeacon,
  getPerpOpenInterest,
  getPerpBounds,
  getPerpFees,
  getUserUsdcBalance,
  getUserOpenPositions,
  getUserClosedPositions
} from 'perpcity-sdk';

// Single batch call for all perp data
const globalContext = new GlobalPerpCityContext(context);
const perpData = await globalContext.getPerpData(perpId);

// Pure functions extract data (no API calls)
const mark = getPerpMark(perpData);
const index = getPerpIndex(perpData);
const beacon = getPerpBeacon(perpData);
const openInterest = getPerpOpenInterest(perpData);
const bounds = getPerpBounds(perpData);
const fees = getPerpFees(perpData);

// Single batch call for all user data
const userData = await globalContext.getUserData();

// Pure functions extract data (no API calls)
const balance = getUserUsdcBalance(userData);
const positions = getUserOpenPositions(userData);
const closedPositions = getUserClosedPositions(userData);
```

## Caching Strategy

The new API is unopinionated about caching. You can implement your own caching strategy:

### Simple TTL Cache

```typescript
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

// Usage
const perpData = await getCached(`perp-${perpId}`, () => 
  globalContext.getPerpData(perpId)
);
```

### Using External Cache Libraries

```typescript
import TTLCache from '@isaacs/ttlcache';

const cache = new TTLCache({ ttl: 30000 });

async function getPerpDataCached(perpId: string) {
  const cached = cache.get(perpId);
  if (cached) return cached;
  
  const data = await globalContext.getPerpData(perpId);
  cache.set(perpId, data);
  return data;
}
```

## Function Mapping

### Perp Functions

| Old Method | New Function | Notes |
|------------|--------------|-------|
| `perp.mark()` | `getPerpMark(perpData)` | Pure function |
| `perp.index()` | `getPerpIndex(perpData)` | Pure function |
| `perp.beacon()` | `getPerpBeacon(perpData)` | Pure function |
| `perp.openInterest()` | `getPerpOpenInterest(perpData)` | Pure function |
| `perp.bounds()` | `getPerpBounds(perpData)` | Pure function |
| `perp.fees()` | `getPerpFees(perpData)` | Pure function |
| `perp.fundingRate()` | `getPerpFundingRate(perpData)` | Pure function |
| `perp.markTimeSeries()` | `getPerpMarkTimeSeries(perpData)` | Pure function |
| `perp.indexTimeSeries()` | `getPerpIndexTimeSeries(perpData)` | Pure function |
| `perp.openInterestTimeSeries()` | `getPerpOpenInterestTimeSeries(perpData)` | Pure function |
| `perp.fundingRateTimeSeries()` | `getPerpFundingRateTimeSeries(perpData)` | Pure function |

### User Functions

| Old Method | New Function | Notes |
|------------|--------------|-------|
| `user.usdcBalance()` | `getUserUsdcBalance(userData)` | Pure function |
| `user.openPositions()` | `getUserOpenPositions(userData)` | Pure function |
| `user.closedPositions()` | `getUserClosedPositions(userData)` | Pure function |
| `user.realizedPnl()` | `getUserRealizedPnl(userData)` | Pure function |
| `user.unrealizedPnl()` | `getUserUnrealizedPnl(userData)` | Pure function |

### Position Functions

| Old Method | New Function | Notes |
|------------|--------------|-------|
| `position.liveDetails()` | `getPositionLiveDetails(positionData)` | Pure function |
| `position.liveDetails().pnl` | `getPositionPnl(positionData)` | Pure function |
| `position.liveDetails().fundingPayment` | `getPositionFundingPayment(positionData)` | Pure function |
| `position.liveDetails().isLiquidatable` | `getPositionIsLiquidatable(positionData)` | Pure function |

## Write Operations

Write operations still use the original entities:

```typescript
// Write operations remain the same
const perp = new Perp(context, perpId);
const position = await perp.openMakerPosition(params);

// Or use the functional approach for write operations
import { openMakerPosition } from 'perpcity-sdk';
const position = await openMakerPosition(globalContext, perpId, params);
```

## Batch Operations

The new API supports efficient batch operations:

```typescript
// Fetch multiple perps in parallel
const perpIds = ['0x123', '0x456', '0x789'];
const perpDataList = await globalContext.getMultiplePerpData(perpIds);

// Process all perps
perpDataList.forEach(perpData => {
  console.log(`Perp ${perpData.id}: mark=${getPerpMark(perpData)}`);
});
```

## Migration Checklist

- [ ] Replace entity instantiation with `GlobalPerpCityContext`
- [ ] Replace method calls with data fetching + pure functions
- [ ] Implement your preferred caching strategy
- [ ] Update error handling (functions throw instead of returning undefined)
- [ ] Test performance improvements
- [ ] Update any custom logic that depended on entity methods

## Backward Compatibility

The old entity-based API remains available during the transition period. You can migrate incrementally:

1. Start with read-heavy operations
2. Keep write operations using entities
3. Gradually migrate to the functional API
4. Remove old entity usage once fully migrated

## Performance Tips

1. **Batch related data**: Use `getMultiplePerpData()` for multiple perps
2. **Cache strategically**: Cache at the data level, not the function level
3. **Parallel fetching**: Fetch user and perp data in parallel when possible
4. **Selective updates**: Only refresh data that has changed

## Support

For questions or issues during migration, please:
1. Check the examples in `/examples/optimized-view.ts`
2. Review the test cases in `/src/__tests__/`
3. Open an issue with your specific use case
