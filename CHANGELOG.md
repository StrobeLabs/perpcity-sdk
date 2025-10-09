# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2025-10-09

### ⚠️ BREAKING CHANGES

#### Removed Entity-Based API

The entity-based API (`Perp`, `User`, `PerpManager` classes) has been removed in favor of a functional API with optimized batch data fetching.

**Removed Exports:**
- `./entities` - All entity classes (`Perp`, `User`, `PerpManager`)
- `./deployments` - Hardcoded deployment configuration
- `GlobalPerpCityContext` - Merged into main `PerpCityContext`

**New Exports:**
- `./types/entity-data` - Type definitions for perp, user, and position data
- `./functions` - Pure functions and utilities for working with SDK data

#### Migration Guide

##### Configuration Changes

**Before (v0.1.x):**
```typescript
import { PerpCityContext } from '@strobelabs/perpcity-sdk';

const context = new PerpCityContext({
  walletClient,
  goldskyBearerToken: 'token',
});
// Chain ID automatically determined deployments
```

**After (v0.2.x):**
```typescript
import { PerpCityContext } from '@strobelabs/perpcity-sdk';

const context = new PerpCityContext({
  walletClient,
  goldskyBearerToken: process.env.GOLDSKY_BEARER_TOKEN,
  goldskyEndpoint: process.env.GOLDSKY_ENDPOINT,
  deployments: {
    perpManager: process.env.PERP_MANAGER_ADDRESS as `0x${string}`,
    usdc: process.env.USDC_ADDRESS as `0x${string}`,
  },
});
```

**Required Environment Variables:**
- `GOLDSKY_ENDPOINT` - GraphQL API endpoint
- `GOLDSKY_BEARER_TOKEN` - Authentication token
- `PERP_MANAGER_ADDRESS` - Contract address
- `USDC_ADDRESS` - USDC token address

##### Entity to Functional API Migration

**Before (v0.1.x) - Entity-based API:**
```typescript
import { Perp, User, PerpManager } from '@strobelabs/perpcity-sdk';

// Perp operations
const perp = new Perp(context, perpId);
const mark = await perp.mark();
const index = await perp.index();
const bounds = await perp.bounds();

// User operations  
const user = new User(context);
const balance = await user.usdcBalance();
const positions = await user.openPositions();

// Manager operations
const perpManager = new PerpManager(context);
const allPerps = await perpManager.getPerps();
```

**After (v0.2.x) - Functional API with Batch Fetching:**
```typescript
import { 
  getPerpMark,
  getPerpIndex, 
  getPerpBounds,
  getUserUsdcBalance,
  getUserOpenPositions,
  getPerps
} from '@strobelabs/perpcity-sdk';

// Fetch all perp data in one optimized batch call
const perpData = await context.getPerpData(perpId);

// Use pure functions to extract data (no API calls)
const mark = getPerpMark(perpData);
const index = getPerpIndex(perpData);
const bounds = getPerpBounds(perpData);

// Fetch all user data in one batch call
const userAddress = context.walletClient.account.address;
const userData = await context.getUserData(userAddress);

// Use pure functions to extract data
const balance = getUserUsdcBalance(userData);
const positions = getUserOpenPositions(userData);

// Fetch all perps
const allPerps = await getPerps(context);
```

##### Batch Fetching Multiple Perps

**New in v0.2.x - Optimized for rate limits:**
```typescript
// Old way: 2N Goldsky requests for N perps
// Would hit rate limit at 10 perps (20 requests)

// New way: Only 2 Goldsky requests for ANY number of perps!
const perpIds = [perp1, perp2, perp3, ...perp50];
const perpDataMap = await context.getMultiplePerpData(perpIds);

// Access individual perp data
const perp1Data = perpDataMap.get(perp1);
console.log(getPerpMark(perp1Data));
```

##### Working with OpenPosition

**Before (v0.1.x):**
```typescript
import { OpenPosition } from '@strobelabs/perpcity-sdk';

const position = new OpenPosition(context, perpId, positionId);
const details = await position.liveDetails();
```

**After (v0.2.x):**
```typescript
import { OpenPosition } from '@strobelabs/perpcity-sdk';

// OpenPosition class still exists for write operations
const position = new OpenPosition(context, perpId, positionId, isLong, isMaker);
const details = await position.liveDetails();

// Or fetch via context (includes isLong and isMaker)
const positionData = await context.getOpenPositionData(perpId, positionId);
```

### Added

- ✅ **True Batch Fetching**: Reduced Goldsky API requests from 2N to 2 for N perps (90-98% reduction)
- ✅ **Functional API**: Pure functions for data extraction with zero API overhead
- ✅ **Smart Beacon Deduplication**: Fetches each unique beacon only once
- ✅ **Environment-based Configuration**: No hardcoded addresses, full control over deployments
- ✅ **Comprehensive Type Definitions**: All data types exported from `./types/entity-data`
- ✅ **Improved Error Handling**: Better transaction error messages and validations
- ✅ **CI/CD Pipeline**: Automated build and test checks via GitHub Actions
- ✅ **Empty Snapshot Guards**: Clear error messages for perps with no trading activity

### Fixed

- Fixed `isLong` and `isMaker` fields in `getOpenPositionData()`
- Fixed timestamp type assertions (Goldsky returns strings, not bigints)
- Fixed `tickSpacing` conversion to actual number
- Normalized GraphQL `inContractPosId` to bigint for contract calls
- Added robust transaction error handling in `closePosition()`
- Fixed e2e tests to use real perp IDs from Goldsky

### Changed

- `PerpCityContext` constructor now requires `goldskyEndpoint` and `deployments` parameters
- `getMultiplePerpData()` now returns a `Map<Hex, PerpData>` instead of array
- `getPerps()` returns `Hex[]` instead of `Perp[]` objects

## [0.1.8] - 2025-10-09

### Changed
- Internal refactoring and dependency updates

## [0.1.7] - 2025-10-09

### Added
- Initial release with entity-based API

