import type { Address, Hex } from "viem";
import { decodeAbiParameters, decodeEventLog, erc20Abi, keccak256, toBytes } from "viem";
import { PERP_ABI } from "../abis/perp";
import { PERP_FACTORY_ABI } from "../abis/perp-factory";
import type { PerpCityContext } from "../context";
import type { PerpAddress } from "../types";
import type {
  CreatePerpParams,
  EstimateTakerAdjustResult,
  EstimateTakerPositionResult,
  OpenMakerPositionParams,
  OpenTakerPositionParams,
  PerpData,
} from "../types/entity-data";
import {
  MAX_TICK,
  MIN_TICK,
  NUMBER_1E6,
  priceToTick,
  scale6Decimals,
  simulateTakerSwap,
} from "../utils";
import { approveUsdc } from "../utils/approve";
import { TransactionRevertedError, withErrorHandling } from "../utils/errors";
import { totalTakerFeeRate, withFeeHeadroom } from "../utils/fees";
import { type PoolTickMap, simulateTakerSwapExact } from "../utils/swapExact";
import { OpenPosition } from "./open-position";

const MAKER_OPENED_TOPIC = keccak256(toBytes("MakerOpened(uint256)"));
const TAKER_OPENED_TOPIC = keccak256(
  toBytes("TakerOpened(uint256,(int256,uint256,int256,uint256,uint256,uint256,uint256))")
);

export async function createPerp(
  context: PerpCityContext,
  params: CreatePerpParams
): Promise<PerpAddress> {
  return withErrorHandling(async () => {
    const deployments = context.deployments();
    const perpFactory = deployments.perpFactory;
    if (!perpFactory) throw new Error("perpFactory deployment address is required");

    const modules = {
      beacon: params.beacon,
      fees: params.fees ?? deployments.feesModule,
      funding: params.funding ?? deployments.fundingModule,
      marginRatios: params.marginRatios ?? deployments.marginRatiosModule,
      priceImpact: params.priceImpact ?? deployments.priceImpactModule,
      pricing: params.pricing ?? deployments.pricingModule,
    };

    if (
      !modules.fees ||
      !modules.funding ||
      !modules.marginRatios ||
      !modules.priceImpact ||
      !modules.pricing
    ) {
      throw new Error("All module addresses must be provided in params or deployment config");
    }

    const { request } = await context.publicClient.simulateContract({
      address: perpFactory,
      abi: PERP_FACTORY_ABI,
      functionName: "createPerp",
      args: [
        params.owner,
        params.name,
        params.symbol,
        params.tokenUri,
        modules as {
          beacon: Address;
          fees: Address;
          funding: Address;
          marginRatios: Address;
          priceImpact: Address;
          pricing: Address;
        },
        params.emaWindow,
        params.salt,
      ],
      account: context.walletClient.account,
    });

    const txHash = await context.walletClient.writeContract(
      await withFeeHeadroom(context.publicClient, request)
    );
    const receipt = await context.publicClient.waitForTransactionReceipt({ hash: txHash });
    if (receipt.status === "reverted") throw new TransactionRevertedError(txHash);

    for (const log of receipt.logs) {
      // Only decode logs emitted by the factory we called, so a same-signature
      // event from another contract can't be mistaken for PerpCreated.
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
    if (params.margin <= 0) throw new Error("Margin must be greater than 0");
    if (params.perpDelta === 0n) throw new Error("perpDelta must be non-zero");

    const marginScaled = scale6Decimals(params.margin);
    await ensureUsdcAllowance(context, perpAddress, marginScaled);

    const { request } = await context.publicClient.simulateContract({
      address: perpAddress,
      abi: PERP_ABI,
      functionName: "openTaker",
      args: [
        {
          holder: context.walletClient.account!.address,
          margin: marginScaled,
          perpDelta: params.perpDelta,
          amt1Limit: params.amt1Limit,
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
      try {
        if (
          log.address.toLowerCase() !== perpAddress.toLowerCase() ||
          log.topics[0] !== TAKER_OPENED_TOPIC ||
          log.data === "0x"
        ) {
          continue;
        }
        const [posId] = decodeAbiParameters([{ type: "uint256" }], log.data);
        return new OpenPosition(context, perpAddress, posId, params.perpDelta > 0n, false, txHash);
      } catch (_e) {}
    }
    throw new Error(`TakerOpened event not found in transaction receipt. Hash: ${txHash}`);
  }, "openTakerPosition");
}

function buildMakerContractParams(
  context: PerpCityContext,
  marginScaled: bigint,
  params: OpenMakerPositionParams,
  alignedTickLower: number,
  alignedTickUpper: number,
  maxAmt0In: bigint,
  maxAmt1In: bigint
) {
  return {
    holder: context.walletClient.account!.address,
    margin: marginScaled,
    tickLower: alignedTickLower,
    tickUpper: alignedTickUpper,
    liquidity: params.liquidity,
    maxAmt0In,
    maxAmt1In,
  };
}

export function calculateAlignedTicks(
  priceLower: number,
  priceUpper: number,
  tickSpacing: number
): { alignedTickLower: number; alignedTickUpper: number } {
  const tickLower = priceToTick(priceLower, true);
  const tickUpper = priceToTick(priceUpper, false);

  const alignedTickLower = Math.floor(tickLower / tickSpacing) * tickSpacing;
  const alignedTickUpper = Math.ceil(tickUpper / tickSpacing) * tickSpacing;

  if (alignedTickLower < MIN_TICK) {
    throw new Error(
      `Lower tick ${alignedTickLower} is below MIN_TICK (${MIN_TICK}). Increase priceLower.`
    );
  }
  if (alignedTickUpper > MAX_TICK) {
    throw new Error(
      `Upper tick ${alignedTickUpper} exceeds MAX_TICK (${MAX_TICK}). Decrease priceUpper.`
    );
  }
  if (alignedTickLower === alignedTickUpper) {
    throw new Error(
      "Price range too narrow: lower and upper ticks are equal after alignment. Widen the range."
    );
  }

  return { alignedTickLower, alignedTickUpper };
}

export async function openMakerPosition(
  context: PerpCityContext,
  perpAddress: PerpAddress,
  params: OpenMakerPositionParams
): Promise<OpenPosition> {
  return withErrorHandling(async () => {
    if (params.margin <= 0) throw new Error("Margin must be greater than 0");
    if (params.priceLower >= params.priceUpper)
      throw new Error("priceLower must be less than priceUpper");

    const marginScaled = scale6Decimals(params.margin);
    const perpData = await context.getPerpData(perpAddress);
    const { alignedTickLower, alignedTickUpper } = calculateAlignedTicks(
      params.priceLower,
      params.priceUpper,
      perpData.tickSpacing
    );

    const maxAmt0In =
      typeof params.maxAmt0In === "bigint" ? params.maxAmt0In : scale6Decimals(params.maxAmt0In);
    const maxAmt1In =
      typeof params.maxAmt1In === "bigint" ? params.maxAmt1In : scale6Decimals(params.maxAmt1In);

    await ensureUsdcAllowance(context, perpAddress, marginScaled);

    const contractParams = buildMakerContractParams(
      context,
      marginScaled,
      params,
      alignedTickLower,
      alignedTickUpper,
      maxAmt0In,
      maxAmt1In
    );

    const { request } = await context.publicClient.simulateContract({
      address: perpAddress,
      abi: PERP_ABI,
      functionName: "openMaker",
      args: [contractParams],
      account: context.walletClient.account,
    });

    const txHash = await context.walletClient.writeContract(
      await withFeeHeadroom(context.publicClient, request)
    );
    const receipt = await context.publicClient.waitForTransactionReceipt({ hash: txHash });
    if (receipt.status === "reverted") throw new TransactionRevertedError(txHash);

    for (const log of receipt.logs) {
      try {
        if (
          log.address.toLowerCase() !== perpAddress.toLowerCase() ||
          log.topics[0] !== MAKER_OPENED_TOPIC ||
          log.data === "0x"
        ) {
          continue;
        }
        const [posId] = decodeAbiParameters([{ type: "uint256" }], log.data);
        return new OpenPosition(context, perpAddress, posId, undefined, true, txHash);
      } catch (_e) {}
    }
    throw new Error(`MakerOpened event not found in transaction receipt. Hash: ${txHash}`);
  }, "openMakerPosition");
}

export async function estimateTakerPosition(
  context: PerpCityContext,
  perpAddress: PerpAddress,
  params: {
    isLong: boolean;
    margin: number;
    leverage: number;
    /** Walk the real tick map (exact fill, crosses ticks) instead of one region. */
    tickMap?: PoolTickMap;
  }
): Promise<EstimateTakerPositionResult> {
  return withErrorHandling(async () => {
    const perpData = await context.getPerpData(perpAddress);
    // Size at the fair mark: the contract values the position (and checks
    // margin) there, not at the pool spot.
    const perpDelta = derivePerpDelta({
      margin: params.margin,
      leverage: params.leverage,
      price: perpData.fairMark,
      isLong: params.isLong,
    });
    return { perpDelta, ...quoteTakerSwap(perpData, perpDelta, params.tickMap) };
  }, "estimateTakerPosition");
}

/**
 * The swap leg of a taker quote. With a tick map the fill is exact (see
 * `simulateTakerSwapExact`); without one it is a single active-liquidity
 * region approximation (`simulateTakerSwap`). `feeRate` folds the total taker
 * fee into the `effective*` fields, while the raw `fillPrice`/`usdDelta` keep
 * price impact separable from fees.
 */
function quoteTakerSwap(
  perpData: PerpData,
  perpDelta: bigint,
  tickMap: PoolTickMap | undefined
): EstimateTakerAdjustResult {
  const opts = {
    sqrtPriceX96: perpData.sqrtPriceX96,
    liquidity: perpData.liquidity,
    perpDelta,
    markPrice: perpData.spotMark,
    feeRate: totalTakerFeeRate(perpData.fees),
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
 * Quote an arbitrary signed taker adjustment delta against current pool state.
 *
 * The `adjustTaker` companion to {@link estimateTakerPosition}: pass the exact
 * signed `perpDelta` the adjust call will submit (positive buys perp, negative
 * sells — an add for a long is positive, a reduce negative, a flip the full
 * signed total) and get the simulated USD leg, average fill price, and depth
 * flag. Pure client-side math — no eth_call, so it is safe on reactive quote
 * paths. Pass `tickMap` (from `fetchPoolTickMap`) for an exact multi-tick fill;
 * without it the quote uses the single-region model (`simulateTakerSwap`).
 * The total taker fee is folded into the `effective*` fields; the raw
 * `fillPrice`/`usdDelta` remain fee-exclusive price impact.
 */
export async function estimateTakerAdjust(
  context: PerpCityContext,
  perpAddress: PerpAddress,
  params: { perpDelta: bigint; tickMap?: PoolTickMap }
): Promise<EstimateTakerAdjustResult> {
  return withErrorHandling(async () => {
    if (params.perpDelta === 0n) throw new Error("perpDelta must be non-zero");
    const perpData = await context.getPerpData(perpAddress);
    return quoteTakerSwap(perpData, params.perpDelta, params.tickMap);
  }, "estimateTakerAdjust");
}

export async function adjustTaker(
  context: PerpCityContext,
  perpAddress: PerpAddress,
  params: { posId: bigint; marginDelta: bigint; perpDelta: bigint; amt1Limit: bigint }
): Promise<{ txHash: Hex }> {
  return withErrorHandling(async () => {
    if (params.marginDelta > 0n)
      await ensureUsdcAllowance(context, perpAddress, params.marginDelta);

    const { request } = await context.publicClient.simulateContract({
      address: perpAddress,
      abi: PERP_ABI,
      functionName: "adjustTaker",
      args: [params],
      account: context.walletClient.account,
    });
    const txHash = await context.walletClient.writeContract(
      await withFeeHeadroom(context.publicClient, request)
    );
    const receipt = await context.publicClient.waitForTransactionReceipt({ hash: txHash });
    if (receipt.status === "reverted") throw new TransactionRevertedError(txHash);
    return { txHash };
  }, `adjustTaker for position ${params.posId}`);
}

export async function adjustMaker(
  context: PerpCityContext,
  perpAddress: PerpAddress,
  params: {
    posId: bigint;
    marginDelta: bigint;
    liquidityDelta: bigint;
    amt0Limit: bigint;
    amt1Limit: bigint;
  }
): Promise<{ txHash: Hex }> {
  return withErrorHandling(async () => {
    if (params.marginDelta > 0n)
      await ensureUsdcAllowance(context, perpAddress, params.marginDelta);

    const { request } = await context.publicClient.simulateContract({
      address: perpAddress,
      abi: PERP_ABI,
      functionName: "adjustMaker",
      args: [params],
      account: context.walletClient.account,
    });
    const txHash = await context.walletClient.writeContract(
      await withFeeHeadroom(context.publicClient, request)
    );
    const receipt = await context.publicClient.waitForTransactionReceipt({ hash: txHash });
    if (receipt.status === "reverted") throw new TransactionRevertedError(txHash);
    return { txHash };
  }, `adjustMaker for position ${params.posId}`);
}

export async function adjustMargin(
  context: PerpCityContext,
  perpAddress: PerpAddress,
  positionId: bigint,
  marginDelta: bigint
): Promise<{ txHash: Hex }> {
  const rawData = await context.getPositionRawData(perpAddress, positionId);
  if (rawData.makerDetails) {
    return adjustMaker(context, perpAddress, {
      posId: positionId,
      marginDelta,
      liquidityDelta: 0n,
      amt0Limit: 0n,
      amt1Limit: 0n,
    });
  }
  return adjustTaker(context, perpAddress, {
    posId: positionId,
    marginDelta,
    perpDelta: 0n,
    amt1Limit: 0n,
  });
}
