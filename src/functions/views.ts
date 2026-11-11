import type {
  ContractFunctionArgs,
  ContractFunctionName,
  ContractFunctionReturnType,
  PublicClient,
} from "viem";
import { PERP_ABI } from "../abis/perp";
import type { PerpAddress } from "../types";
import type {
  CumulativesStruct,
  MakerStruct,
  PositionPreview,
  PositionStruct,
  RatesStruct,
  TakerStruct,
} from "../types/entity-data";

/** Every `view` function on the v1.0.0 Perp. */
export type PerpViewName = ContractFunctionName<typeof PERP_ABI, "view" | "pure">;

export type ReadOptions = { blockNumber?: bigint };

/**
 * Read any v1 Perp view with the vendored v1.0.0 ABI. Structs decode to
 * objects with the Solidity field names.
 */
export async function readPerpView<N extends PerpViewName>(
  client: PublicClient,
  perp: PerpAddress,
  functionName: N,
  args?: ContractFunctionArgs<typeof PERP_ABI, "view" | "pure", N>,
  opts: ReadOptions = {}
): Promise<ContractFunctionReturnType<typeof PERP_ABI, "view" | "pure", N>> {
  const request = {
    address: perp,
    abi: PERP_ABI,
    functionName,
    ...(args === undefined ? {} : { args }),
    ...(opts.blockNumber === undefined ? {} : { blockNumber: opts.blockNumber }),
  };
  return (await client.readContract(
    request as Parameters<PublicClient["readContract"]>[0]
  )) as ContractFunctionReturnType<typeof PERP_ABI, "view" | "pure", N>;
}

export async function readPosition(
  client: PublicClient,
  perp: PerpAddress,
  posId: bigint,
  opts?: ReadOptions
): Promise<PositionStruct> {
  const p = await readPerpView(client, perp, "positions", [posId], opts);
  return { delta: p.delta, margin: p.margin, lastCumlFundingX96: p.lastCumlFundingX96 };
}

export async function readMakerDetails(
  client: PublicClient,
  perp: PerpAddress,
  posId: bigint,
  opts?: ReadOptions
): Promise<MakerStruct> {
  const m = await readPerpView(client, perp, "makerDetails", [posId], opts);
  return {
    tickLower: Number(m.tickLower),
    tickUpper: Number(m.tickUpper),
    liquidity: m.liquidity,
    lastLpFeeGrowthInsideX128: m.lastLpFeeGrowthInsideX128,
    lastCumlFunding: {
      belowX96: m.lastCumlFunding.belowX96,
      withinInventoryX192: m.lastCumlFunding.withinInventoryX192,
    },
    lastFundingCorrectionX128: m.lastFundingCorrectionX128,
  };
}

export async function readTakerDetails(
  client: PublicClient,
  perp: PerpAddress,
  posId: bigint,
  opts?: ReadOptions
): Promise<TakerStruct> {
  const t = await readPerpView(client, perp, "takerDetails", [posId], opts);
  return {
    lastUtilPaymentsX96: t.lastUtilPaymentsX96,
    lastReserveUtilPaymentsX96: t.lastReserveUtilPaymentsX96,
  };
}

/**
 * `previewPosition(posId)`: the contract's own settlement and health for the
 * position, accrued to the current block without a write. This is the v1
 * source of truth for equity, PnL, pending funding and liquidatability; the
 * SDK does not reimplement v1 margin math.
 */
export async function readPositionPreview(
  client: PublicClient,
  perp: PerpAddress,
  posId: bigint,
  opts?: ReadOptions
): Promise<PositionPreview> {
  const p = await readPerpView(client, perp, "previewPosition", [posId], opts);
  return { ...p };
}

export async function readRates(
  client: PublicClient,
  perp: PerpAddress,
  opts?: ReadOptions
): Promise<RatesStruct> {
  const r = await readPerpView(client, perp, "rates", undefined, opts);
  return {
    fundingPerDay: r.fundingPerDay,
    longUtilFeePerDay: r.longUtilFeePerDay,
    shortUtilFeePerDay: r.shortUtilFeePerDay,
    lastTouch: Number(r.lastTouch),
    lastMark: r.lastMark,
  };
}

export async function readCumulatives(
  client: PublicClient,
  perp: PerpAddress,
  opts?: ReadOptions
): Promise<CumulativesStruct> {
  const c = await readPerpView(client, perp, "cumulatives", undefined, opts);
  return { ...c };
}
