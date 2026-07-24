# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.17.0] - 2026-07-24

### Added

- `walkPoolDepth(...)` — the pool's one-sided depth as per-region rows: the same tick walk as
  `maxFillablePerpDelta`, emitting each constant-liquidity region (`DepthRegion`: price bounds,
  terminating tick, active liquidity, perp and USD legs) instead of a single sum. Feeds order
  book style depth displays. Amount rounding matches `computeSwapStepToken0` at tick boundaries,
  so cumulative USD over a prefix of regions reproduces `simulateTakerSwapExact` to the wei;
  per-side totals equal `maxFillablePerpDelta` exactly. Zero-liquidity regions are skipped.
  Freshness is not checked — callers should `assertTickMapFresh` first.

## [0.16.0] - 2026-07-10

### Added

- Exact multi-tick taker swap simulation. `simulateTakerSwap` assumes the pool's current active
  liquidity holds across the whole trade, which is wrong in both directions once an order crosses
  an initialized tick: bands of liquidity above spot make real fills cheaper than the flat model
  predicts, while the band's edge means the pool runs dry far sooner (the flat model quoted orders
  that revert on-chain with `InsufficientLiquidityToFill`). A perp's fill is settled by a real
  Uniswap v4 `PoolManager.swap` against a hookless fee-0 pool, so the exact fill is reproduced by
  walking the same ticks the chain walks:
  - `tickMath.ts` — exact bigint port of `TickMath.getSqrtPriceAtTick`.
  - `swapMath.ts` — `SqrtPriceMath` / `SwapMath` primitives, zero-fee token0-specified paths.
  - `swapExact.ts` — `simulateTakerSwapExact` (differential-tested to the wei against Uniswap's
    live V4Quoter), `maxFillablePerpDelta`, `activeLiquidityAt`, `assertTickMapFresh`, and
    `StaleTickMapError` for maps invalidated by LP mints/burns.
  - `poolTicks.ts` — `fetchPoolTickMap` reads every initialized tick straight from the
    `PoolManager` via two batched `extsload` `eth_call`s (tick bitmap words, then tick info).

## [0.15.0] - 2026-07-10

### Changed

- `simulateTakerSwap` now takes an optional `feeRate` and returns fee-inclusive
  `effectiveFillPrice` / `effectiveUsdDelta` alongside the raw curve `fillPrice` / `usdDelta`,
  so callers can separate price impact from fees. Direction is side-signed: long `*(1+feeRate)`,
  short `*(1-feeRate)`. Previously the displayed price impact understated the true cost by the
  pool fee bps on every trade.
- New `totalTakerFeeRate(fees)` (creator + insurance + LP) wired into `estimateTakerPosition` /
  `estimateTakerAdjust`.
- New `liquidityLimited` flag: the single-region simulation understates impact once a trade
  crosses an initialized tick; set when the swap moves the pool price past
  `APPROX_TICK_CROSS_WARN_FRACTION` so UIs can warn. Raw `fillPrice` / `usdDelta` /
  `exceedsLiquidity` and `calculateTakerSlippageLimit` are unchanged.

## [0.14.1] - 2026-07-09

Re-release of 0.14.0. The 0.14.0 GitHub Release failed to publish (the npm-publish
workflow ran on Node 20, which `npm@latest` had just dropped), and immutable
releases reserve the `v0.14.0` tag permanently, so the fixed pipeline ships under
0.14.1. No source changes from 0.14.0 — same completed `PERP_ABI`.

## [0.14.0] - 2026-07-09

Never published to npm (release-pipeline failure; see 0.14.1).

### Added

- `PERP_ABI` now includes all 20 Perp trade/position "free events" — `TakerOpened`,
  `TakerAdjusted`, `TakerClosed`, `TakerBackstopped`, `MakerOpened`, `MakerAdjusted`,
  `MakerClosed`, `MakerConverted`, `MakerBackstopped`, plus the pool/market-state and
  tick events (`MarginTransferred`, `OpenInterestUpdated`, `RatesAndEmasRefreshed`,
  `CumulativesAccrued`, `CapacityUpdated`, `Donated`, `LossSocialized`, `BadDebtAccounted`,
  `TickInitialized`, `TickDeleted`, `TicksCrossed`). These are Solidity "free events" that
  `forge inspect` omits, so every forge-derived copy of the ABI was previously missing them.
  Consumers can now `decodeEventLog({ abi: PERP_ABI, ... })` on any Perp trade log. The
  definitions are vendored from the deployed v0.1.0 contract, not from the contracts repo's
  Foundry output (now v0.2.x, where several of these signatures have drifted).

## [0.13.0] - 2026-07-08

### Changed

- Adjusted primitives to support position adjustment.

## [0.12.0] - 2026-07-06

### Changed

- The public client now enables viem's client-level `batch.multicall`: concurrent `readContract`
  reads (e.g. the 7 config reads in `getPerpConfig` and the 4 in `fetchPerpContractData`) are
  aggregated into a single Multicall3 `aggregate3` `eth_call` instead of a JSON-RPC batch of N
  requests, cutting billed RPC calls roughly in proportion to the read fan-out. Transport-level
  HTTP batching is kept for requests multicall cannot aggregate (`simulateContract`, calls with
  an account or value). On chains without a Multicall3 deployment configured (e.g. bare Anvil
  test chains) viem falls back to individual `eth_call`s automatically.
- The `estimateLiquidity` margin-check probe opts out of multicall aggregation (`batch: false`)
  so its revert-marker classification keeps seeing the same inner `msg.sender` as before.

## [0.11.0] - 2026-07-03

### Changed

- **Breaking:** `estimateLiquidity` now requires the perp address as its second argument:
  `estimateLiquidity(context, perpAddress, tickLower, tickUpper, usdScaled)`.
- `estimateLiquidity` now sizes liquidity to the on-chain maker margin check instead of the naive
  amount1 formula. The old formula targeted a notional exactly equal to the margin, which the
  contract's rounding (amounts pulled rounded up, position value floored) pushed 1-2 units past the
  100% maker initial margin ratio, so `openMaker` reverted with `MarginRatioTooLow`. The estimate
  now:
  - values below-range positions exactly, replicating the contract rounding (max healthy liquidity
    is `floor((margin - 2) * Q96 / sqrtPriceDiff)`, validated against mainnet);
  - values straddling and above-range positions at the larger of the AMM price and beacon index
    (ranges above the current price were previously sized as USD exposure and always reverted);
  - verifies the result with an `eth_call` simulation of `openMaker` and bisects down to the true
    boundary when the mark price sits above both proxies.
- `getSqrtRatioAtTick` now rounds up the final shift to match the contract's TickMath.

## [0.10.0] - 2026-06-16

### Changed

- `estimateTakerPosition` now returns a price-impacted quote instead of the flat mark price. It
  simulates the exact-perp-in swap against the pool curve, so `fillPrice` and `usdDelta` reflect the
  real cost of the order. `usdDelta` is now suitable to feed into `calculateTakerSlippageLimit` for
  an `amt1Limit` that won't spuriously revert with `MaxAmtExceeded` on shallow pools.
  - This is a single active-liquidity-region approximation: exact while the swap stays within the
    current tick, and an approximation (understating impact) once it would cross an initialized tick,
    because only the pool's current active `liquidity` is available — not the full per-tick map.
  - New `exceedsLiquidity: boolean` field on `EstimateTakerPositionResult`, set when the order is
    larger than the constant-liquidity region can fill — a strong signal the on-chain swap would
    revert with `PriceImpactTooHigh`. Surface it before submitting.

### Added

- `PerpData` now exposes `sqrtPriceX96` and `liquidity` from `poolState` (previously fetched and
  discarded), so callers can drive swap simulation without extra RPC reads.
- `simulateTakerSwap(...)` utility — the constant-liquidity exact-perp-in swap math behind
  `estimateTakerPosition`, exported for callers that already hold pool state.

## [0.9.0] - 2026-06-15

### Added

- Calldata builders for callers that submit transactions themselves (e.g. batching into an
  ERC-4337 userOperation) instead of letting the SDK execute via `walletClient.writeContract`.
  Each mirrors the argument encoding of its execute-and-wait counterpart, so a built call hits the
  same contract path; fee headroom is omitted because userOp gas is handled by the bundler/paymaster.
  - `buildApproveUsdcCall(context, amount, spender)` — ERC-20 `approve` on the configured USDC.
  - `buildOpenTakerPositionCall(context, perpAddress, params)` — `Perp.openTaker`.
  - `buildOpenMakerPositionCall(context, perpAddress, params)` — `Perp.openMaker` (async; reads
    `tickSpacing`).
  - `buildAdjustTakerCall` / `buildAdjustMakerCall` — `Perp.adjustTaker` / `Perp.adjustMaker`.
  - `buildClosePositionCall(context, perpAddress, positionId, params)` — async; reads the position
    to pick the maker/taker unwind, mirroring `closePosition`.
  - `buildOpenTakerPositionCalls` / `buildOpenMakerPositionCalls` — full ordered batch that prepends
    a USDC `approve` only when the current allowance is short, the single-userOp equivalent of the
    internal `ensureUsdcAllowance` → open sequence.
- `CallData` type (`{ to, data, value }`) for the builders above.

## [0.8.0] - 2026-06-05

### Added

- `calculateTakerSlippageLimit(quote, isLong, slippagePercent)` — derives the contract-native
  `amt1Limit` for `openTakerPosition` from `usdDelta` (the currency1 / USD leg the contract checks
  in `PerpLogic.checkTakerAmountLimits`): a ceiling on USD paid for longs, a floor on USD received
  for shorts. The slippage math now lives in the SDK instead of being reimplemented per app.

### Changed

- `examples/taker.ts` and `examples/wagmi-integration.ts` use `calculateTakerSlippageLimit` instead
  of inlining the basis-point math.
- Bumped `viem` from `^2.37.8` to `^2.46.1` to align with the client and remove `as never`
  walletClient casts there.
- Switched `tsconfig` `moduleResolution` from `node` to `bundler` so the newer viem's transitive
  `ox` resolves to its bundled declarations (skipped by `skipLibCheck`) instead of its raw `.ts`
  source.

## [0.7.0] - 2026-06-01

### ⚠️ BREAKING CHANGES

Contract-accurate types for the v0.1.0 per-market `Perp` contract model. Fields are now sourced
directly from the on-chain `Position`, `Maker`, and `Rates` structs
(`perpcity-contracts/src/libraries/Structs.sol`).

- `MarginRatios` is now `{ liq, backstop }` (was `{ min, max, liq }`). `liq` maps to the
  `Position.liqMarginRatio` field and `backstop` to `Position.backstopMarginRatio` (both scaled by
  1e6). The previous `min`/`max` were fabricated and have been removed.
- `MakerDetails` removed `unlockTimestamp` (the `Maker` struct has no lockup field, so it was always
  `0`) and added `liquidity` (from `Maker.liquidity`).
- `getFundingRate` returns `fundingPerDayRaw` (signed `int88`, scaled by 1e18 per day) instead of the
  misnamed `rawX96`. The value is already a `bigint`.
- `ClosePositionResult` no longer includes the always-`null` `position` field; it now returns only
  `txHash`.

### Removed

These had no equivalent on-chain surface in the v0.1.0 contracts:

- `LiveDetails` type and on-chain live-detail fetching (PnL / liquidation are computed client-side
  from `PositionRawData`).
- `quoteClosePosition`, `closePositionWithQuote`, `calculateClosePositionParams`.

### Fixed

- `closePosition` reuses the maker `liquidity` already read by `getPositionRawData` instead of
  issuing a second `makerDetails` call.
- `estimateTakerPosition` documents that `fillPrice` is an estimate (current mark, no slippage/fees/
  price impact) and must not be used as an on-chain slippage limit.

### Added

- Unit tests for `unpackBalanceDelta` (int128 edge cases) and `derivePerpDelta` (long/short sign and
  size math).

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

