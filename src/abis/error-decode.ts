import { keccak256, toBytes } from "viem";
import { BEACON_ABI } from "./beacon";
import { FEES_ABI } from "./fees";
import { FUNDING_ABI } from "./funding";
import { MARGIN_RATIOS_ABI } from "./margin-ratios";
import { MODULE_REGISTRY_ABI } from "./module-registry";
import { PERP_ABI } from "./perp";
import { PERP_FACTORY_ABI } from "./perp-factory";
import { PERP_GUARD_HOOK_ABI } from "./perp-guard-hook";
import { PRICE_IMPACT_ABI } from "./price-impact";
import { PRICING_ABI } from "./pricing";
import { PROTOCOL_FEE_MANAGER_ABI } from "./protocol-fee-manager";
import { WITHDRAWAL_CONTROLLER_ABI } from "./withdrawal-controller";

/** Uniswap V4 PoolManager errors (lib/v4-core IPoolManager.sol). */
export const POOL_MANAGER_ERROR_ABI = [
  { type: "error", name: "CurrencyNotSettled", inputs: [] },
  { type: "error", name: "PoolNotInitialized", inputs: [] },
  { type: "error", name: "AlreadyUnlocked", inputs: [] },
  { type: "error", name: "ManagerLocked", inputs: [] },
  { type: "error", name: "TickSpacingTooLarge", inputs: [{ type: "int24", name: "tickSpacing" }] },
  { type: "error", name: "TickSpacingTooSmall", inputs: [{ type: "int24", name: "tickSpacing" }] },
  {
    type: "error",
    name: "CurrenciesOutOfOrderOrEqual",
    inputs: [
      { type: "address", name: "currency0" },
      { type: "address", name: "currency1" },
    ],
  },
  { type: "error", name: "UnauthorizedDynamicLPFeeUpdate", inputs: [] },
  { type: "error", name: "SwapAmountCannotBeZero", inputs: [] },
  { type: "error", name: "NonzeroNativeValue", inputs: [] },
  { type: "error", name: "MustClearExactPositiveDelta", inputs: [] },
] as const;

export const POOL_MANAGER_ERROR_NAMES: ReadonlySet<string> = new Set(
  POOL_MANAGER_ERROR_ABI.map((entry) => entry.name)
);

/** solady SafeTransferLib errors: a USDC balance or allowance shortfall reverts TransferFromFailed. */
const SAFE_TRANSFER_ERROR_ABI = [
  { type: "error", name: "TransferFromFailed", inputs: [] },
  { type: "error", name: "TransferFailed", inputs: [] },
  { type: "error", name: "ApproveFailed", inputs: [] },
] as const;

type ErrorItem = { type: "error"; name: string; inputs: readonly { type: string }[] };

const errorSignature = (entry: ErrorItem) =>
  `${entry.name}(${entry.inputs.map((input) => input.type).join(",")})`;

function errorsOf(...abis: readonly (readonly { type: string }[])[]): ErrorItem[] {
  const seen = new Set<string>();
  const out: ErrorItem[] = [];
  for (const item of abis.flat()) {
    if (item.type !== "error") continue;
    const entry = item as ErrorItem;
    const signature = errorSignature(entry);
    if (seen.has(signature)) continue;
    seen.add(signature);
    out.push(entry);
  }
  return out;
}

/**
 * Every error a v1.0.0 market path can revert with: the Perp and library set,
 * the factory, hook, withdrawal controller, modules, beacon and verifier,
 * Uniswap V4 PoolManager and solady SafeTransferLib. `parseContractError`
 * falls back to it when the call-site ABI cannot decode a revert.
 */
export const EXTENDED_ERROR_DECODE_ABI = errorsOf(
  PERP_ABI,
  PERP_FACTORY_ABI,
  PERP_GUARD_HOOK_ABI,
  WITHDRAWAL_CONTROLLER_ABI,
  PROTOCOL_FEE_MANAGER_ABI,
  MODULE_REGISTRY_ABI,
  FEES_ABI,
  FUNDING_ABI,
  MARGIN_RATIOS_ABI,
  PRICE_IMPACT_ABI,
  PRICING_ABI,
  BEACON_ABI,
  POOL_MANAGER_ERROR_ABI,
  SAFE_TRANSFER_ERROR_ABI
);

function errorSelector(signature: string): `0x${string}` {
  return keccak256(toBytes(signature)).slice(0, 10) as `0x${string}`;
}

/** 4-byte selector of every error in `EXTENDED_ERROR_DECODE_ABI`, by name. */
export const ERROR_SELECTORS: Record<string, `0x${string}`> = Object.fromEntries(
  EXTENDED_ERROR_DECODE_ABI.map((entry) => [entry.name, errorSelector(errorSignature(entry))])
);
