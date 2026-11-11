import type { Address, Hex, TransactionReceipt } from "viem";
import { decodeEventLog, erc20Abi } from "viem";
import { PERP_ABI } from "../abis/perp";
import { PERP_FACTORY_ABI } from "../abis/perp-factory";
import type { PerpCityContext } from "../context";
import type { PerpAddress } from "../types";
import type {
  AdjustMakerParams,
  AdjustTakerParams,
  CreatePerpParams,
  EstimateTakerAdjustResult,
  EstimateTakerPositionResult,
  MoveMakerParams,
  OpenMakerPositionParams,
  OpenTakerPositionParams,
  PerpData,
} from "../types/entity-data";
import { approveUsdc } from "../utils/approve";
import { NUMBER_1E6 } from "../utils/constants";
import { scale6Decimals } from "../utils/conversions";
import { TransactionRevertedError, withErrorHandling } from "../utils/errors";
import { withFeeHeadroom } from "../utils/fees";
import { simulateTakerSwap } from "../utils/swap";
import { type PoolTickMap, simulateTakerSwapExact } from "../utils/swapExact";
import {
  buildAdjustMakerCall,
  buildAdjustTakerCall,
  buildMoveMakerCall,
  buildOpenMakerPositionCall,
  buildOpenTakerPositionCall,
} from "./calldata";
import { OpenPosition } from "./open-position";
import { sendCall } from "./send-call";

export { calculateAlignedTicks } from "../utils/ticks";

/** The `posId` of the first `eventName` log the perp emitted in `receipt`. */
export function positionIdFromReceipt(
  receipt: Pick<TransactionReceipt, "logs">,
  perpAddress: PerpAddress,
  eventName: "TakerOpened" | "MakerOpened"
): bigint | null {
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== perpAddress.toLowerCase()) continue;
    try {
      const decoded = decodeEventLog({ abi: PERP_ABI, data: log.data, topics: log.topics });
      if (decoded.eventName === eventName) return decoded.args.posId;
    } catch (_notAPerpEvent) {}
  }
  return null;
}

/**
 * True when `receipt` has the perp's `MakerConverted` log for `posId`: the
 * maker removed all its liquidity with perp inventory left, so the position
 * is now a taker. Close that taker with a second `closePosition` (a
 * reduce-only taker close).
 */
export function makerConvertedFromReceipt(
  receipt: Pick<TransactionReceipt, "logs">,
  perpAddress: PerpAddress,
  posId: bigint
): boolean {
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== perpAddress.toLowerCase()) continue;
    try {
      const decoded = decodeEventLog({ abi: PERP_ABI, data: log.data, topics: log.topics });
      if (decoded.eventName === "MakerConverted" && decoded.args.posId === posId) return true;
    } catch (_notAPerpEvent) {}
  }
  return false;
}

/**
 * `PerpFactory.createPerp` (v1 signature). The factory reads the beacon with
 * the requested `latency`, so the beacon must have a fresh index first.
 */
export async function createPerp(
  context: PerpCityContext,
  params: CreatePerpParams
): Promise<PerpAddress> {
  return withErrorHandling(async () => {
    const deployments = context.deployments();
    const perpFactory = deployments.perpFactory;
    if (!perpFactory) throw new Error("perpFactory deployment address is required");

    const fees = params.fees ?? deployments.feesModule;
    const funding = params.funding ?? deployments.fundingModule;
    const marginRatios = params.marginRatios ?? deployments.marginRatiosModule;
    const priceImpact = params.priceImpact ?? deployments.priceImpactModule;
    const pricing = params.pricing ?? deployments.pricingModule;
    if (!fees || !funding || !marginRatios || !priceImpact || !pricing) {
      throw new Error("All module addresses must be provided in params or deployment config");
    }

    const { request } = await context.publicClient.simulateContract({
      address: perpFactory,
      abi: PERP_FACTORY_ABI,
      functionName: "createPerp",
      args: [
        params.owner,
        params.governor,
        { beacon: params.beacon, fees, funding, marginRatios, priceImpact, pricing },
        params.emaWindow,
        params.latency,
        params.salt,
        {
          capacity: params.withdrawalConfig.capacity,
          refillPerSecond: params.withdrawalConfig.refillPerSecond,
          challengeWindow: params.withdrawalConfig.challengeWindow,
        },
      ],
      account: context.walletClient.account,
    });

    const txHash = await context.walletClient.writeContract(
      await withFeeHeadroom(context.publicClient, request)
    );
    const receipt = await context.publicClient.waitForTransactionReceipt({ hash: txHash });
    if (receipt.status === "reverted") throw new TransactionRevertedError(txHash);

    for (const log of receipt.logs) {
      // Only the factory we called: a same-signature event elsewhere is not ours.
      if (log.address.toLowerCase() !== perpFactory.toLowerCase()) continue;
      try {
        const decoded = decodeEventLog({
          abi: PERP_FACTORY_ABI,
          data: log.data,
          topics: log.topics,
          eventName: "PerpCreated",
        });
        return decoded.args.perp as PerpAddress;
      } catch (_e) {}
    }
    throw new Error("PerpCreated event not found in transaction receipt");
  }, "createPerp");
}

/** Signed perp atoms for `margin * leverage` of notional at `price`. */
export function derivePerpDelta(opts: {
  margin: number;
  leverage: number;
  price: number;
  isLong: boolean;
}): bigint {
  if (opts.margin <= 0) throw new Error("Margin must be greater than 0");
  if (opts.leverage <= 0) throw new Error("Leverage must be greater than 0");
  if (opts.price <= 0) throw new Error("Price must be greater than 0");

  const marginScaled = scale6Decimals(opts.margin);
  const leverageScaled = BigInt(Math.floor(opts.leverage * NUMBER_1E6));
  const priceScaled = scale6Decimals(opts.price);
  const notional = (marginScaled * leverageScaled) / BigInt(NUMBER_1E6);
  const perpSize = (notional * BigInt(NUMBER_1E6)) / priceScaled;
  return opts.isLong ? perpSize : -perpSize;
}

async function ensureUsdcAllowance(
  context: PerpCityContext,
  spender: Address,
  requiredAmount: bigint
): Promise<void> {
  if (requiredAmount <= 0n) return;
  const account = context.walletClient.account?.address;
  if (!account) throw new Error("Wallet account is required");
  const currentAllowance = await context.publicClient.readContract({
    address: context.deployments().usdc,
    abi: erc20Abi,
    functionName: "allowance",
    args: [account, spender],
    blockTag: "latest",
  });
  if (currentAllowance < requiredAmount) {
    await approveUsdc(context, requiredAmount, spender, 2);
  }
}

export async function openTakerPosition(
  context: PerpCityContext,
  perpAddress: PerpAddress,
  params: OpenTakerPositionParams
): Promise<OpenPosition> {
  return withErrorHandling(async () => {
    const call = buildOpenTakerPositionCall(context, perpAddress, params);
    await ensureUsdcAllowance(context, perpAddress, scale6Decimals(params.margin));
    const { txHash, receipt } = await sendCall(context, call);
    const posId = positionIdFromReceipt(receipt, perpAddress, "TakerOpened");
    if (posId === null) throw new Error(`TakerOpened event not found. Hash: ${txHash}`);
    return new OpenPosition(context, perpAddress, posId, params.perpDelta > 0n, false, txHash);
  }, "openTakerPosition");
}

export async function openMakerPosition(
  context: PerpCityContext,
  perpAddress: PerpAddress,
  params: OpenMakerPositionParams
): Promise<OpenPosition> {
  return withErrorHandling(async () => {
    const call = await buildOpenMakerPositionCall(context, perpAddress, params);
    await ensureUsdcAllowance(context, perpAddress, scale6Decimals(params.margin));
    const { txHash, receipt } = await sendCall(context, call);
    const posId = positionIdFromReceipt(receipt, perpAddress, "MakerOpened");
    if (posId === null) throw new Error(`MakerOpened event not found. Hash: ${txHash}`);
    return new OpenPosition(context, perpAddress, posId, undefined, true, txHash);
  }, "openMakerPosition");
}

export async function adjustTaker(
  context: PerpCityContext,
  perpAddress: PerpAddress,
  params: AdjustTakerParams
): Promise<{ txHash: Hex }> {
  return withErrorHandling(async () => {
    const call = buildAdjustTakerCall(perpAddress, params);
    await ensureUsdcAllowance(context, perpAddress, params.marginDelta);
    const { txHash } = await sendCall(context, call);
    return { txHash };
  }, `adjustTaker for position ${params.posId}`);
}

/**
 * `Perp.adjustMaker`. `converted` is true when a full liquidity removal with
 * perp inventory left turned the maker into a taker (see
 * `makerConvertedFromReceipt`); close that taker with `closePosition`.
 */
export async function adjustMaker(
  context: PerpCityContext,
  perpAddress: PerpAddress,
  params: AdjustMakerParams
): Promise<{ txHash: Hex; converted: boolean }> {
  return withErrorHandling(async () => {
    const call = buildAdjustMakerCall(perpAddress, params);
    await ensureUsdcAllowance(context, perpAddress, params.marginDelta);
    const { txHash, receipt } = await sendCall(context, call);
    return {
      txHash,
      converted: makerConvertedFromReceipt(receipt, perpAddress, params.posId),
    };
  }, `adjustMaker for position ${params.posId}`);
}

export async function moveMaker(
  context: PerpCityContext,
  perpAddress: PerpAddress,
  params: MoveMakerParams
): Promise<{ txHash: Hex }> {
  return withErrorHandling(async () => {
    const call = buildMoveMakerCall(perpAddress, params);
    await ensureUsdcAllowance(context, perpAddress, params.marginDelta);
    const { txHash } = await sendCall(context, call);
    return { txHash };
  }, `moveMaker for position ${params.posId}`);
}

/** Margin-only change: no swap, no liquidity change, so no fee and no slippage limit. */
export async function adjustMargin(
  context: PerpCityContext,
  perpAddress: PerpAddress,
  positionId: bigint,
  marginDelta: bigint,
  opts: { deadline?: bigint } = {}
): Promise<{ txHash: Hex }> {
  const rawData = await context.getPositionRawData(perpAddress, positionId);
  if (rawData.makerDetails) {
    return adjustMaker(context, perpAddress, {
      posId: positionId,
      marginDelta,
      liquidityDelta: 0n,
      amt0Limit: 0n,
      amt1Limit: 0n,
      deadline: opts.deadline,
    });
  }
  return adjustTaker(context, perpAddress, {
    posId: positionId,
    marginDelta,
    perpDelta: 0n,
    amt1Limit: 0n,
    maxTotalFee: 0n,
    reduceOnly: true,
    deadline: opts.deadline,
  });
}

/**
 * Conservative fee rate for a quote: the fees module's `maxSwapFee()` plus
 * the cached protocol fee. The live v1 rate depends on segment liquidity and
 * the EMAs, so the real fee is at most this.
 */
export function maxTakerFeeRate(perpData: Pick<PerpData, "fees">): number {
  return perpData.fees.maxSwapFee + perpData.fees.protocolFee;
}

/**
 * The swap leg of a taker quote on the Uniswap v4 pool. With a tick map the
 * fill is exact (`simulateTakerSwapExact`); without one it is a one-region
 * approximation. `effective*` fields fold in `feeRate` (default: the
 * conservative `maxTakerFeeRate`).
 */
function quoteTakerSwap(
  perpData: PerpData,
  perpDelta: bigint,
  tickMap: PoolTickMap | undefined,
  feeRate: number
): EstimateTakerAdjustResult {
  const opts = {
    sqrtPriceX96: perpData.sqrtPriceX96,
    liquidity: perpData.liquidity,
    perpDelta,
    markPrice: perpData.ammPrice,
    feeRate,
  };
  const exact = tickMap ? simulateTakerSwapExact({ ...opts, tickMap }) : null;
  const swap = exact ?? simulateTakerSwap(opts);
  return {
    usdDelta: swap.usdDelta,
    fillPrice: swap.fillPrice,
    feeRate: swap.feeRate,
    effectiveUsdDelta: swap.effectiveUsdDelta,
    effectiveFillPrice: swap.effectiveFillPrice,
    exceedsLiquidity: swap.exceedsLiquidity,
    liquidityLimited: swap.liquidityLimited,
    ...(exact ? { endSqrtPriceX96: exact.endSqrtPriceX96 } : {}),
  };
}

/**
 * Size a new taker at the cached mark (`rates().lastMark`) and quote its swap
 * leg. An estimate: the contract checks margin at the live mark, so preflight
 * the built call before sending.
 */
export async function estimateTakerPosition(
  context: PerpCityContext,
  perpAddress: PerpAddress,
  params: {
    isLong: boolean;
    margin: number;
    leverage: number;
    tickMap?: PoolTickMap;
    feeRate?: number;
  }
): Promise<EstimateTakerPositionResult> {
  return withErrorHandling(async () => {
    const perpData = await context.getPerpData(perpAddress);
    const perpDelta = derivePerpDelta({
      margin: params.margin,
      leverage: params.leverage,
      price: perpData.lastMark,
      isLong: params.isLong,
    });
    const feeRate = params.feeRate ?? maxTakerFeeRate(perpData);
    return { perpDelta, ...quoteTakerSwap(perpData, perpDelta, params.tickMap, feeRate) };
  }, "estimateTakerPosition");
}

/** Quote the swap leg of a signed taker adjustment on the current pool state. */
export async function estimateTakerAdjust(
  context: PerpCityContext,
  perpAddress: PerpAddress,
  params: { perpDelta: bigint; tickMap?: PoolTickMap; feeRate?: number }
): Promise<EstimateTakerAdjustResult> {
  return withErrorHandling(async () => {
    if (params.perpDelta === 0n) throw new Error("perpDelta must be non-zero");
    const perpData = await context.getPerpData(perpAddress);
    const feeRate = params.feeRate ?? maxTakerFeeRate(perpData);
    return quoteTakerSwap(perpData, params.perpDelta, params.tickMap, feeRate);
  }, "estimateTakerAdjust");
}
