import { type Address, encodeFunctionData, erc20Abi } from "viem";
import { PERP_ABI } from "../abis/perp";
import type { PerpCityContext } from "../context";
import type { PerpAddress } from "../types";
import type {
  AdjustMakerParams,
  AdjustTakerParams,
  CallData,
  ClosePositionParams,
  MoveMakerParams,
  OpenMakerPositionParams,
  OpenTakerPositionParams,
} from "../types/entity-data";
import { scale6Decimals } from "../utils/conversions";
import { withErrorHandling } from "../utils/errors";
import { calculateAlignedTicks } from "../utils/ticks";

// Calldata builders return the exact v1 call that the execute-and-wait
// functions in `perp-actions.ts` submit. Every trade carries a `deadline`;
// taker trades also carry `maxTotalFee`, and taker adjustments `reduceOnly`.

/** Default lifetime of a built call: 10 minutes. */
export const DEFAULT_DEADLINE_SECONDS = 600n;

/** `now + seconds`, as the uint64 unix timestamp the contract compares to `block.timestamp`. */
export function deadlineIn(seconds: bigint = DEFAULT_DEADLINE_SECONDS): bigint {
  return BigInt(Math.floor(Date.now() / 1000)) + seconds;
}

const resolveDeadline = (deadline: bigint | undefined) => deadline ?? deadlineIn();

/**
 * An upper bound for `maxTotalFee` on a taker swap of `usdVolume` (USDC, 6
 * decimals, either sign): the volume at the fees module's `maxSwapFee()` plus
 * the perp's cached protocol fee, rounded up, plus `roundingSlack` for the
 * per-segment round-ups. The contract compares the sum of the LP, protocol,
 * creator and insurance fees to this value.
 */
export function maxTotalFeeFor(
  usdVolume: bigint,
  rates: { maxSwapFeeE6: bigint; protocolFeeE6: bigint },
  roundingSlack = 100n
): bigint {
  const volume = usdVolume < 0n ? -usdVolume : usdVolume;
  const rate = rates.maxSwapFeeE6 + rates.protocolFeeE6;
  return (volume * rate + 999_999n) / 1_000_000n + roundingSlack;
}

function requireAccount(context: PerpCityContext): Address {
  const account = context.walletClient.account?.address;
  if (!account) throw new Error("Wallet account is required");
  return account;
}

function toContractAmount(value: number | bigint | undefined): bigint {
  if (value === undefined) return 0n;
  return typeof value === "bigint" ? value : scale6Decimals(value);
}

const perpCall = (to: PerpAddress, data: `0x${string}`): CallData => ({ to, data, value: 0n });

/** ERC-20 `approve(spender, amount)` against the configured USDC token. */
export function buildApproveUsdcCall(
  context: PerpCityContext,
  amount: bigint,
  spender: Address
): CallData {
  if (!spender) throw new Error("buildApproveUsdcCall requires a spender/perp address");
  return {
    to: context.deployments().usdc,
    data: encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: [spender, amount] }),
    value: 0n,
  };
}

/** `Perp.openTaker(OpenTakerParams)` calldata. */
export function buildOpenTakerPositionCall(
  context: PerpCityContext,
  perpAddress: PerpAddress,
  params: OpenTakerPositionParams
): CallData {
  if (params.margin <= 0) throw new Error("Margin must be greater than 0");
  if (params.perpDelta === 0n) throw new Error("perpDelta must be non-zero");
  return perpCall(
    perpAddress,
    encodeFunctionData({
      abi: PERP_ABI,
      functionName: "openTaker",
      args: [
        {
          holder: params.holder ?? requireAccount(context),
          margin: scale6Decimals(params.margin),
          perpDelta: params.perpDelta,
          amt1Limit: params.amt1Limit,
          maxTotalFee: params.maxTotalFee,
          deadline: resolveDeadline(params.deadline),
        },
      ],
    })
  );
}

/** `Perp.adjustTaker(AdjustTakerParams)` calldata. */
export function buildAdjustTakerCall(
  perpAddress: PerpAddress,
  params: AdjustTakerParams
): CallData {
  return perpCall(
    perpAddress,
    encodeFunctionData({
      abi: PERP_ABI,
      functionName: "adjustTaker",
      args: [
        {
          posId: params.posId,
          marginDelta: params.marginDelta,
          perpDelta: params.perpDelta,
          amt1Limit: params.amt1Limit,
          maxTotalFee: params.maxTotalFee,
          reduceOnly: params.reduceOnly,
          deadline: resolveDeadline(params.deadline),
        },
      ],
    })
  );
}

/** `Perp.openMaker(OpenMakerParams)` calldata. Ticks are aligned to the market tick spacing. */
export async function buildOpenMakerPositionCall(
  context: PerpCityContext,
  perpAddress: PerpAddress,
  params: OpenMakerPositionParams
): Promise<CallData> {
  return withErrorHandling(async () => {
    if (params.margin <= 0) throw new Error("Margin must be greater than 0");
    if (params.priceLower >= params.priceUpper)
      throw new Error("priceLower must be less than priceUpper");

    const { key } = await context.getPerpConfig(perpAddress);
    const { alignedTickLower, alignedTickUpper } = calculateAlignedTicks(
      params.priceLower,
      params.priceUpper,
      key.tickSpacing
    );
    return perpCall(
      perpAddress,
      encodeFunctionData({
        abi: PERP_ABI,
        functionName: "openMaker",
        args: [
          {
            holder: params.holder ?? requireAccount(context),
            margin: scale6Decimals(params.margin),
            tickLower: alignedTickLower,
            tickUpper: alignedTickUpper,
            liquidity: params.liquidity,
            maxAmt0In: toContractAmount(params.maxAmt0In),
            maxAmt1In: toContractAmount(params.maxAmt1In),
            deadline: resolveDeadline(params.deadline),
          },
        ],
      })
    );
  }, "buildOpenMakerPositionCall");
}

/** `Perp.adjustMaker(AdjustMakerParams)` calldata. */
export function buildAdjustMakerCall(
  perpAddress: PerpAddress,
  params: AdjustMakerParams
): CallData {
  return perpCall(
    perpAddress,
    encodeFunctionData({
      abi: PERP_ABI,
      functionName: "adjustMaker",
      args: [
        {
          posId: params.posId,
          marginDelta: params.marginDelta,
          liquidityDelta: params.liquidityDelta,
          amt0Limit: params.amt0Limit,
          amt1Limit: params.amt1Limit,
          deadline: resolveDeadline(params.deadline),
        },
      ],
    })
  );
}

/** `Perp.moveMaker(MoveMakerParams)` calldata: replace a maker range on the same position id. */
export function buildMoveMakerCall(perpAddress: PerpAddress, params: MoveMakerParams): CallData {
  return perpCall(
    perpAddress,
    encodeFunctionData({
      abi: PERP_ABI,
      functionName: "moveMaker",
      args: [
        {
          posId: params.posId,
          tickLower: params.tickLower,
          tickUpper: params.tickUpper,
          liquidity: params.liquidity,
          removeAmt0Min: params.removeAmt0Min,
          removeAmt1Min: params.removeAmt1Min,
          addAmt0Max: params.addAmt0Max,
          addAmt1Max: params.addAmt1Max,
          marginDelta: params.marginDelta,
          deadline: resolveDeadline(params.deadline),
        },
      ],
    })
  );
}

/**
 * Calldata that fully closes `positionId`. A maker removes all its liquidity;
 * a taker sells its whole perp inventory with `reduceOnly: true`, so a stale
 * size can never flip the position.
 */
export async function buildClosePositionCall(
  context: PerpCityContext,
  perpAddress: PerpAddress,
  positionId: bigint,
  params: ClosePositionParams
): Promise<CallData> {
  return withErrorHandling(async () => {
    const rawData = await context.getPositionRawData(perpAddress, positionId);
    if (rawData.makerDetails) {
      return buildAdjustMakerCall(perpAddress, {
        posId: positionId,
        marginDelta: 0n,
        liquidityDelta: -rawData.makerDetails.liquidity,
        amt0Limit: toContractAmount(params.amt0Limit),
        amt1Limit: toContractAmount(params.amt1Limit),
        deadline: params.deadline,
      });
    }
    if (params.maxTotalFee === undefined) {
      throw new Error("maxTotalFee is required to close a taker position");
    }
    return buildAdjustTakerCall(perpAddress, {
      posId: positionId,
      marginDelta: 0n,
      perpDelta: -rawData.perpDelta,
      amt1Limit: toContractAmount(params.amt1Limit),
      maxTotalFee: params.maxTotalFee,
      reduceOnly: true,
      deadline: params.deadline,
    });
  }, `buildClosePositionCall for position ${positionId}`);
}

async function maybeApprovalCall(
  context: PerpCityContext,
  spender: Address,
  requiredAmount: bigint
): Promise<CallData | null> {
  const currentAllowance = await context.publicClient.readContract({
    address: context.deployments().usdc,
    abi: erc20Abi,
    functionName: "allowance",
    args: [requireAccount(context), spender],
    blockTag: "latest",
  });
  if (currentAllowance >= requiredAmount) return null;
  return buildApproveUsdcCall(context, requiredAmount, spender);
}

async function withApproval(
  context: PerpCityContext,
  perpAddress: PerpAddress,
  requiredAmount: bigint,
  call: CallData
): Promise<CallData[]> {
  const approval =
    requiredAmount > 0n ? await maybeApprovalCall(context, perpAddress, requiredAmount) : null;
  return approval ? [approval, call] : [call];
}

/**
 * Ordered batch for opening a taker: a USDC `approve` (only when the allowance
 * is short) then `openTaker`. Submit it as one atomic userOperation.
 */
export async function buildOpenTakerPositionCalls(
  context: PerpCityContext,
  perpAddress: PerpAddress,
  params: OpenTakerPositionParams
): Promise<CallData[]> {
  const call = buildOpenTakerPositionCall(context, perpAddress, params);
  return withApproval(context, perpAddress, scale6Decimals(params.margin), call);
}

/** Ordered batch for a taker adjustment; the approval covers a positive `marginDelta`. */
export async function buildAdjustTakerCalls(
  context: PerpCityContext,
  perpAddress: PerpAddress,
  params: AdjustTakerParams
): Promise<CallData[]> {
  const marginIn = params.marginDelta > 0n ? params.marginDelta : 0n;
  return withApproval(context, perpAddress, marginIn, buildAdjustTakerCall(perpAddress, params));
}

/**
 * Ordered batch for a maker adjustment. Adding liquidity can pull the USD leg
 * (up to `amt1Limit`) on top of the margin, so the approval covers both.
 */
export async function buildAdjustMakerCalls(
  context: PerpCityContext,
  perpAddress: PerpAddress,
  params: AdjustMakerParams
): Promise<CallData[]> {
  const marginIn = params.marginDelta > 0n ? params.marginDelta : 0n;
  const usdLegIn = params.liquidityDelta > 0n ? params.amt1Limit : 0n;
  return withApproval(
    context,
    perpAddress,
    marginIn + usdLegIn,
    buildAdjustMakerCall(perpAddress, params)
  );
}

/** Ordered batch for a maker move; the approval covers margin in plus the new range's USD leg. */
export async function buildMoveMakerCalls(
  context: PerpCityContext,
  perpAddress: PerpAddress,
  params: MoveMakerParams
): Promise<CallData[]> {
  const marginIn = params.marginDelta > 0n ? params.marginDelta : 0n;
  return withApproval(
    context,
    perpAddress,
    marginIn + params.addAmt1Max,
    buildMoveMakerCall(perpAddress, params)
  );
}

/**
 * Ordered batch for opening a maker. `openMaker` can pull the margin and the
 * USD leg of the deposit (up to `maxAmt1In`), so the approval covers both.
 */
export async function buildOpenMakerPositionCalls(
  context: PerpCityContext,
  perpAddress: PerpAddress,
  params: OpenMakerPositionParams
): Promise<CallData[]> {
  const call = await buildOpenMakerPositionCall(context, perpAddress, params);
  const required = scale6Decimals(params.margin) + toContractAmount(params.maxAmt1In);
  return withApproval(context, perpAddress, required, call);
}
