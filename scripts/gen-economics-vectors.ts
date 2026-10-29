/**
 * Writes fixtures/economics_vectors.json: input/expected pairs computed by the
 * SDK's protocol math, shipped in the npm package so the backend and bot-api
 * Python ports can assert parity. Deterministic: rerun and `git diff
 * --exit-code fixtures/` must be clean.
 *
 * Encoding: every bigint is a decimal string; ratios and prices are numbers.
 * Raw units: perp and USD amounts in micro units (1e6), prices X96, rates
 * 1e6-scaled (fees, margin ratios) or WAD (funding).
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import pkg from "../package.json" with { type: "json" };
import { makerRemovableFraction, type Utilization } from "../src/functions/utilization";
import {
  advanceEmas,
  fairPriceX96,
  type FeeRatesE6,
  fundingPaymentUsd,
  fundingRatePerDay,
  makerLimits,
  makerPoolValue,
  maxOpenLeverage,
  swapFees,
  type TakerEconomicsInput,
  takerEconomics,
} from "../src/math";
import type { PerpBuild } from "../src/utils/build";
import { getSqrtPriceAtTick } from "../src/utils/tickMath";

const Q96 = 1n << 96n;
const BUILDS: readonly PerpBuild[] = ["58b42b7", "v0.2.2"];
const LIVE_RATES: FeeRatesE6 = { lpFee: 10_000n, creatorFee: 100n, insuranceFee: 1_000n, protocolFee: 0n };

function encode(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(encode);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, encode(v)]));
  }
  return value;
}

const priceX96 = (micro: bigint) => (micro * Q96) / 1_000_000n;

const fairPrice = BUILDS.flatMap((build) => [
  {
    name: "hormuz-live-accrue",
    build,
    input: {
      ammX96: 3333452930552967749837079299470n,
      indexX96: 3248354663084837841335301963776n,
      emaAmmX96: 3321528208423946384037633669774n,
      emaIndexX96: 3097683169375594803637957648468n,
    },
  },
  { name: "clamp-index-leg-to-zero", build, input: { ammX96: 1001n, indexX96: 1n, emaAmmX96: 1n, emaIndexX96: 1_000_000n } },
  { name: "floor-odd-sum", build, input: { ammX96: 7n, indexX96: 3n, emaAmmX96: 4n, emaIndexX96: 2n } },
]).map((c) => ({ ...c, expected: { fairX96: fairPriceX96(c.input) } }));

const emaAdvance = BUILDS.flatMap((build) => [
  {
    name: "hormuz-300s",
    build,
    input: {
      emaAmmX96: 3320491901781519017281026778664n,
      emaIndexX96: 3084589206424849219740478559607n,
      ammX96: 3333452930552967749837079299470n,
      indexX96: 3248354663084837841335301963776n,
      dtSeconds: 300n,
      emaWindow: 3600n,
    },
  },
  {
    name: "one-day-gap",
    build,
    input: { emaAmmX96: 10n * Q96, emaIndexX96: 12n * Q96, ammX96: 11n * Q96, indexX96: 9n * Q96, dtSeconds: 86_400n, emaWindow: 3600n },
  },
  {
    name: "no-time-passed",
    build,
    input: { emaAmmX96: 10n * Q96, emaIndexX96: 12n * Q96, ammX96: 11n * Q96, indexX96: 9n * Q96, dtSeconds: 0n, emaWindow: 3600n },
  },
]).map((c) => ({ ...c, expected: advanceEmas(c.input) }));

const swapFeeCases = BUILDS.flatMap((build) => [
  { name: "live-rates-round-up", build, input: { volume: 1_000_001n, rates: LIVE_RATES } },
  { name: "with-protocol-fee", build, input: { volume: 123_456_789n, rates: { ...LIVE_RATES, protocolFee: 500n } } },
]).map((c) => ({ ...c, expected: swapFees(c.input.volume, c.input.rates) }));

const fundingRate = BUILDS.flatMap((build) => [
  { name: "positive", build, input: { fundingPerDayWad: 5n * 10n ** 16n, emaAmmX96: 25n * Q96 } },
  { name: "negative", build, input: { fundingPerDayWad: -(10n ** 16n), emaAmmX96: 10n * Q96 } },
]).map((c) => ({ ...c, expected: { ratePerDay: fundingRatePerDay(c.input.fundingPerDayWad, c.input.emaAmmX96) } }));

const fundingPayment = BUILDS.flatMap((build) => [
  { name: "long-owes", build, input: { perpDelta: 3_000_000n, cumlNowX96: 5n * Q96 + 7n, cumlLastX96: Q96 } },
  { name: "short-negative-remainder", build, input: { perpDelta: -3n, cumlNowX96: Q96 + 1n, cumlLastX96: 0n } },
]).map((c) => ({
  ...c,
  expected: { owed: fundingPaymentUsd(c.input.perpDelta, c.input.cumlNowX96, c.input.cumlLastX96, c.build) },
}));

const TAKER_BASE = {
  perpDelta: 10_000_000n,
  usdDelta: -100_000_000n,
  margin: 10_000_000n,
  fundingOwed: 0n,
  utilOwed: 0n,
  fairX96: 10n * Q96,
  liqMarginRatioE6: 50_000,
  liqFeeE6: 10_000,
  closeFeeRates: LIVE_RATES,
  realizedPnl: 0n,
};

const takerCases: Array<{ name: string; input: Omit<TakerEconomicsInput, "build"> }> = [
  { name: "long-at-entry", input: TAKER_BASE },
  { name: "long-in-profit", input: { ...TAKER_BASE, fairX96: priceX96(11_250_000n) } },
  { name: "short-near-liquidation", input: { ...TAKER_BASE, perpDelta: -10_000_000n, usdDelta: 100_000_000n, fairX96: priceX96(10_450_000n) } },
  {
    name: "after-partial-reduce",
    input: { ...TAKER_BASE, perpDelta: 4_000_000n, usdDelta: -38_000_000n, margin: 9_500_000n, realizedPnl: 2_000_000n, fairX96: priceX96(10_100_000n) },
  },
  { name: "with-funding-and-util-owed", input: { ...TAKER_BASE, fundingOwed: 1_234_567n, utilOwed: 89_012n } },
  { name: "underwater", input: { ...TAKER_BASE, fairX96: priceX96(8_900_000n) } },
  { name: "liq-fee-boundary-9_6", input: { ...TAKER_BASE, fairX96: priceX96(9_600_000n) } },
];
const takerEconomicsVectors = BUILDS.flatMap((build) =>
  takerCases.map(({ name, input }) => ({ name, build, input, expected: takerEconomics({ ...input, build }) }))
);

const makerPoolValueVectors = BUILDS.flatMap((build) =>
  [
    { name: "symmetric-at-center", tickLower: -6960, tickUpper: 6960, liquidity: 10n ** 15n, tick: 0 },
    { name: "price-below-range", tickLower: 23000, tickUpper: 24000, liquidity: 5n * 10n ** 14n, tick: 22000 },
    { name: "price-above-range", tickLower: 23000, tickUpper: 24000, liquidity: 5n * 10n ** 14n, tick: 25000 },
    { name: "price-in-range-fair-above-spot", tickLower: 23000, tickUpper: 24000, liquidity: 5n * 10n ** 14n, tick: 23500, fairBps: 10_150n },
  ].map(({ name, tick, fairBps, ...rest }) => {
    const sqrtPriceX96 = getSqrtPriceAtTick(tick);
    const spot = (sqrtPriceX96 * sqrtPriceX96) / Q96;
    const input = { ...rest, sqrtPriceX96, fairX96: (spot * (fairBps ?? 10_000n)) / 10_000n };
    return { name, build, input, expected: { value: makerPoolValue(input) } };
  })
);

const makerLimitVectors = BUILDS.flatMap((build) =>
  [
    { name: "add-in-range-1pct", liquidityDelta: 5n * 10n ** 14n, slippage: 0.01 },
    { name: "remove-in-range-1pct", liquidityDelta: -5n * 10n ** 14n, slippage: 0.01 },
    { name: "remove-no-slippage", liquidityDelta: -5n * 10n ** 14n, slippage: 0 },
  ].map(({ name, ...rest }) => {
    const input = { ...rest, sqrtPriceX96: getSqrtPriceAtTick(23500), tickLower: 23000, tickUpper: 24000 };
    return { name, build, input, expected: makerLimits(input) };
  })
);

const maxOpenLeverageVectors = BUILDS.flatMap((build) =>
  [
    { name: "live-fees-no-impact", input: { initRatio: 0.1, feeRate: 0.0111, priceImpact: 0 } },
    { name: "live-fees-1pct-impact", input: { initRatio: 0.1, feeRate: 0.0111, priceImpact: 0.01 } },
    { name: "favourable-impact-ignored", input: { initRatio: 0.1, feeRate: 0, priceImpact: -0.05 } },
  ].map((c) => ({ name: c.name, build, input: c.input, expected: { maxLeverage: maxOpenLeverage(c.input) } }))
);

const UTIL: Utilization = { oiLong: 6_000_000n, oiShort: 1_000_000n, capLong: 10_000_000n, capShort: 4_000_000n };
const removableVectors = BUILDS.flatMap((build) =>
  [
    { name: "fully-removable", input: { utilization: UTIL, positionCapLong: 1n, positionCapShort: 1n } },
    { name: "half-removable-long", input: { utilization: UTIL, positionCapLong: 8_000_000n, positionCapShort: 0n } },
    {
      name: "locked-by-open-trades",
      input: {
        utilization: { oiLong: 4_976_000n, oiShort: 0n, capLong: 4_978_000n, capShort: 1_000_000n },
        positionCapLong: 4_500_000n,
        positionCapShort: 0n,
      },
    },
    {
      name: "rounding-differs-by-build",
      input: { utilization: { oiLong: 0n, oiShort: 8n, capLong: 10n, capShort: 10n }, positionCapLong: 0n, positionCapShort: 3n },
    },
  ].map((c) => ({ name: c.name, build, input: c.input, expected: makerRemovableFraction({ ...c.input, build }) }))
);

const vectors = {
  schema: 1,
  sdkVersion: pkg.version,
  builds: BUILDS,
  fairPrice,
  emaAdvance,
  swapFees: swapFeeCases,
  fundingRate,
  fundingPayment,
  takerEconomics: takerEconomicsVectors,
  makerPoolValue: makerPoolValueVectors,
  makerLimits: makerLimitVectors,
  maxOpenLeverage: maxOpenLeverageVectors,
  makerRemovableFraction: removableVectors,
};

const out = resolve(import.meta.dirname, "../fixtures/economics_vectors.json");
writeFileSync(out, `${JSON.stringify(encode(vectors), null, 2)}\n`);
console.log(`wrote ${out}`);
