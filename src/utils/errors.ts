import {
  BaseError,
  ContractFunctionRevertedError,
  decodeErrorResult,
  FeeCapTooLowError,
} from "viem";
import { EXTENDED_ERROR_DECODE_ABI } from "../abis/error-decode";
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
  "UTILIZATION_EXCEEDED",
  "INSUFFICIENT_LIQUIDITY",
  "POSITION_NOT_FOUND",
  "WRONG_POSITION_KIND",
  "NOT_LIQUIDATABLE",
  "MARKET_ABDICATED",
  "POSITION_LOCKED",
  "UNAUTHORIZED",
  "USER_REJECTED",
  "TX_REVERTED_ONCHAIN",
  "CONTRACT_REVERT",
  "RPC_ERROR",
  "VALIDATION_ERROR",
  "UNKNOWN",
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
    public readonly txHash: string,
    cause?: Error
  ) {
    super(`Transaction reverted. Hash: ${txHash}`, cause, "TX_REVERTED_ONCHAIN");
    this.name = "TransactionRevertedError";
  }
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

      // The call-site ABI could not decode the revert. The deployed contracts
      // also throw solady, Uniswap V4 PoolManager, and v0.0.1-generation
      // errors that are not in PERP_ABI - try those before giving up.
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
 * Detect the source of an error based on its name
 */
function detectErrorSource(errorName: string): ErrorSource {
  // Uniswap V4 PoolManager errors
  const poolManagerErrors = [
    "CurrencyNotSettled",
    "PoolNotInitialized",
    "AlreadyUnlocked",
    "ManagerLocked",
    "TickSpacingTooLarge",
    "TickSpacingTooSmall",
    "CurrenciesOutOfOrderOrEqual",
    "UnauthorizedDynamicLPFeeUpdate",
    "SwapAmountCannotBeZero",
    "NonzeroNativeValue",
    "MustClearExactPositiveDelta",
  ];

  if (poolManagerErrors.includes(errorName)) {
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
  /** Static message, or a formatter that must tolerate missing args (the
   * v0.1.x ABI declares every error zero-arg, so args are often empty). */
  message: string | ((args: readonly unknown[]) => string);
};

/**
 * Every contract error the SDK knows how to explain, declaratively: message,
 * category, retryability, and the stable `code`. Names absent from this
 * record surface via the generic fallback in `formatContractError`.
 */
const CONTRACT_ERROR_SPECS: Record<string, ContractErrorSpec> = {
  // Legacy config errors (v0.0.1-generation factory/market setup)
  InvalidBeaconAddress: {
    category: ErrorCategory.CONFIG_ERROR,
    message: (args) =>
      args.length > 0 ? `Invalid beacon address: ${args[0]}` : "Invalid beacon address.",
  },
  InvalidTradingFeeSplits: {
    category: ErrorCategory.CONFIG_ERROR,
    message: (args) =>
      args.length >= 2
        ? `Invalid trading fee splits. Insurance split: ${args[0]}, Creator split: ${args[1]}`
        : "Invalid trading fee splits.",
  },
  InvalidMaxOpeningLev: {
    category: ErrorCategory.CONFIG_ERROR,
    message: (args) =>
      args.length > 0
        ? `Invalid maximum opening leverage: ${args[0]}`
        : "Invalid maximum opening leverage.",
  },
  InvalidLiquidationLev: {
    category: ErrorCategory.CONFIG_ERROR,
    message: (args) =>
      args.length >= 2
        ? `Invalid liquidation leverage: ${args[0]}. Must be less than max opening leverage: ${args[1]}`
        : "Invalid liquidation leverage.",
  },
  InvalidLiquidationFee: {
    category: ErrorCategory.CONFIG_ERROR,
    message: (args) =>
      args.length > 0 ? `Invalid liquidation fee: ${args[0]}` : "Invalid liquidation fee.",
  },
  InvalidLiquidatorFeeSplit: {
    category: ErrorCategory.CONFIG_ERROR,
    message: (args) =>
      args.length > 0
        ? `Invalid liquidator fee split: ${args[0]}`
        : "Invalid liquidator fee split.",
  },
  InvalidClose: {
    category: ErrorCategory.USER_ERROR,
    message: (args) =>
      args.length >= 3
        ? `Cannot close position. Caller: ${args[0]}, Holder: ${args[1]}, Is Liquidated: ${args[2]}`
        : "Cannot close this position.",
  },
  InvalidCaller: {
    code: "UNAUTHORIZED",
    category: ErrorCategory.USER_ERROR,
    message: (args) =>
      args.length >= 2
        ? `Invalid caller. Expected: ${args[1]}, Got: ${args[0]}`
        : "Invalid caller for this operation.",
  },
  InvalidLiquidity: {
    category: ErrorCategory.USER_ERROR,
    message: (args) =>
      args.length > 0 ? `Invalid liquidity amount: ${args[0]}` : "Invalid liquidity amount.",
  },
  InvalidMargin: {
    category: ErrorCategory.USER_ERROR,
    message: (args) =>
      args.length > 0 ? `Invalid margin amount: ${args[0]}` : "Invalid margin amount.",
  },
  InvalidLevX96: {
    code: "MARGIN_RATIO_TOO_LOW",
    category: ErrorCategory.USER_ERROR,
    message: (args) =>
      args.length >= 2
        ? `Invalid leverage: ${args[0]}. Maximum allowed: ${args[1]}`
        : "Invalid leverage.",
  },
  MakerPositionLocked: {
    code: "POSITION_LOCKED",
    category: ErrorCategory.STATE_ERROR,
    message: (args) =>
      args.length >= 2
        ? `Maker position is locked until ${new Date(Number(args[1]) * 1000).toISOString()}. Current time: ${new Date(Number(args[0]) * 1000).toISOString()}`
        : "Maker position is locked until the lockup period ends.",
  },
  MaximumAmountExceeded: {
    code: "SLIPPAGE_EXCEEDED",
    category: ErrorCategory.USER_ERROR,
    message: (args) =>
      args.length >= 2
        ? `Maximum amount exceeded. Maximum: ${args[0]}, Requested: ${args[1]}`
        : "Execution would cost more than your slippage limit allows. Try again or increase your slippage tolerance.",
  },
  MinimumAmountInsufficient: {
    code: "SLIPPAGE_EXCEEDED",
    category: ErrorCategory.USER_ERROR,
    message:
      "Slippage tolerance exceeded. The position's value moved unfavorably during execution. Try increasing your slippage tolerance.",
  },
  PriceImpactTooHigh: {
    code: "PRICE_IMPACT_TOO_HIGH",
    category: ErrorCategory.USER_ERROR,
    message: (args) =>
      args.length >= 3
        ? `Price impact too high. Current price: ${args[0]}, Min acceptable: ${args[1]}, Max acceptable: ${args[2]}`
        : "This order would move the price too much. Try a smaller size or wait for more liquidity.",
  },

  // Current Errors.sol (perp contracts v0.1.x) trading errors
  InsufficientLiquidityToFill: {
    code: "INSUFFICIENT_LIQUIDITY",
    category: ErrorCategory.STATE_ERROR,
    message:
      "Not enough liquidity in this market to fill the order. Try a smaller size or wait for more liquidity.",
  },
  MarginTooLow: {
    code: "MARGIN_BELOW_MINIMUM",
    category: ErrorCategory.USER_ERROR,
    message: `Margin is below the market minimum of $${MIN_OPENING_MARGIN_USD}.`,
  },
  MinAmtUnmet: {
    code: "SLIPPAGE_EXCEEDED",
    category: ErrorCategory.USER_ERROR,
    canRetry: true,
    message:
      "Execution moved beyond your slippage limit. Try again or increase your slippage tolerance.",
  },
  MaxAmtExceeded: {
    code: "SLIPPAGE_EXCEEDED",
    category: ErrorCategory.USER_ERROR,
    canRetry: true,
    message:
      "Execution would cost more than your slippage limit allows. Try again or increase your slippage tolerance.",
  },
  MarginRatioTooLow: {
    code: "MARGIN_RATIO_TOO_LOW",
    category: ErrorCategory.USER_ERROR,
    message:
      "This position would be too close to liquidation. Increase your margin or reduce leverage.",
  },
  LongUtilizationExceeded: {
    code: "UTILIZATION_EXCEEDED",
    category: ErrorCategory.STATE_ERROR,
    message:
      "The market's long capacity is fully utilized. Try a smaller size or wait for more liquidity.",
  },
  ShortUtilizationExceeded: {
    code: "UTILIZATION_EXCEEDED",
    category: ErrorCategory.STATE_ERROR,
    message:
      "The market's short capacity is fully utilized. Try a smaller size or wait for more liquidity.",
  },
  NegativeEquity: {
    category: ErrorCategory.USER_ERROR,
    message: "The position's equity would be negative after this action.",
  },
  NegativeMargin: {
    category: ErrorCategory.USER_ERROR,
    message: "The resulting margin would be negative. Reduce the amount being withdrawn.",
  },
  NotLiquidatable: {
    code: "NOT_LIQUIDATABLE",
    category: ErrorCategory.STATE_ERROR,
    message: "This position is healthy and cannot be liquidated.",
  },
  ZeroLiquidity: {
    category: ErrorCategory.USER_ERROR,
    message: "Liquidity must be greater than zero.",
  },
  TicksOutOfBounds: {
    category: ErrorCategory.USER_ERROR,
    message: "The selected price range is outside the allowed bounds.",
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
  PositionDoesNotExist: {
    code: "POSITION_NOT_FOUND",
    category: ErrorCategory.STATE_ERROR,
    message: "This position no longer exists. It may have been closed or liquidated.",
  },
  UnauthorizedCaller: {
    code: "UNAUTHORIZED",
    category: ErrorCategory.USER_ERROR,
    message: "Your wallet is not authorized to perform this action.",
  },
  NoSystemFunds: {
    category: ErrorCategory.SYSTEM_ERROR,
    message: "The protocol has no system funds available for this operation.",
  },
  SwapReverted: {
    code: "INSUFFICIENT_LIQUIDITY",
    category: ErrorCategory.STATE_ERROR,
    message: "Swap failed. This may be due to insufficient liquidity or slippage tolerance.",
  },
  ZeroSizePosition: {
    category: ErrorCategory.USER_ERROR,
    message: (args) =>
      args.length >= 2
        ? `Cannot create zero-size position. Perp delta: ${args[0]}, USD delta: ${args[1]}`
        : "Cannot create a zero-size position.",
  },
  InvalidFundingInterval: {
    category: ErrorCategory.CONFIG_ERROR,
    message: (args) =>
      args.length > 0 ? `Invalid funding interval: ${args[0]}` : "Invalid funding interval.",
  },
  InvalidPriceImpactBand: {
    category: ErrorCategory.CONFIG_ERROR,
    message: (args) =>
      args.length > 0 ? `Invalid price impact band: ${args[0]}` : "Invalid price impact band.",
  },
  InvalidMarketDeathThreshold: {
    category: ErrorCategory.CONFIG_ERROR,
    message: (args) =>
      args.length > 0
        ? `Invalid market death threshold: ${args[0]}`
        : "Invalid market death threshold.",
  },
  InvalidTickRange: {
    category: ErrorCategory.CONFIG_ERROR,
    message: (args) =>
      args.length >= 2
        ? `Invalid tick range. Lower: ${args[0]}, Upper: ${args[1]}`
        : "Invalid tick range.",
  },
  MarketNotKillable: {
    category: ErrorCategory.STATE_ERROR,
    message: (args) =>
      args.length >= 2
        ? `Market health (${args[0]}) is above death threshold (${args[1]}). Market cannot be killed yet.`
        : "Market cannot be killed yet.",
  },
  InvalidStartingSqrtPriceX96: {
    category: ErrorCategory.CONFIG_ERROR,
    message: (args) =>
      args.length > 0 ? `Invalid starting sqrt price: ${args[0]}` : "Invalid starting sqrt price.",
  },

  // Current Errors.sol governance/timelock errors
  Abdicated: {
    code: "MARKET_ABDICATED",
    category: ErrorCategory.STATE_ERROR,
    message: "This market has been abdicated and no longer accepts this operation.",
  },
  DataAlreadyPending: {
    category: ErrorCategory.STATE_ERROR,
    message: "A timelocked update is already pending for this market.",
  },
  DataNotTimelocked: {
    category: ErrorCategory.STATE_ERROR,
    message: "No timelocked update exists for this data.",
  },
  TimelockNotExpired: {
    category: ErrorCategory.STATE_ERROR,
    message: "The timelock for this update has not expired yet.",
  },

  // PerpFactory / ProtocolFeeManager configuration errors
  EmaWindowTooLow: {
    category: ErrorCategory.CONFIG_ERROR,
    message: "The EMA window is below the minimum allowed value.",
  },
  ProtocolFeeTooHigh: {
    category: ErrorCategory.CONFIG_ERROR,
    message: "The protocol fee exceeds the maximum cap.",
  },
  StartingPriceTooHigh: {
    category: ErrorCategory.CONFIG_ERROR,
    message: "The market's starting price is above the allowed maximum.",
  },
  StartingPriceTooLow: {
    category: ErrorCategory.CONFIG_ERROR,
    message: "The market's starting price is below the allowed minimum.",
  },

  // Uniswap V4 PoolManager errors
  CurrencyNotSettled: {
    category: ErrorCategory.SYSTEM_ERROR,
    retryGuidance: "This indicates an issue with the transaction flow. Please try again.",
    message:
      "Currency balance not settled after operation. The pool manager requires all currency deltas to be settled before unlocking.",
  },
  PoolNotInitialized: {
    category: ErrorCategory.STATE_ERROR,
    message:
      "Pool does not exist or has not been initialized. Ensure the pool has been created before attempting to interact with it.",
  },
  AlreadyUnlocked: {
    category: ErrorCategory.SYSTEM_ERROR,
    canRetry: true,
    retryGuidance: "This is a temporary state. Please retry your transaction.",
    message: "Pool manager is already unlocked. This indicates a potential reentrancy issue.",
  },
  ManagerLocked: {
    category: ErrorCategory.STATE_ERROR,
    canRetry: true,
    retryGuidance: "Please retry your transaction in a moment.",
    message:
      "Uniswap V4 Pool Manager is currently locked. This is a temporary state during transaction processing.",
  },
  TickSpacingTooLarge: {
    category: ErrorCategory.CONFIG_ERROR,
    message: (args) =>
      args.length > 0
        ? `Tick spacing (${args[0]}) exceeds the maximum allowed value. Please use a smaller tick spacing.`
        : "Tick spacing exceeds the maximum allowed value.",
  },
  TickSpacingTooSmall: {
    category: ErrorCategory.CONFIG_ERROR,
    message: (args) =>
      args.length > 0
        ? `Tick spacing (${args[0]}) is below the minimum allowed value. Please use a larger tick spacing.`
        : "Tick spacing is below the minimum allowed value.",
  },
  CurrenciesOutOfOrderOrEqual: {
    category: ErrorCategory.CONFIG_ERROR,
    message: (args) =>
      args.length >= 2
        ? `Currencies must be ordered (currency0 < currency1) and not equal. Got currency0: ${args[0]}, currency1: ${args[1]}`
        : "Currencies must be ordered (currency0 < currency1) and not equal.",
  },
  UnauthorizedDynamicLPFeeUpdate: {
    code: "UNAUTHORIZED",
    category: ErrorCategory.USER_ERROR,
    message:
      "Unauthorized attempt to update dynamic LP fee. Only authorized addresses can modify fees.",
  },
  SwapAmountCannotBeZero: {
    category: ErrorCategory.USER_ERROR,
    message: "Swap amount cannot be zero. Please specify a valid swap amount.",
  },
  NonzeroNativeValue: {
    category: ErrorCategory.USER_ERROR,
    message:
      "Native ETH was sent with the transaction when none was expected. Do not send ETH with this operation.",
  },
  MustClearExactPositiveDelta: {
    category: ErrorCategory.SYSTEM_ERROR,
    message:
      "Must clear exact positive delta. The transaction must settle the exact amount owed to the pool.",
  },

  // ERC721/Ownership errors
  AccountBalanceOverflow: {
    category: ErrorCategory.SYSTEM_ERROR,
    message:
      "Account balance overflow detected. This is a critical error that should not occur under normal conditions.",
  },
  BalanceQueryForZeroAddress: {
    category: ErrorCategory.USER_ERROR,
    message: "Cannot query balance for the zero address.",
  },
  NotOwnerNorApproved: {
    code: "UNAUTHORIZED",
    category: ErrorCategory.USER_ERROR,
    message: "Caller is not the owner or an approved operator for this position.",
  },
  TokenAlreadyExists: {
    category: ErrorCategory.STATE_ERROR,
    message: "A position with this ID already exists.",
  },
  TokenDoesNotExist: {
    code: "POSITION_NOT_FOUND",
    category: ErrorCategory.USER_ERROR,
    message: "The specified position does not exist.",
  },
  TransferFromIncorrectOwner: {
    category: ErrorCategory.USER_ERROR,
    message: "Attempting to transfer position from incorrect owner.",
  },
  TransferToNonERC721ReceiverImplementer: {
    category: ErrorCategory.USER_ERROR,
    message:
      "Cannot transfer position to a contract that does not implement ERC721 receiver interface.",
  },
  TransferToZeroAddress: {
    category: ErrorCategory.USER_ERROR,
    message: "Cannot transfer position to the zero address.",
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
    message: "Unauthorized access. Caller does not have permission to perform this operation.",
  },

  // solady SafeTransferLib errors (USDC pulls/pushes)
  TransferFromFailed: {
    code: "INSUFFICIENT_USDC_BALANCE",
    category: ErrorCategory.USER_ERROR,
    message:
      "ERC20 transferFrom operation failed. Ensure you have approved sufficient tokens and have enough balance.",
  },
  TransferFailed: {
    category: ErrorCategory.SYSTEM_ERROR,
    message:
      "ERC20 transfer operation failed. This may indicate insufficient balance or a token contract issue.",
  },
  ApproveFailed: {
    category: ErrorCategory.SYSTEM_ERROR,
    message: "ERC20 approve operation failed. Please check the token contract.",
  },

  // Module configuration errors
  AlreadyInitialized: {
    category: ErrorCategory.CONFIG_ERROR,
    message: "Contract has already been initialized. Initialization can only occur once.",
  },
  FeesNotRegistered: {
    category: ErrorCategory.CONFIG_ERROR,
    message:
      "Fees module has not been registered for this pool. Please register the fees module before proceeding.",
  },
  FeeTooLarge: {
    category: ErrorCategory.CONFIG_ERROR,
    message: "The specified fee exceeds the maximum allowed value.",
  },
  MarginRatiosNotRegistered: {
    category: ErrorCategory.CONFIG_ERROR,
    message:
      "Margin ratios module has not been registered for this pool. Please register the module before proceeding.",
  },
  LockupPeriodNotRegistered: {
    category: ErrorCategory.CONFIG_ERROR,
    message:
      "Lockup period module has not been registered for this pool. Please register the module before proceeding.",
  },
  SqrtPriceImpactLimitNotRegistered: {
    category: ErrorCategory.CONFIG_ERROR,
    message:
      "Sqrt price impact limit module has not been registered for this pool. Please register the module before proceeding.",
  },
  ModuleAlreadyRegistered: {
    category: ErrorCategory.CONFIG_ERROR,
    message: "This module has already been registered and cannot be registered again.",
  },

  // Position/Trading errors
  InvalidAction: {
    category: ErrorCategory.USER_ERROR,
    message: (args) =>
      args.length > 0
        ? `Invalid action type: ${args[0]}. Please specify a valid action.`
        : "Invalid action type. Please specify a valid action.",
  },
  InvalidMarginRatio: {
    code: "MARGIN_RATIO_TOO_LOW",
    category: ErrorCategory.USER_ERROR,
    message: (args) =>
      args.length > 0
        ? `Invalid margin ratio: ${args[0]}. The margin ratio must be within acceptable bounds.`
        : "Invalid margin ratio. The margin ratio must be within acceptable bounds.",
  },
  MakerNotAllowed: {
    code: "WRONG_POSITION_KIND",
    category: ErrorCategory.USER_ERROR,
    message: "Maker positions are not allowed for this operation.",
  },
  PositionLocked: {
    code: "POSITION_LOCKED",
    category: ErrorCategory.STATE_ERROR,
    message:
      "This position is currently locked. Maker positions have a time-based lockup period to ensure liquidity stability.",
  },
  ZeroDelta: {
    category: ErrorCategory.STATE_ERROR,
    message: "Position has zero size. Cannot perform operation on a position with no open size.",
  },
  NotPoolManager: {
    category: ErrorCategory.SYSTEM_ERROR,
    message:
      "Only the Uniswap V4 Pool Manager can call this function. This indicates an architectural issue.",
  },
  NoLiquidityToReceiveFees: {
    category: ErrorCategory.STATE_ERROR,
    message:
      "No liquidity available to receive fees. Ensure there is sufficient liquidity in the pool.",
  },

  // perpcity-contracts v0.0.1 error set (older deployed markets)
  CouldNotFullyFill: {
    code: "INSUFFICIENT_LIQUIDITY",
    category: ErrorCategory.STATE_ERROR,
    message:
      "Not enough liquidity to fully fill the order. Try a smaller size or wait for more liquidity.",
  },
  PerpDoesNotExist: {
    category: ErrorCategory.STATE_ERROR,
    message: "This market does not exist.",
  },
  TransferNotAllowed: {
    category: ErrorCategory.USER_ERROR,
    message: "Position NFTs on this market cannot be transferred.",
  },
  ZeroNotional: {
    category: ErrorCategory.USER_ERROR,
    message: "The resulting position would have zero notional value.",
  },
  InvalidMarginDelta: {
    category: ErrorCategory.USER_ERROR,
    message: "Invalid margin delta for this adjustment.",
  },
  BeaconNotRegistered: {
    category: ErrorCategory.CONFIG_ERROR,
    message: "The market's beacon is not registered.",
  },
  ModuleNotRegistered: {
    category: ErrorCategory.CONFIG_ERROR,
    message: (args) =>
      args.length > 0
        ? `Module not registered: ${args[0]}`
        : "A required module is not registered for this market.",
  },
  StartingSqrtPriceTooHigh: {
    category: ErrorCategory.CONFIG_ERROR,
    message: "The market's starting price is above the allowed maximum.",
  },
  StartingSqrtPriceTooLow: {
    category: ErrorCategory.CONFIG_ERROR,
    message: "The market's starting price is below the allowed minimum.",
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
 * `shortMessage` expose the parts separately for programmatic use. When
 * hooks are given, onError fires with the parsed error before it is thrown;
 * a throwing hook is swallowed and never masks the real error.
 */
export async function withErrorHandling<T>(
  fn: () => Promise<T>,
  context: string,
  hooks?: { onError?(event: { operation: string; error: PerpCityError }): void }
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    const parsedError = parseContractError(error);
    parsedError.operation = context;
    parsedError.shortMessage ??= parsedError.message;
    parsedError.message = `${context}: ${parsedError.message}`;
    try {
      hooks?.onError?.({ operation: context, error: parsedError });
    } catch (_hookError) {
      // Hooks are fire-and-forget; see PerpCityHooks.
    }
    throw parsedError;
  }
}
