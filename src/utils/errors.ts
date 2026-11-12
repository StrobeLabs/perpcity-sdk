import {
  type Abi,
  BaseError,
  ContractFunctionRevertedError,
  ContractFunctionZeroDataError,
  decodeErrorResult,
  FeeCapTooLowError,
  type Hex,
} from "viem";
import { EXTENDED_ERROR_DECODE_ABI, POOL_MANAGER_ERROR_NAMES } from "../abis/error-decode";
import { MIN_OPENING_MARGIN_USD } from "./constants";

/**
 * Error category classification
 */
export enum ErrorCategory {
  USER_ERROR = "USER_ERROR",
  STATE_ERROR = "STATE_ERROR",
  SYSTEM_ERROR = "SYSTEM_ERROR",
  CONFIG_ERROR = "CONFIG_ERROR",
}

/**
 * Contract source classification
 */
export enum ErrorSource {
  PERP = "PERP",
  POOL_MANAGER = "POOL_MANAGER",
  UNKNOWN = "UNKNOWN",
}

/**
 * Stable machine-readable error codes. Bots should branch on `error.code`
 * (coarse, stable across SDK versions) and may inspect `errorName` for the
 * exact contract error (fine-grained, tracks the deployed contracts).
 *
 * `CONTRACT_REVERT` means the revert was decoded but has no dedicated code;
 * `UNKNOWN` means the revert data could not be decoded at all.
 */
export const PERPCITY_ERROR_CODES = [
  "INSUFFICIENT_USDC_BALANCE",
  "INSUFFICIENT_USDC_ALLOWANCE",
  "INSUFFICIENT_GAS",
  "MARGIN_BELOW_MINIMUM",
  "MARGIN_RATIO_TOO_LOW",
  "SLIPPAGE_EXCEEDED",
  "PRICE_IMPACT_TOO_HIGH",
  "INSUFFICIENT_LIQUIDITY",
  "POSITION_NOT_FOUND",
  "WRONG_POSITION_KIND",
  "NOT_LIQUIDATABLE",
  "MARKET_ABDICATED",
  "UNAUTHORIZED",
  "USER_REJECTED",
  "TX_REVERTED_ONCHAIN",
  "CONTRACT_REVERT",
  "RPC_ERROR",
  "VALIDATION_ERROR",
  "UNKNOWN",
  "DEADLINE_EXPIRED",
  "FEE_CAP_EXCEEDED",
  "REDUCE_ONLY_VIOLATED",
  "CLOSE_CAPACITY_EXCEEDED",
  "STALE_INDEX",
  "WITHDRAWAL_NOT_READY",
  "WITHDRAWAL_PAUSED",
  "WITHDRAWAL_NOT_PENDING",
  "TVL_CAP_EXCEEDED",
] as const;

export type PerpCityErrorCode = (typeof PERPCITY_ERROR_CODES)[number];

/**
 * Debug information for contract errors
 */
export interface ErrorDebugInfo {
  errorSelector?: string;
  source: ErrorSource;
  category: ErrorCategory;
  rawData?: string;
  canRetry?: boolean;
  retryGuidance?: string;
}

/**
 * Base class for all PerpCity SDK errors.
 *
 * `code` is the stable machine-readable classification. `operation` names the
 * SDK entry point that failed (set by `withErrorHandling`). `shortMessage` is
 * the message without the operation prefix.
 */
export class PerpCityError extends Error {
  public operation?: string;
  public shortMessage?: string;

  constructor(
    message: string,
    public readonly cause?: Error,
    public readonly code: PerpCityErrorCode = "UNKNOWN"
  ) {
    super(message);
    this.name = "PerpCityError";
  }
}

/**
 * Error thrown when a contract call reverts
 */
export class ContractError extends PerpCityError {
  constructor(
    message: string,
    public readonly errorName?: string,
    public readonly args?: readonly unknown[],
    public readonly debug?: ErrorDebugInfo,
    cause?: Error
  ) {
    super(message, cause, codeForErrorName(errorName ?? "Unknown"));
    this.name = "ContractError";
  }
}

/**
 * Error thrown when a transaction is rejected by the user
 */
export class TransactionRejectedError extends PerpCityError {
  constructor(message = "Transaction rejected by user", cause?: Error) {
    super(message, cause, "USER_REJECTED");
    this.name = "TransactionRejectedError";
  }
}

/**
 * Error thrown when the wallet cannot cover gas for the transaction
 */
export class InsufficientFundsError extends PerpCityError {
  constructor(message = "Insufficient funds for transaction", cause?: Error) {
    super(message, cause, "INSUFFICIENT_GAS");
    this.name = "InsufficientFundsError";
  }
}

/**
 * Error thrown when an RPC call fails
 */
export class RPCError extends PerpCityError {
  constructor(message: string, cause?: Error) {
    super(message, cause, "RPC_ERROR");
    this.name = "RPCError";
  }
}

/**
 * Error thrown when validation fails
 */
export class ValidationError extends PerpCityError {
  constructor(message: string, cause?: Error, code: PerpCityErrorCode = "VALIDATION_ERROR") {
    super(message, cause, code);
    this.name = "ValidationError";
  }
}

/**
 * Error thrown when a transaction was mined but reverted on-chain.
 * Rare in practice: every write path simulates first.
 */
export class TransactionRevertedError extends PerpCityError {
  constructor(
    public readonly txHash: Hex,
    cause?: Error
  ) {
    super(`Transaction reverted. Hash: ${txHash}`, cause, "TX_REVERTED_ONCHAIN");
    this.name = "TransactionRevertedError";
  }
}

/**
 * True when a read failed because the contract has no such view (it reverted
 * or returned no data), not because the RPC failed. Use it to tell a missing
 * view apart from a transport error before falling back.
 */
export function isMissingViewError(error: unknown): boolean {
  if (!(error instanceof BaseError)) return false;
  return Boolean(
    error.walk(
      (cause) =>
        cause instanceof ContractFunctionRevertedError ||
        cause instanceof ContractFunctionZeroDataError
    )
  );
}

/**
 * Parse and format a contract error into a user-friendly message
 */
export function parseContractError(error: unknown): PerpCityError {
  if (error instanceof PerpCityError) {
    return error;
  }

  // Handle viem BaseError
  if (error instanceof BaseError) {
    // Checked before the revert walk: some RPCs report a too-low fee cap as a
    // "revert" of the called function, which would otherwise parse as
    // ContractError "Unknown".
    const feeCapError = error.walk((err) => err instanceof FeeCapTooLowError);
    if (feeCapError || error.message?.includes("max fee per gas less than block base fee")) {
      return new RPCError(
        "Network fee spiked while the transaction was being submitted. No funds moved - please try again.",
        error as Error
      );
    }

    const revertError = error.walk((err) => err instanceof ContractFunctionRevertedError);

    if (revertError instanceof ContractFunctionRevertedError) {
      let errorName = revertError.data?.errorName;
      let args: readonly unknown[] = revertError.data?.args ?? [];
      const raw = revertError.raw;

      // The call-site ABI could not decode the revert (for example a module
      // ABI, or a Uniswap V4 / solady error): try the full v1 error set.
      if (!errorName && raw) {
        try {
          const decoded = decodeErrorResult({ abi: EXTENDED_ERROR_DECODE_ABI, data: raw });
          errorName = decoded.errorName;
          args = decoded.args ?? [];
        } catch (_decodeError) {
          // Selector unknown to every ABI we ship; surfaces as "Unknown".
        }
      }

      const resolvedName = errorName ?? "Unknown";
      const { message, debug } = formatContractError(resolvedName, args);
      debug.errorSelector = revertError.signature ?? (raw ? raw.slice(0, 10) : undefined);
      debug.rawData = raw;
      return new ContractError(message, resolvedName, args, debug, error as Error);
    }

    // Check for user rejection
    if (error.message?.includes("User rejected") || (error as any).code === 4001) {
      return new TransactionRejectedError(error.message, error as Error);
    }

    // Check for insufficient funds
    if (error.message?.includes("insufficient funds")) {
      return new InsufficientFundsError(error.message, error as Error);
    }

    return new PerpCityError(error.shortMessage || error.message, error as Error);
  }

  // Handle generic errors
  if (error instanceof Error) {
    return new PerpCityError(error.message, error);
  }

  return new PerpCityError(String(error));
}

/**
 * Build a ContractError from raw revert data (for example an `eth_simulateV1`
 * call result). Tries `abi` first, then the extended decode-only ABI. Data
 * that no ABI knows becomes errorName "Unknown" (code UNKNOWN).
 */
export function contractErrorFromRevertData(
  data: Hex,
  abi: Abi = [],
  cause?: Error
): ContractError {
  let errorName = "Unknown";
  let args: readonly unknown[] = [];
  for (const candidate of [abi, EXTENDED_ERROR_DECODE_ABI]) {
    if (!data || data === "0x") break;
    try {
      const decoded = decodeErrorResult({ abi: candidate as Abi, data });
      errorName = decoded.errorName;
      args = decoded.args ?? [];
      break;
    } catch (_decodeError) {
      // Try the next ABI.
    }
  }
  const { message, debug } = formatContractError(errorName, args);
  debug.errorSelector = data && data.length >= 10 ? data.slice(0, 10) : undefined;
  debug.rawData = data;
  return new ContractError(message, errorName, args, debug, cause);
}

/**
 * Detect the source of an error based on its name
 */
function detectErrorSource(errorName: string): ErrorSource {
  if (POOL_MANAGER_ERROR_NAMES.has(errorName)) {
    return ErrorSource.POOL_MANAGER;
  }

  if (errorName in CONTRACT_ERROR_SPECS) {
    return ErrorSource.PERP;
  }

  return ErrorSource.UNKNOWN;
}

type ContractErrorSpec = {
  /** Stable machine-readable code; defaults to CONTRACT_REVERT when omitted. */
  code?: PerpCityErrorCode;
  category: ErrorCategory;
  canRetry?: boolean;
  retryGuidance?: string;
  /** Static message, or a formatter that must tolerate missing args. */
  message: string | ((args: readonly unknown[]) => string);
};

/**
 * Every contract error the SDK knows how to explain, declaratively: message,
 * category, retryability, and the stable `code`. Names absent from this
 * record surface via the generic fallback in `formatContractError`.
 */
const CONTRACT_ERROR_SPECS: Record<string, ContractErrorSpec> = {
  // perpcity-contracts v1.0.0 src/libraries/Errors.sol: trading and position errors
  Abdicated: {
    code: "MARKET_ABDICATED",
    category: ErrorCategory.STATE_ERROR,
    message: "This market has permanently disabled this operation.",
  },
  AggregateSwapFeesTooHigh: {
    category: ErrorCategory.CONFIG_ERROR,
    message: "The market's swap fees add up to more than 100%.",
  },
  BeaconIndexUnreadable: {
    code: "STALE_INDEX",
    category: ErrorCategory.STATE_ERROR,
    canRetry: true,
    message: "The market's index oracle could not be read. Try again in a moment.",
  },
  DeadlineExpired: {
    code: "DEADLINE_EXPIRED",
    category: ErrorCategory.USER_ERROR,
    canRetry: true,
    message: "The transaction deadline passed before it was mined. Submit it again.",
  },
  DonationsRestricted: {
    code: "UNAUTHORIZED",
    category: ErrorCategory.USER_ERROR,
    message: "Only the market owner can donate to this market.",
  },
  EmaWindowTooLow: {
    category: ErrorCategory.CONFIG_ERROR,
    message: "The EMA window must be greater than zero.",
  },
  HealthNotImproved: {
    code: "MARGIN_RATIO_TOO_LOW",
    category: ErrorCategory.USER_ERROR,
    message: "This change must improve the position's health, and it does not.",
  },
  IdenticalTicks: {
    category: ErrorCategory.USER_ERROR,
    message: "The new price range is the same as the current one.",
  },
  InsufficientLiquidityToFill: {
    code: "INSUFFICIENT_LIQUIDITY",
    category: ErrorCategory.STATE_ERROR,
    message:
      "Not enough liquidity in this market to fill the order. Try a smaller size or wait for more liquidity.",
  },
  InvalidCallbackAction: {
    category: ErrorCategory.SYSTEM_ERROR,
    message: "The market received an unknown pool callback action.",
  },
  LongCloseCapacityExceeded: {
    code: "CLOSE_CAPACITY_EXCEEDED",
    category: ErrorCategory.STATE_ERROR,
    message:
      "The pool has too little depth to close this much long exposure. Try a smaller size or wait for more liquidity.",
  },
  MarginRatioTooLow: {
    code: "MARGIN_RATIO_TOO_LOW",
    category: ErrorCategory.USER_ERROR,
    message:
      "This position would be too close to liquidation. Increase your margin or reduce leverage.",
  },
  MarginTooHigh: {
    category: ErrorCategory.USER_ERROR,
    message: "The margin amount is too large.",
  },
  MarginTooLow: {
    code: "MARGIN_BELOW_MINIMUM",
    category: ErrorCategory.USER_ERROR,
    message: `Margin is below the market minimum of $${MIN_OPENING_MARGIN_USD}.`,
  },
  MaxAmtExceeded: {
    code: "SLIPPAGE_EXCEEDED",
    category: ErrorCategory.USER_ERROR,
    canRetry: true,
    message:
      "Execution would cost more than your slippage limit allows. Try again or increase your slippage tolerance.",
  },
  MaxTotalFeeExceeded: {
    code: "FEE_CAP_EXCEEDED",
    category: ErrorCategory.USER_ERROR,
    canRetry: true,
    message: "The trading fee is above your fee limit. Try again or raise the fee limit.",
  },
  MinAmtUnmet: {
    code: "SLIPPAGE_EXCEEDED",
    category: ErrorCategory.USER_ERROR,
    canRetry: true,
    message:
      "Execution moved beyond your slippage limit. Try again or increase your slippage tolerance.",
  },
  NegativeEquity: {
    category: ErrorCategory.USER_ERROR,
    message: "This position has negative equity and cannot be closed voluntarily.",
  },
  NegativeMargin: {
    category: ErrorCategory.USER_ERROR,
    message: "The resulting margin would be negative. Reduce the amount being withdrawn.",
  },
  NonMakerPosition: {
    code: "WRONG_POSITION_KIND",
    category: ErrorCategory.USER_ERROR,
    message: "This action only applies to LP positions.",
  },
  NonTakerPosition: {
    code: "WRONG_POSITION_KIND",
    category: ErrorCategory.USER_ERROR,
    message: "This action only applies to trading positions.",
  },
  NoSurplus: {
    category: ErrorCategory.STATE_ERROR,
    message: "The market holds no USDC above its liabilities.",
  },
  NoSystemFunds: {
    category: ErrorCategory.SYSTEM_ERROR,
    message: "The market has no collateral available to pay this claim.",
  },
  NotLiquidatable: {
    code: "NOT_LIQUIDATABLE",
    category: ErrorCategory.STATE_ERROR,
    message: "This position is healthy and cannot be liquidated.",
  },
  NotPoolManager: {
    category: ErrorCategory.SYSTEM_ERROR,
    message: "Only the Uniswap V4 Pool Manager can call this function.",
  },
  PositionDoesNotExist: {
    code: "POSITION_NOT_FOUND",
    category: ErrorCategory.STATE_ERROR,
    message: "This position no longer exists. It may have been closed or liquidated.",
  },
  PriceImpactTooHigh: {
    code: "PRICE_IMPACT_TOO_HIGH",
    category: ErrorCategory.USER_ERROR,
    message: "This order would move the price too much. Try a smaller size.",
  },
  PriceOutsideRange: {
    category: ErrorCategory.STATE_ERROR,
    message: "The market's index is outside the allowed price range.",
  },
  ReduceOnlyViolated: {
    code: "REDUCE_ONLY_VIOLATED",
    category: ErrorCategory.USER_ERROR,
    message:
      "This reduce-only order would increase or flip the position. Refresh the position size and try again.",
  },
  ShortCloseCapacityExceeded: {
    code: "CLOSE_CAPACITY_EXCEEDED",
    category: ErrorCategory.STATE_ERROR,
    message:
      "The pool has too little depth to close this much short exposure. Try a smaller size or wait for more liquidity.",
  },
  StaleBeaconIndex: {
    code: "STALE_INDEX",
    category: ErrorCategory.STATE_ERROR,
    canRetry: true,
    retryGuidance: "The market resumes when its oracle publishes a new index.",
    message:
      "The market's index is out of date, so the market is paused. Try again after the next index update.",
  },
  TicksOutOfBounds: {
    category: ErrorCategory.USER_ERROR,
    message: "The selected price range is outside the allowed bounds.",
  },
  UnauthorizedCaller: {
    code: "UNAUTHORIZED",
    category: ErrorCategory.USER_ERROR,
    message: "Your wallet is not authorized to perform this action.",
  },
  ZeroAddress: {
    category: ErrorCategory.USER_ERROR,
    message: "The zero address is not allowed here.",
  },
  ZeroAmount: {
    category: ErrorCategory.USER_ERROR,
    message: "The amount must be greater than zero.",
  },
  ZeroCapacity: {
    category: ErrorCategory.USER_ERROR,
    message: "This liquidity is too small to back any trading. Add more liquidity.",
  },
  ZeroDelta: {
    category: ErrorCategory.USER_ERROR,
    message: "The trade size must be greater than zero.",
  },
  ZeroLiquidity: {
    category: ErrorCategory.USER_ERROR,
    message: "Liquidity must be greater than zero.",
  },

  // Errors.sol: withdrawal controller and accounting token
  AlreadyInitialized: {
    category: ErrorCategory.CONFIG_ERROR,
    message: "This contract is already initialized.",
  },
  AmountNotDecreased: {
    category: ErrorCategory.USER_ERROR,
    message: "This update must decrease the value.",
  },
  ClaimNotReady: {
    code: "WITHDRAWAL_NOT_READY",
    category: ErrorCategory.STATE_ERROR,
    canRetry: false,
    message: "This claim is still in its challenge window. Refresh its current release time.",
  },
  ClaimNotPending: {
    code: "WITHDRAWAL_NOT_PENDING",
    category: ErrorCategory.STATE_ERROR,
    canRetry: false,
    message: "This claim is no longer pending or does not exist. Refresh its status.",
  },
  ReleasesArePaused: {
    code: "WITHDRAWAL_PAUSED",
    category: ErrorCategory.STATE_ERROR,
    canRetry: false,
    message: "Withdrawals are paused. Closing positions can still queue payouts.",
  },
  ClaimIsPaused: {
    code: "WITHDRAWAL_PAUSED",
    category: ErrorCategory.STATE_ERROR,
    canRetry: false,
    message: "This claim is paused. Refresh its status before trying again.",
  },
  ClaimNotPaused: {
    category: ErrorCategory.STATE_ERROR,
    message: "This claim is not paused.",
  },
  TvlCapExceeded: {
    code: "TVL_CAP_EXCEEDED",
    category: ErrorCategory.STATE_ERROR,
    canRetry: false,
    message: "This deposit exceeds the market TVL cap. Reduce the amount or wait for capacity.",
  },
  NotGovernor: {
    code: "UNAUTHORIZED",
    category: ErrorCategory.USER_ERROR,
    message: "Only the market governor can perform this action.",
  },
  NotGuardian: {
    code: "UNAUTHORIZED",
    category: ErrorCategory.USER_ERROR,
    message: "Only the market owner can perform this action.",
  },
  NotPerp: {
    code: "UNAUTHORIZED",
    category: ErrorCategory.USER_ERROR,
    message: "Only the bound market can request this payout.",
  },
  WindowNotIncreased: {
    category: ErrorCategory.USER_ERROR,
    message: "The new challenge window must be longer than the current one.",
  },
  ZeroWindow: {
    category: ErrorCategory.CONFIG_ERROR,
    message: "The challenge window must be greater than zero.",
  },
  TransferNotAllowed: {
    category: ErrorCategory.USER_ERROR,
    message: "Market accounting tokens cannot be transferred.",
  },

  // Factory, hook and protocol fee manager
  InvalidPerpImplementation: {
    category: ErrorCategory.CONFIG_ERROR,
    message: "The market implementation address is not valid.",
  },
  NotAContract: {
    category: ErrorCategory.CONFIG_ERROR,
    message: "The address is not a contract.",
  },
  NotProtocolOwner: {
    code: "UNAUTHORIZED",
    category: ErrorCategory.USER_ERROR,
    message: "Only the protocol owner can perform this action.",
  },
  ProtocolFeeTooHigh: {
    category: ErrorCategory.CONFIG_ERROR,
    message: "The protocol fee exceeds the maximum cap.",
  },
  UnauthorizedPoolAction: {
    code: "UNAUTHORIZED",
    category: ErrorCategory.USER_ERROR,
    message:
      "This pool only accepts swaps and liquidity changes from its own market contract. Trade through the market, not the Pool Manager.",
  },

  // v1 beacon and ECDSA verifier (lib/beacons f762da1)
  InvalidNonce: {
    category: ErrorCategory.STATE_ERROR,
    message: "The beacon update nonce is not the next sequential nonce.",
  },
  InvalidSigner: {
    code: "UNAUTHORIZED",
    category: ErrorCategory.USER_ERROR,
    message: "The beacon update is not signed by the beacon's signer.",
  },
  ProofReuse: {
    category: ErrorCategory.STATE_ERROR,
    message: "This beacon update proof was already used.",
  },
  AlreadyBound: {
    category: ErrorCategory.CONFIG_ERROR,
    message: "This verifier is already bound to a beacon.",
  },

  // Module owner errors (Fees, Funding, MarginRatios, PriceImpact, Pricing)
  InvalidMarginRatios: {
    category: ErrorCategory.CONFIG_ERROR,
    message: "The margin ratios must satisfy backstop < liquidation < initial.",
  },
  UpdateAlreadyPending: {
    category: ErrorCategory.STATE_ERROR,
    message: "A delayed margin ratio update is already pending.",
  },
  UpdateNotReady: {
    category: ErrorCategory.STATE_ERROR,
    message: "The delayed margin ratio update is not ready yet.",
  },
  NoPendingUpdate: {
    category: ErrorCategory.STATE_ERROR,
    message: "No margin ratio update is pending.",
  },
  LiqFeeTooHigh: {
    category: ErrorCategory.CONFIG_ERROR,
    message: "The liquidation fee is above the module maximum.",
  },
  SwapFeesTooHigh: {
    category: ErrorCategory.CONFIG_ERROR,
    message: "The swap fees are above the module maximum.",
  },
  NewOwnerIsZeroAddress: {
    category: ErrorCategory.USER_ERROR,
    message: "New owner cannot be the zero address.",
  },
  NoHandoverRequest: {
    category: ErrorCategory.STATE_ERROR,
    message: "No pending ownership handover request exists.",
  },
  Unauthorized: {
    code: "UNAUTHORIZED",
    category: ErrorCategory.USER_ERROR,
    message: "Caller does not have permission to perform this operation.",
  },

  FundingRateMultiplierTooHigh: {
    category: ErrorCategory.CONFIG_ERROR,
    message: "The funding rate multiplier is above the module maximum.",
  },
  MaxFundingPerDayPercentTooHigh: {
    category: ErrorCategory.CONFIG_ERROR,
    message: "The maximum daily funding is above the module maximum.",
  },
  MaxPremiumRatioTooHigh: {
    category: ErrorCategory.CONFIG_ERROR,
    message: "The maximum premium ratio must be below 100%.",
  },
  PriceImpactBoundTooHigh: {
    category: ErrorCategory.CONFIG_ERROR,
    message: "The price impact bound is above the module maximum.",
  },
  InvalidTargetUtilization: {
    category: ErrorCategory.CONFIG_ERROR,
    message: "The target utilization is not valid.",
  },
  LiquidityDecayZero: {
    category: ErrorCategory.CONFIG_ERROR,
    message: "The LP fee liquidity decay must be greater than zero.",
  },
  MaxFeeMultiplierTooLow: {
    category: ErrorCategory.CONFIG_ERROR,
    message: "The LP fee maximum multiplier is too low.",
  },
  MaxUtilFeeTooHigh: {
    category: ErrorCategory.CONFIG_ERROR,
    message: "The utilization fee curve is above the module maximum.",
  },
  PostTargetSlopeTooLow: {
    category: ErrorCategory.CONFIG_ERROR,
    message: "The utilization fee slope after the target must not be lower than before it.",
  },
  TargetFeeAboveStartFee: {
    category: ErrorCategory.CONFIG_ERROR,
    message: "The LP fee target is above its start fee.",
  },
  ZeroDelay: {
    category: ErrorCategory.CONFIG_ERROR,
    message: "The margin ratio update delay must be greater than zero.",
  },
  InvalidAuthorizedCaller: {
    category: ErrorCategory.CONFIG_ERROR,
    message: "The verifier caller address is not valid.",
  },
  InvalidBinder: {
    category: ErrorCategory.CONFIG_ERROR,
    message: "The verifier binder address is not valid.",
  },
  InvalidDataLength: {
    category: ErrorCategory.CONFIG_ERROR,
    message: "The beacon update must carry exactly one measurement.",
  },
  TrackedValTooLarge: {
    category: ErrorCategory.CONFIG_ERROR,
    message: "The beacon value is too large to track.",
  },
  AddressEmptyCode: {
    category: ErrorCategory.CONFIG_ERROR,
    message: "The target address has no contract code.",
  },
  FailedCall: {
    category: ErrorCategory.CONFIG_ERROR,
    message: "A low-level call failed.",
  },
  NotInitializing: {
    category: ErrorCategory.CONFIG_ERROR,
    message: "The contract is not initializing.",
  },
  UnauthorizedBinder: {
    code: "UNAUTHORIZED",
    category: ErrorCategory.USER_ERROR,
    message: "Only the verifier's binder can bind it.",
  },

  // UUPS proxy (OpenZeppelin)
  ERC1967InvalidImplementation: {
    category: ErrorCategory.CONFIG_ERROR,
    message: (args) =>
      `The new market implementation is not a contract${args.length > 0 ? ` (${args[0]})` : ""}.`,
  },
  ERC1967NonPayable: {
    category: ErrorCategory.USER_ERROR,
    message: "The market upgrade call must not carry ETH.",
  },
  UUPSUnauthorizedCallContext: {
    category: ErrorCategory.CONFIG_ERROR,
    message: "Upgrade calls must go through the market proxy, not the implementation.",
  },
  UUPSUnsupportedProxiableUUID: {
    category: ErrorCategory.CONFIG_ERROR,
    message: "The new market implementation does not declare the expected proxy storage slot.",
  },
  InvalidInitialization: {
    category: ErrorCategory.STATE_ERROR,
    message: "The market is already initialized.",
  },

  // Uniswap V4 PoolManager errors
  CurrencyNotSettled: {
    category: ErrorCategory.SYSTEM_ERROR,
    retryGuidance: "This indicates an issue with the transaction flow. Please try again.",
    message: "Currency balance not settled after operation.",
  },
  PoolNotInitialized: {
    category: ErrorCategory.STATE_ERROR,
    message: "Pool does not exist or has not been initialized.",
  },
  AlreadyUnlocked: {
    category: ErrorCategory.SYSTEM_ERROR,
    canRetry: true,
    message: "Pool manager is already unlocked.",
  },
  ManagerLocked: {
    category: ErrorCategory.STATE_ERROR,
    canRetry: true,
    message: "Uniswap V4 Pool Manager is currently locked.",
  },
  TickSpacingTooLarge: {
    category: ErrorCategory.CONFIG_ERROR,
    message: "Tick spacing exceeds the maximum allowed value.",
  },
  TickSpacingTooSmall: {
    category: ErrorCategory.CONFIG_ERROR,
    message: "Tick spacing is below the minimum allowed value.",
  },
  CurrenciesOutOfOrderOrEqual: {
    category: ErrorCategory.CONFIG_ERROR,
    message: "Currencies must be ordered (currency0 < currency1) and not equal.",
  },
  UnauthorizedDynamicLPFeeUpdate: {
    code: "UNAUTHORIZED",
    category: ErrorCategory.USER_ERROR,
    message: "Unauthorized attempt to update the dynamic LP fee.",
  },
  SwapAmountCannotBeZero: {
    category: ErrorCategory.USER_ERROR,
    message: "Swap amount cannot be zero.",
  },
  NonzeroNativeValue: {
    category: ErrorCategory.USER_ERROR,
    message: "Do not send ETH with this operation.",
  },
  MustClearExactPositiveDelta: {
    category: ErrorCategory.SYSTEM_ERROR,
    message: "The transaction must settle the exact amount owed to the pool.",
  },

  // solady SafeTransferLib errors (USDC pulls/pushes)
  TransferFromFailed: {
    code: "INSUFFICIENT_USDC_BALANCE",
    category: ErrorCategory.USER_ERROR,
    message: "USDC transfer failed. Make sure you approved enough USDC and have enough balance.",
  },
  TransferFailed: {
    category: ErrorCategory.SYSTEM_ERROR,
    message: "USDC transfer out of the market failed.",
  },
  ApproveFailed: {
    category: ErrorCategory.SYSTEM_ERROR,
    message: "USDC approve failed.",
  },
};

/**
 * Resolve the stable machine-readable code for a decoded contract error name.
 * "Unknown" (undecodable revert data) maps to UNKNOWN; any other name without
 * a dedicated code maps to CONTRACT_REVERT.
 */
export function codeForErrorName(errorName: string): PerpCityErrorCode {
  if (errorName === "Unknown") {
    return "UNKNOWN";
  }
  return CONTRACT_ERROR_SPECS[errorName]?.code ?? "CONTRACT_REVERT";
}

/**
 * Format a contract error name and args into a user-friendly message with debug info
 */
function formatContractError(
  errorName: string,
  args: readonly unknown[]
): { message: string; debug: ErrorDebugInfo } {
  const spec = CONTRACT_ERROR_SPECS[errorName];

  if (!spec) {
    return {
      message: `Contract error: ${errorName}${args.length > 0 ? ` (${args.join(", ")})` : ""}`,
      debug: { source: ErrorSource.UNKNOWN, category: ErrorCategory.SYSTEM_ERROR },
    };
  }

  return {
    message: typeof spec.message === "function" ? spec.message(args) : spec.message,
    debug: {
      source: detectErrorSource(errorName),
      category: spec.category,
      canRetry: spec.canRetry,
      retryGuidance: spec.retryGuidance,
    },
  };
}

/**
 * Wrap an async function with error handling. The thrown error keeps the
 * human-readable "{operation}: {message}" text, while `operation` and
 * `shortMessage` expose the parts separately for programmatic use.
 */
export async function withErrorHandling<T>(fn: () => Promise<T>, context: string): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    const parsedError = parseContractError(error);
    // A nested withErrorHandling already prefixed this error; keep the
    // innermost operation so the message is not double-prefixed.
    if (parsedError.operation === undefined) {
      parsedError.operation = context;
      parsedError.shortMessage ??= parsedError.message;
      parsedError.message = `${context}: ${parsedError.message}`;
    }
    throw parsedError;
  }
}
