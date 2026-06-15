import { type Address, encodeFunctionData, erc20Abi } from "viem";
import { PERP_ABI } from "../abis/perp";
import type { PerpCityContext } from "../context";
import type { PerpAddress } from "../types";
import type {
  CallData,
  ClosePositionParams,
  OpenMakerPositionParams,
  OpenTakerPositionParams,
} from "../types/entity-data";
import { scale6Decimals } from "../utils";
import { withErrorHandling } from "../utils/errors";
import { calculateAlignedTicks } from "./perp-actions";

// Calldata builders mirror the on-chain calls made by the execute-and-wait
// functions in `perp-actions.ts` / `position.ts`, but return raw calldata
// instead of submitting it. They deliberately omit fee headroom and gas tuning
// (`withFeeHeadroom`): those are EOA `writeContract` concerns, whereas a
// userOperation's gas is estimated and paid by the bundler/paymaster. The
// argument encoding is identical, so a built call hits the same contract path
// as the executed equivalent.

function requireAccount(context: PerpCityContext): Address {
  const account = context.walletClient.account?.address;
  if (!account) throw new Error("Wallet account is required");
  return account;
}

function toContractAmount(value: number | bigint | undefined): bigint {
  if (value === undefined) return 0n;
  return typeof value === "bigint" ? value : scale6Decimals(value);
}

/** ERC-20 `approve(spender, amount)` against the configured USDC token. */
export function buildApproveUsdcCall(
  context: PerpCityContext,
  amount: bigint,
  spender: Address
): CallData {
  if (!spender) throw new Error("buildApproveUsdcCall requires a spender/perp address");
  return {
    to: context.deployments().usdc,
    data: encodeFunctionData({
      abi: erc20Abi,
      functionName: "approve",
      args: [spender, amount],
    }),
    value: 0n,
  };
}

/** `Perp.openTaker` calldata. Mirrors {@link openTakerPosition}. */
export function buildOpenTakerPositionCall(
  context: PerpCityContext,
  perpAddress: PerpAddress,
  params: OpenTakerPositionParams
): CallData {
  if (params.margin <= 0) throw new Error("Margin must be greater than 0");
  if (params.perpDelta === 0n) throw new Error("perpDelta must be non-zero");

  return {
    to: perpAddress,
    data: encodeFunctionData({
      abi: PERP_ABI,
      functionName: "openTaker",
      args: [
        {
          holder: requireAccount(context),
          margin: scale6Decimals(params.margin),
          perpDelta: params.perpDelta,
          amt1Limit: params.amt1Limit,
        },
      ],
    }),
    value: 0n,
  };
}

/** `Perp.openMaker` calldata. Mirrors {@link openMakerPosition}. */
export async function buildOpenMakerPositionCall(
  context: PerpCityContext,
  perpAddress: PerpAddress,
  params: OpenMakerPositionParams
): Promise<CallData> {
  return withErrorHandling(async () => {
    if (params.margin <= 0) throw new Error("Margin must be greater than 0");
    if (params.priceLower >= params.priceUpper)
      throw new Error("priceLower must be less than priceUpper");

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

    return {
      to: perpAddress,
      data: encodeFunctionData({
        abi: PERP_ABI,
        functionName: "openMaker",
        args: [
          {
            holder: requireAccount(context),
            margin: scale6Decimals(params.margin),
            tickLower: alignedTickLower,
            tickUpper: alignedTickUpper,
            liquidity: params.liquidity,
            maxAmt0In,
            maxAmt1In,
          },
        ],
      }),
      value: 0n,
    };
  }, "buildOpenMakerPositionCall");
}

/** `Perp.adjustTaker` calldata. Mirrors {@link adjustTaker}. */
export function buildAdjustTakerCall(
  perpAddress: PerpAddress,
  params: { posId: bigint; marginDelta: bigint; perpDelta: bigint; amt1Limit: bigint }
): CallData {
  return {
    to: perpAddress,
    data: encodeFunctionData({ abi: PERP_ABI, functionName: "adjustTaker", args: [params] }),
    value: 0n,
  };
}

/** `Perp.adjustMaker` calldata. Mirrors {@link adjustMaker}. */
export function buildAdjustMakerCall(
  perpAddress: PerpAddress,
  params: {
    posId: bigint;
    marginDelta: bigint;
    liquidityDelta: bigint;
    amt0Limit: bigint;
    amt1Limit: bigint;
  }
): CallData {
  return {
    to: perpAddress,
    data: encodeFunctionData({ abi: PERP_ABI, functionName: "adjustMaker", args: [params] }),
    value: 0n,
  };
}

/**
 * Calldata that closes `positionId`. Reads the position to decide maker vs.
 * taker and the unwind deltas, exactly as {@link closePosition} does, then
 * returns the matching `adjustMaker` / `adjustTaker` call.
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
      });
    }
    return buildAdjustTakerCall(perpAddress, {
      posId: positionId,
      marginDelta: 0n,
      perpDelta: -rawData.entryPerpDelta,
      amt1Limit: toContractAmount(params.amt1Limit),
    });
  }, `buildClosePositionCall for position ${positionId}`);
}

async function maybeApprovalCall(
  context: PerpCityContext,
  spender: Address,
  requiredAmount: bigint
): Promise<CallData | null> {
  const currentAllowance = (await context.publicClient.readContract({
    address: context.deployments().usdc,
    abi: erc20Abi,
    functionName: "allowance",
    args: [requireAccount(context), spender],
    blockTag: "latest",
  })) as bigint;
  if (currentAllowance >= requiredAmount) return null;
  return buildApproveUsdcCall(context, requiredAmount, spender);
}

/**
 * Full ordered call batch for opening a taker position: a USDC `approve` (only
 * when the current allowance is short) followed by `openTaker`. Submit the
 * whole array as one atomic userOperation so approval and trade settle
 * together — the equivalent of the SDK's internal `ensureUsdcAllowance`, but as
 * a single sponsored transaction instead of two sequential ones.
 */
export async function buildOpenTakerPositionCalls(
  context: PerpCityContext,
  perpAddress: PerpAddress,
  params: OpenTakerPositionParams
): Promise<CallData[]> {
  const calls: CallData[] = [];
  const approval = await maybeApprovalCall(context, perpAddress, scale6Decimals(params.margin));
  if (approval) calls.push(approval);
  calls.push(buildOpenTakerPositionCall(context, perpAddress, params));
  return calls;
}

/** Full ordered call batch for opening a maker position; see {@link buildOpenTakerPositionCalls}. */
export async function buildOpenMakerPositionCalls(
  context: PerpCityContext,
  perpAddress: PerpAddress,
  params: OpenMakerPositionParams
): Promise<CallData[]> {
  const calls: CallData[] = [];
  const approval = await maybeApprovalCall(context, perpAddress, scale6Decimals(params.margin));
  if (approval) calls.push(approval);
  calls.push(await buildOpenMakerPositionCall(context, perpAddress, params));
  return calls;
}
