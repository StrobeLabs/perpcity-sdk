# Testing Documentation

This document summarizes all bugs found during comprehensive SDK testing and provides guidance on running tests.

## Test Coverage Summary

- **Total Tests**: 106 passing
- **Unit Tests**: 91 tests
  - Conversion functions: 52 tests
  - Liquidity calculations: 23 tests
  - Error handling: 16 tests
- **Integration Tests**: Planned (see below)

## Bugs Discovered

### CRITICAL BUGS

#### 1. Placeholder Values for Fees and Margin Ratios
**Location**: `src/context.ts:100-118`

**Issue**: The SDK hardcodes placeholder values instead of fetching actual values from contract modules:

```typescript
bounds: {
  minMargin: 10, // Placeholder - should fetch from cfg.marginRatios contract
  minTakerLeverage: 1.1,
  maxTakerLeverage: 20,
},
fees: {
  creatorFee: 0.0001, // Placeholder - should fetch from cfg.fees contract
  insuranceFee: 0.0001,
  lpFee: 0.0003,
  liquidationFee: 0.01,
},
```

**Impact**:
- SDK may show incorrect leverage limits to users
- Fee calculations displayed may not match actual on-chain fees
- Transactions could fail if actual bounds differ from placeholders

**Test**: Not directly testable without module ABIs

**Workaround**: Values are enforced on-chain, so transactions will revert with proper errors. Actual margin ratios ARE embedded in position structs after creation.

**Recommended Fix**:
- Option 1: Fetch from module contracts (requires module ABIs)
- Option 2: Document clearly that these are approximate/example values
- Option 3: Remove these from SDK and only show values from existing positions

---

#### 2. Division by Zero in `marginRatioToLeverage()`
**Location**: `src/utils/conversions.ts:44-46`

**Issue**: No validation for zero margin ratio:

```typescript
export function marginRatioToLeverage(marginRatio: number): number {
  return NUMBER_1E6 / marginRatio; // ← No check for marginRatio === 0
}
```

**Impact**: Returns `Infinity` instead of throwing a proper error

**Test**: `src/__tests__/unit/conversions.test.ts:367-376`

**Recommended Fix**:
```typescript
export function marginRatioToLeverage(marginRatio: number): number {
  if (marginRatio <= 0) {
    throw new ValidationError('Margin ratio must be greater than 0');
  }
  return NUMBER_1E6 / marginRatio;
}
```

---

### HIGH PRIORITY BUGS

#### 3. Overflow Check Happens After Multiplication in `scaleFromX96()`
**Location**: `src/utils/conversions.ts:24-32`

**Issue**: Overflow detection occurs after potentially problematic multiplication:

```typescript
export function scaleFromX96(valueX96: bigint): number {
  const valueScaled6Decimals = valueX96 * BIGINT_1E6 / Q96; // ← Multiplication first

  if (valueScaled6Decimals > Number.MAX_SAFE_INTEGER) { // ← Check after
    throw new Error('Value too large');
  }

  return Number(valueScaled6Decimals) / NUMBER_1E6;
}
```

**Impact**: While BigInt doesn't overflow in JavaScript, very large inputs could bypass the safety check

**Test**: `src/__tests__/unit/conversions.test.ts:202-212`

**Recommended Fix**: Check `valueX96` bounds before multiplication or reorder operations

---

#### 4. Missing Validation for Negative Prices in `priceToSqrtPriceX96()`
**Location**: `src/utils/conversions.ts:3-10`

**Issue**: Negative prices cause `Math.sqrt()` to return NaN, which throws unclear error:

```typescript
export function priceToSqrtPriceX96(price: number): bigint {
  if (price > Number.MAX_SAFE_INTEGER) {
    throw new Error('Price too large');
  }

  const scaledSqrtPrice: number = Math.sqrt(price) * NUMBER_1E6; // ← NaN if price < 0
  return BigInt(Math.floor(scaledSqrtPrice)) * Q96 / BigInt(NUMBER_1E6);
}
```

**Impact**: Throws `RangeError: The number NaN cannot be converted to a BigInt` instead of clear validation error

**Test**: `src/__tests__/unit/conversions.test.ts:47-54`

**Recommended Fix**:
```typescript
if (price <= 0) {
  throw new ValidationError('Price must be positive');
}
if (price > Number.MAX_SAFE_INTEGER) {
  throw new Error('Price too large');
}
```

---

#### 5. Missing Validation in `openTakerPosition()`
**Location**: `src/functions/perp-manager.ts:77-152`

**Issue**: No input validation for critical parameters:
- No check for `params.margin <= 0`
- No check for `params.leverage <= 0` or exceeding maximum
- Could lead to confusing contract errors

**Impact**: Poor user experience - users get contract revert errors instead of clear SDK validation errors

**Test**: Not yet tested (requires integration tests)

**Recommended Fix**: Add validation at SDK level before contract call:
```typescript
if (params.margin <= 0) {
  throw new ValidationError('Margin must be greater than 0');
}
if (params.leverage <= bounds.minTakerLeverage || params.leverage > bounds.maxTakerLeverage) {
  throw new ValidationError(`Leverage must be between ${bounds.minTakerLeverage} and ${bounds.maxTakerLeverage}`);
}
```

---

#### 6. Missing Validation in `openMakerPosition()`
**Location**: `src/functions/perp-manager.ts:154-240`

**Issue**: No validation for:
- `priceLower < priceUpper`
- `margin <= 0`
- `liquidity <= 0`

**Impact**: Contract will revert with unclear errors

**Test**: Not yet tested (requires integration tests)

**Recommended Fix**: Add validation before contract call

---

### MEDIUM PRIORITY BUGS

#### 7. Silent Tick Alignment in `openMakerPosition()`
**Location**: `src/functions/perp-manager.ts:170-176`

**Issue**: Ticks are silently aligned to tick spacing without warning:

```typescript
const tickSpacing = perpData.tickSpacing;
const alignedTickLower = Math.floor(tickLower / tickSpacing) * tickSpacing;
const alignedTickUpper = Math.ceil(tickUpper / tickSpacing) * tickSpacing;
```

**Impact**: User's actual price range may differ significantly from requested range, especially with large tick spacing

**Test**: Not yet tested

**Recommended Fix**:
- Calculate price impact of alignment
- Warn or throw if alignment changes prices by more than a threshold
- Return both requested and actual ranges to user

---

#### 8. Division by Zero in `estimateLiquidity()`
**Location**: `src/utils/liquidity.ts:10-24`

**Issue**: No validation for `tickLower == tickUpper`:

```typescript
const sqrtPriceDiff = sqrtPriceUpperX96 - sqrtPriceLowerX96;
const liquidity = (usdScaled * Q96) / sqrtPriceDiff; // ← Division by zero
```

**Impact**: Throws error if same tick provided for both bounds

**Test**: `src/__tests__/unit/liquidity.test.ts:149-161`

**Recommended Fix**:
```typescript
if (tickLower >= tickUpper) {
  throw new ValidationError('tickLower must be less than tickUpper');
}
```

---

#### 9. Invalid Tick Order Not Validated in `estimateLiquidity()`
**Location**: `src/utils/liquidity.ts:10-24`

**Issue**: If `tickLower > tickUpper`, function returns negative liquidity

**Test**: `src/__tests__/unit/liquidity.test.ts:137-148`

**Recommended Fix**: Same as bug #8 - validate tick order

---

### LOW PRIORITY BUGS

#### 10. Cache Never Expires in `PerpCityContext`
**Location**: `src/context.ts:16-23`

**Issue**: Config cache has no TTL or invalidation mechanism:

```typescript
constructor(config: PerpCityContextConfig) {
  this.configCache = new Map(); // ← Never cleared
  // ...
}
```

**Impact**: If perp config changes on-chain (unlikely but possible), SDK will use stale cached values indefinitely

**Test**: Not tested

**Recommended Fix**:
- Add TTL to cache (e.g., 5 minutes)
- Provide manual cache invalidation method
- Or document that cache is persistent for application lifetime

---

#### 11. Missing Negative Amount Handling in `scale6Decimals()`
**Location**: `src/utils/conversions.ts:12-18`

**Issue**: Function allows negative amounts without validation:

```typescript
export function scale6Decimals(amount: number): bigint {
  if (amount > Number.MAX_SAFE_INTEGER / NUMBER_1E6) {
    throw new Error('Amount too large');
  }

  return BigInt(Math.floor(amount * NUMBER_1E6));
}
```

**Impact**: May be intentional for signed values, but should be documented

**Test**: `src/__tests__/unit/conversions.test.ts:97-104`

**Recommended Fix**: Document whether negative values are expected or add validation

---

#### 12. Type Assertion Without Validation in Context
**Location**: `src/context.ts:58-63`

**Issue**: Uses `as any` type assertion:

```typescript
const cfg = await this.walletClient.readContract({
  address: this.deployments().perpManager,
  abi: PERP_MANAGER_ABI,
  functionName: 'cfgs',
  args: [perpId]
}) as any;
```

**Impact**: Runtime type safety not guaranteed

**Test**: Not tested

**Recommended Fix**: Use proper TypeScript typing or runtime validation

---

## Running Tests

### Unit Tests Only

```bash
pnpm run test:unit
```

Runs all unit tests without requiring blockchain connectivity.

### Integration Tests (Requires Testnet Setup)

```bash
# Copy example env file
cp .env.local.example .env.local

# Edit .env.local with your testnet credentials:
# - RPC_URL: Base Sepolia RPC URL
# - PRIVATE_KEY: Test wallet private key
# - PERP_MANAGER_ADDRESS: Deployed PerpManager address
# - USDC_ADDRESS: Testnet USDC address

# Run integration tests
pnpm run test:integration
```

### All Tests

```bash
pnpm run test:all
```

### CI/CD

Tests run automatically in GitHub Actions:
- **Unit tests**: Run on every PR and push (always)
- **Integration tests**: Run on every PR and push when secrets are available
  - ✅ With secrets: Tests execute and must pass
  - ⚠️ Without secrets: Tests are skipped with a warning (external forks)

Required GitHub Secrets for Integration Tests:
- `BASE_SEPOLIA_RPC_URL` - Base Sepolia RPC endpoint
- `TEST_PRIVATE_KEY` - Test wallet private key
- `PERP_MANAGER_ADDRESS` - Deployed PerpManager address
- `USDC_ADDRESS` - Testnet USDC address
- `TEST_PERP_ID` - (Optional) Test perp market ID

See `.github/INTEGRATION_TESTS_SETUP.md` for detailed secret configuration instructions.

---

## Test Organization

```
src/__tests__/
├── setup.ts                          # Unit test setup (mocks console)
├── e2e-setup.ts                      # Integration test setup (loads .env.local)
├── helpers/
│   └── testnet-config.ts            # Testnet configuration helpers
├── unit/
│   ├── conversions.test.ts          # Conversion function tests
│   ├── liquidity.test.ts            # Liquidity calculation tests
│   └── (planned) errors-expanded.test.ts
├── integration/
│   ├── context.test.ts              # Context and data fetching tests
│   ├── approval.test.ts             # USDC approval tests
│   ├── trading.test.ts              # Trading operations tests
│   └── error-scenarios.test.ts      # Contract error scenarios
├── errors.test.ts                   # Error handling unit tests
└── functions.test.ts                # Pure function tests
```

---

## Test Statistics

### Coverage by Category

| Category | Tests | Status |
|----------|-------|--------|
| Conversion Functions | 52 | ✅ Passing |
| Liquidity Calculations | 23 | ✅ Passing |
| Error Handling | 16 | ✅ Passing |
| Pure Functions | 15 | ✅ Passing |
| Context & Data Fetching | 0 | 📝 Planned |
| USDC Approval | 0 | 📝 Planned |
| Trading Operations | 0 | 📝 Planned |
| Error Scenarios | 0 | 📝 Planned |

### Bugs by Severity

- **Critical**: 2 bugs
- **High Priority**: 4 bugs
- **Medium Priority**: 3 bugs
- **Low Priority**: 3 bugs

**Total**: 12 bugs documented

---

## Recommendations

### Immediate Actions (Critical/High Priority)

1. **Fix division by zero** in `marginRatioToLeverage()` - Easy fix, prevents crashes
2. **Add input validation** to `openTakerPosition()` and `openMakerPosition()` - Better UX
3. **Validate negative prices** in `priceToSqrtPriceX96()` - Clearer error messages
4. **Address placeholder values** - Document clearly or implement proper fetching

### Medium Term

5. **Add tick validation** in `estimateLiquidity()` - Prevent silent failures
6. **Warn on tick alignment** in `openMakerPosition()` - Transparency for users
7. **Improve overflow checks** in `scaleFromX96()` - Extra safety

### Long Term

8. **Add cache TTL** to context - Better for long-running applications
9. **Replace type assertions** with proper typing - Type safety
10. **Document negative value behavior** - Code clarity

---

## Contributing

When adding new tests:

1. **Unit tests** should go in `src/__tests__/unit/`
2. **Integration tests** should go in `src/__tests__/integration/`
3. Run tests after creation: `pnpm run test:unit`
4. Update this document if you discover new bugs
5. Use descriptive test names that explain what's being tested
6. Mark bug-documenting tests with `BUG:` prefix in test name

Example:
```typescript
it('BUG: should validate tickLower < tickUpper but does not', async () => {
  // Test that demonstrates the bug
});
```
