import type { Address, Hex } from "viem";
import type { PerpAddress } from "../types";

/**
 * Raw on-chain structs, field for field as `src/libraries/Structs.sol` at
 * perpcity-contracts v1.0.0. Units are the contract's: prices Q96, USDC
 * amounts 6 decimals, perp amounts in atoms, fee and margin ratios 1e6,
 * daily rates 1e18.
 */

/** `Perp.positions(posId)`. `delta` is the packed BalanceDelta (amount0 perp, amount1 USD). */
export type PositionStruct = {
  delta: bigint;
  margin: bigint;
  lastCumlFundingX96: bigint;
};

/** `Perp.makerDetails(posId)`. */
export type MakerStruct = {
  tickLower: number;
  tickUpper: number;
  liquidity: bigint;
  lastLpFeeGrowthInsideX128: bigint;
  lastCumlFunding: { belowX96: bigint; withinInventoryX192: bigint };
  lastFundingCorrectionX128: bigint;
};

/** `Perp.takerDetails(posId)`. */
export type TakerStruct = {
  lastUtilPaymentsX96: bigint;
  lastReserveUtilPaymentsX96: bigint;
};

/** `Perp.previewPosition(posId)`: settlement and health accrued to the current block. */
export type PositionPreview = {
  isMaker: boolean;
  markPrice: bigint;
  settledMargin: bigint;
  pendingLpFees: bigint;
  pendingFunding: bigint;
  pendingUtil: bigint;
  pendingReserveUtil: bigint;
  value: bigint;
  unrealizedPnl: bigint;
  equity: bigint;
  meetsInitialMargin: boolean;
  liquidatable: boolean;
  backstoppable: boolean;
  nominalLiqFee: bigint;
  payableLiqFee: bigint;
};

/** `Perp.rates()`: the cached daily rates and the mark used for utilization accrual. */
export type RatesStruct = {
  fundingPerDay: bigint;
  longUtilFeePerDay: bigint;
  shortUtilFeePerDay: bigint;
  lastTouch: number;
  lastMark: bigint;
};

/** `Perp.cumulatives()`. */
export type CumulativesStruct = {
  fundingX96: bigint;
  fundingDivSqrtPX192: bigint;
  lpFeeGrowthGlobalX128: bigint;
  longUtilPaymentsX96: bigint;
  shortUtilPaymentsX96: bigint;
  longReserveUtilPaymentsX96: bigint;
  shortReserveUtilPaymentsX96: bigint;
  fundingCorrectionX128: bigint;
};

/** Initial, liquidation and backstop margin ratios, scaled by 1e6. */
export type MarginRatiosE6 = { init: number; liq: number; backstop: number };

export type Fees = {
  /** Nominal liquidation fee rate (fraction). */
  liquidationFee: number;
  /** Cached protocol swap fee rate on the perp (fraction). */
  protocolFee: number;
  /** Largest creator + insurance + LP swap fee rate the fees module can charge (fraction). */
  maxSwapFee: number;
};

export type CallData = {
  to: Address;
  data: Hex;
  value: bigint;
};

/** Limits every v1 write takes. `deadline` is a unix timestamp in seconds. */
export type TxDeadline = {
  /** Defaults to now + `DEFAULT_DEADLINE_SECONDS`. */
  deadline?: bigint;
};

export type OpenTakerPositionParams = TxDeadline & {
  /** USDC margin in human units (100 = $100). */
  margin: number;
  /** Signed perp atoms: positive opens long, negative opens short. */
  perpDelta: bigint;
  /** Maximum USD paid (long) or minimum USD received (short), 6 decimals. */
  amt1Limit: bigint;
  /** Maximum total swap fee, 6 decimals. See `maxTotalFeeFor`. */
  maxTotalFee: bigint;
  /** Position owner. Defaults to the wallet account. */
  holder?: Address;
};

export type AdjustTakerParams = TxDeadline & {
  posId: bigint;
  /** Signed USDC margin change, 6 decimals. */
  marginDelta: bigint;
  /** Signed perp atoms: positive buys, negative sells. */
  perpDelta: bigint;
  amt1Limit: bigint;
  maxTotalFee: bigint;
  /** Reject an adjustment that grows absolute exposure or flips side. */
  reduceOnly: boolean;
};

export type OpenMakerPositionParams = TxDeadline & {
  /** USDC margin in human units. */
  margin: number;
  priceLower: number;
  priceUpper: number;
  liquidity: bigint;
  /** Max perp atoms in (number = human units, bigint = raw). */
  maxAmt0In: number | bigint;
  /**
   * Max USD leg of the deposit (number = human units, bigint = raw). This is
   * a slippage limit on position accounting; v1 transfers only `margin`.
   */
  maxAmt1In: number | bigint;
  holder?: Address;
};

export type AdjustMakerParams = TxDeadline & {
  posId: bigint;
  marginDelta: bigint;
  liquidityDelta: bigint;
  amt0Limit: bigint;
  amt1Limit: bigint;
};

export type MoveMakerParams = TxDeadline & {
  posId: bigint;
  tickLower: number;
  tickUpper: number;
  liquidity: bigint;
  removeAmt0Min: bigint;
  removeAmt1Min: bigint;
  addAmt0Max: bigint;
  addAmt1Max: bigint;
  marginDelta: bigint;
};

export type ClosePositionParams = TxDeadline & {
  /** Maker: minimum perp atoms returned. Unused for takers. */
  amt0Limit?: number | bigint;
  /** Taker: max USD paid / min USD received. Maker: minimum USD returned. */
  amt1Limit: number | bigint;
  /** Taker only: maximum total swap fee, 6 decimals. */
  maxTotalFee?: bigint;
};

export type ClosePositionResult = {
  txHash: Hex;
  /**
   * True when a maker close converted the position to a taker
   * (`MakerConverted`): the position still exists. Close it with a second
   * `closePosition` call (reduce-only taker close).
   */
  converted: boolean;
};

export type WithdrawalConfig = {
  /** Instant-withdrawal burst, USDC 6 decimals. */
  capacity: bigint;
  /** Instant capacity restored per second, USDC 6 decimals. */
  refillPerSecond: bigint;
  /** Claim release delay in seconds. */
  challengeWindow: number;
};

export type CreatePerpParams = {
  owner: Address;
  governor: Address;
  beacon: Address;
  emaWindow: number;
  /** Maximum beacon age in seconds. The beacon must be fresher than this at creation. */
  latency: number;
  salt: Hex;
  withdrawalConfig: WithdrawalConfig;
  pricing?: Address;
  funding?: Address;
  fees?: Address;
  marginRatios?: Address;
  priceImpact?: Address;
};

export type PerpConfig = {
  key: {
    currency0: Address;
    currency1: Address;
    fee: number;
    tickSpacing: number;
    hooks: Address;
  };
  owner: Address;
  governor: Address;
  beacon: Address;
  pricing: Address;
  funding: Address;
  fees: Address;
  marginRatios: Address;
  priceImpact: Address;
  protocolFeeManager: Address;
  withdrawalController: Address;
  /** Protocol fee scaled by 1e6, as cached on the perp. */
  protocolFeeE6: bigint;
  emaWindow: number;
  latency: number;
  poolId: Hex;
};

export type PerpData = {
  id: PerpAddress;
  tickSpacing: number;
  tick: number;
  sqrtPriceX96: bigint;
  /** Pool spot price. */
  ammPrice: number;
  /** Mark cached at `rates.lastTouch` (`rates().lastMark`). */
  lastMark: number;
  liquidity: bigint;
  beacon: Address;
  rates: RatesStruct;
  takerMarginRatios: MarginRatiosE6;
  makerMarginRatios: MarginRatiosE6;
  fees: Fees;
  openInterest: { long: bigint; short: bigint };
  tvlCap: bigint;
  accountedTvl: bigint;
};

export type UserData = {
  walletAddress: Hex;
  usdcBalance: number;
  openPositions: OpenPositionData[];
};

export type OpenPositionData = {
  perpId: PerpAddress;
  positionId: bigint;
  isLong?: boolean;
  isMaker?: boolean;
};

export type MakerDetails = {
  tickLower: number;
  tickUpper: number;
  liquidity: bigint;
};

/** One position, decoded for display. Amounts are raw contract units. */
export type PositionRawData = {
  perpId: PerpAddress;
  positionId: bigint;
  owner: Address;
  /** Settled margin in USDC (human units). */
  margin: number;
  /** Signed perp inventory (amount0 of the BalanceDelta). */
  perpDelta: bigint;
  /** Signed USD inventory (amount1 of the BalanceDelta). */
  usdDelta: bigint;
  makerDetails: MakerDetails | null;
};

/** Swap-leg quote on the Uniswap v4 pool (see `estimateTakerAdjust`). */
export type EstimateTakerAdjustResult = {
  usdDelta: bigint;
  fillPrice: number;
  feeRate: number;
  effectiveUsdDelta: bigint;
  effectiveFillPrice: number;
  exceedsLiquidity: boolean;
  liquidityLimited: boolean;
  endSqrtPriceX96?: bigint;
};

export type EstimateTakerPositionResult = EstimateTakerAdjustResult & { perpDelta: bigint };

export type CacheConfig = {
  ttl: number;
  maxSize: number;
};
