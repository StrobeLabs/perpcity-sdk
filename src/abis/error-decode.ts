import { keccak256, toBytes } from "viem";

/**
 * Decode-only error ABI for reverts the call-site ABIs cannot decode.
 *
 * The deployed Perp reverts with errors that are not part of its own ABI
 * artifact: solady's SafeTransferLib errors bubble up when USDC pulls fail,
 * Uniswap V4 PoolManager errors surface through the unlock callback, and
 * markets still running the v0.0.1 contracts throw that generation's error
 * set (verified against perpcity-contracts tags v0.0.1 and lib/v4-core).
 *
 * This ABI exists solely as a fallback for `parseContractError` - it is NOT
 * part of the vendored PERP_ABI, which stays faithful to the deployed v0.1.0
 * artifact. Errors already decodable from PERP_ABI are deliberately absent.
 */
export const EXTENDED_ERROR_DECODE_ABI = [
  // solady SafeTransferLib (inlined into the deployed Perp; a USDC balance or
  // allowance shortfall reverts with TransferFromFailed)
  { type: "error", name: "TransferFromFailed", inputs: [] },
  { type: "error", name: "TransferFailed", inputs: [] },
  { type: "error", name: "ApproveFailed", inputs: [] },
  // Uniswap V4 PoolManager (lib/v4-core IPoolManager.sol)
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
  // perpcity-contracts v0.0.1 error set (names absent from the v0.1.0 ABI)
  { type: "error", name: "CouldNotFullyFill", inputs: [] },
  { type: "error", name: "PerpDoesNotExist", inputs: [] },
  { type: "error", name: "TransferNotAllowed", inputs: [] },
  { type: "error", name: "ZeroNotional", inputs: [] },
  { type: "error", name: "InvalidMarginDelta", inputs: [] },
  { type: "error", name: "BeaconNotRegistered", inputs: [] },
  { type: "error", name: "InvalidCaller", inputs: [] },
  { type: "error", name: "InvalidMargin", inputs: [] },
  { type: "error", name: "InvalidMarginRatio", inputs: [] },
  { type: "error", name: "MakerNotAllowed", inputs: [] },
  { type: "error", name: "MaximumAmountExceeded", inputs: [] },
  { type: "error", name: "MinimumAmountInsufficient", inputs: [] },
  { type: "error", name: "PositionLocked", inputs: [] },
  { type: "error", name: "InvalidAction", inputs: [{ type: "uint8", name: "action" }] },
  { type: "error", name: "ModuleNotRegistered", inputs: [{ type: "uint8", name: "moduleType" }] },
  { type: "error", name: "StartingSqrtPriceTooHigh", inputs: [] },
  { type: "error", name: "StartingSqrtPriceTooLow", inputs: [] },
  { type: "error", name: "FeeTooLarge", inputs: [] },
] as const;

function errorSelector(signature: string): `0x${string}` {
  return keccak256(toBytes(signature)).slice(0, 10) as `0x${string}`;
}

/**
 * 4-byte selectors for the decode ABI's errors plus the PERP_ABI errors that
 * raw-data probes match against (see utils/liquidity.ts). Derived from the
 * signatures at module load so they can never drift from the ABI entries.
 */
export const ERROR_SELECTORS: Record<string, `0x${string}`> = Object.fromEntries([
  ...EXTENDED_ERROR_DECODE_ABI.map((entry) => [
    entry.name,
    errorSelector(`${entry.name}(${entry.inputs.map((input) => input.type).join(",")})`),
  ]),
  ["MarginRatioTooLow", errorSelector("MarginRatioTooLow()")],
]);
