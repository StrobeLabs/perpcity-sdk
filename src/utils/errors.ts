import { BaseError, ContractFunctionRevertedError } from "viem";

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
  PERP_MANAGER = "PERP_MANAGER",
  POOL_MANAGER = "POOL_MANAGER",
  UNKNOWN = "UNKNOWN",
}

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
 * Base class for all PerpCity SDK errors
 */
export class PerpCityError extends Error {
  constructor(
    message: string,
    public readonly cause?: Error
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
    super(message, cause);
    this.name = "ContractError";
  }
}

/**
 * Error thrown when a transaction is rejected by the user
 */
export class TransactionRejectedError extends PerpCityError {
  constructor(message = "Transaction rejected by user", cause?: Error) {
    super(message, cause);
    this.name = "TransactionRejectedError";
  }
}

/**
 * Error thrown when there are insufficient funds
 */
export class InsufficientFundsError extends PerpCityError {
  constructor(message = "Insufficient funds for transaction", cause?: Error) {
    super(message, cause);
    this.name = "InsufficientFundsError";
  }
}

/**
 * Error thrown when an RPC call fails
 */
export class RPCError extends PerpCityError {
  constructor(message: string, cause?: Error) {
    super(message, cause);
    this.name = "RPCError";
  }
}

/**
 * Error thrown when validation fails
 */
export class ValidationError extends PerpCityError {
  constructor(message: string, cause?: Error) {
    super(message, cause);
    this.name = "ValidationError";
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
    const revertError = error.walk((err) => err instanceof ContractFunctionRevertedError);

    if (revertError instanceof ContractFunctionRevertedError) {
      const errorName = revertError.data?.errorName ?? "Unknown";
      const args = revertError.data?.args ?? [];

      // Map known contract errors to user-friendly messages
      const { message, debug } = formatContractError(errorName, args);
      return new ContractError(message, errorName, args, debug, error as Error);
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

  // Known PerpManager errors
  const perpManagerErrors = [
    "InvalidBeaconAddress",
    "InvalidTradingFeeSplits",
    "InvalidMaxOpeningLev",
    "InvalidLiquidationLev",
    "InvalidLiquidationFee",
    "InvalidLiquidatorFeeSplit",
    "InvalidClose",
    "InvalidCaller",
    "InvalidLiquidity",
    "InvalidMargin",
    "InvalidLevX96",
    "MakerPositionLocked",
    "MaximumAmountExceeded",
    "MinimumAmountInsufficient",
    "PriceImpactTooHigh",
    "SwapReverted",
    "ZeroSizePosition",
    "InvalidFundingInterval",
    "InvalidPriceImpactBand",
    "InvalidMarketDeathThreshold",
    "InvalidTickRange",
    "MarketNotKillable",
    "InvalidStartingSqrtPriceX96",
    "AccountBalanceOverflow",
    "BalanceQueryForZeroAddress",
    "NotOwnerNorApproved",
    "TokenAlreadyExists",
    "TokenDoesNotExist",
    "TransferFromIncorrectOwner",
    "TransferToNonERC721ReceiverImplementer",
    "TransferToZeroAddress",
    "NewOwnerIsZeroAddress",
    "NoHandoverRequest",
    "Unauthorized",
    "TransferFromFailed",
    "TransferFailed",
    "ApproveFailed",
    "AlreadyInitialized",
    "FeesNotRegistered",
    "FeeTooLarge",
    "MarginRatiosNotRegistered",
    "LockupPeriodNotRegistered",
    "SqrtPriceImpactLimitNotRegistered",
    "ModuleAlreadyRegistered",
    "InvalidAction",
    "InvalidMarginRatio",
    "MakerNotAllowed",
    "PositionLocked",
    "ZeroDelta",
    "NotPoolManager",
    "NoLiquidityToReceiveFees",
  ];

  if (poolManagerErrors.includes(errorName)) {
    return ErrorSource.POOL_MANAGER;
  }

  if (perpManagerErrors.includes(errorName)) {
    return ErrorSource.PERP_MANAGER;
  }

  return ErrorSource.UNKNOWN;
}

/**
 * Format a contract error name and args into a user-friendly message with debug info
 */
function formatContractError(
  errorName: string,
  args: readonly unknown[]
): { message: string; debug: ErrorDebugInfo } {
  const source = detectErrorSource(errorName);

  switch (errorName) {
    // Existing PerpManager errors
    case "InvalidBeaconAddress":
      return {
        message: `Invalid beacon address: ${args[0]}`,
        debug: { source, category: ErrorCategory.CONFIG_ERROR },
      };

    case "InvalidTradingFeeSplits":
      return {
        message: `Invalid trading fee splits. Insurance split: ${args[0]}, Creator split: ${args[1]}`,
        debug: { source, category: ErrorCategory.CONFIG_ERROR },
      };

    case "InvalidMaxOpeningLev":
      return {
        message: `Invalid maximum opening leverage: ${args[0]}`,
        debug: { source, category: ErrorCategory.CONFIG_ERROR },
      };

    case "InvalidLiquidationLev":
      return {
        message: `Invalid liquidation leverage: ${args[0]}. Must be less than max opening leverage: ${args[1]}`,
        debug: { source, category: ErrorCategory.CONFIG_ERROR },
      };

    case "InvalidLiquidationFee":
      return {
        message: `Invalid liquidation fee: ${args[0]}`,
        debug: { source, category: ErrorCategory.CONFIG_ERROR },
      };

    case "InvalidLiquidatorFeeSplit":
      return {
        message: `Invalid liquidator fee split: ${args[0]}`,
        debug: { source, category: ErrorCategory.CONFIG_ERROR },
      };

    case "InvalidClose":
      return {
        message: `Cannot close position. Caller: ${args[0]}, Holder: ${args[1]}, Is Liquidated: ${args[2]}`,
        debug: { source, category: ErrorCategory.USER_ERROR },
      };

    case "InvalidCaller":
      return {
        message: `Invalid caller. Expected: ${args[1]}, Got: ${args[0]}`,
        debug: { source, category: ErrorCategory.USER_ERROR },
      };

    case "InvalidLiquidity":
      return {
        message: `Invalid liquidity amount: ${args[0]}`,
        debug: { source, category: ErrorCategory.USER_ERROR },
      };

    case "InvalidMargin":
      return {
        message: `Invalid margin amount: ${args[0]}`,
        debug: { source, category: ErrorCategory.USER_ERROR },
      };

    case "InvalidLevX96":
      return {
        message: `Invalid leverage: ${args[0]}. Maximum allowed: ${args[1]}`,
        debug: { source, category: ErrorCategory.USER_ERROR },
      };

    case "MakerPositionLocked":
      return {
        message: `Maker position is locked until ${new Date(Number(args[1]) * 1000).toISOString()}. Current time: ${new Date(Number(args[0]) * 1000).toISOString()}`,
        debug: { source, category: ErrorCategory.STATE_ERROR },
      };

    case "MaximumAmountExceeded":
      return {
        message: `Maximum amount exceeded. Maximum: ${args[0]}, Requested: ${args[1]}`,
        debug: { source, category: ErrorCategory.USER_ERROR },
      };

    case "MinimumAmountInsufficient":
      return {
        message: `Minimum amount not met. Required: ${args[0]}, Received: ${args[1]}`,
        debug: { source, category: ErrorCategory.USER_ERROR },
      };

    case "PriceImpactTooHigh":
      return {
        message: `Price impact too high. Current price: ${args[0]}, Min acceptable: ${args[1]}, Max acceptable: ${args[2]}`,
        debug: { source, category: ErrorCategory.USER_ERROR },
      };

    case "SwapReverted":
      return {
        message: "Swap failed. This may be due to insufficient liquidity or slippage tolerance.",
        debug: { source, category: ErrorCategory.STATE_ERROR },
      };

    case "ZeroSizePosition":
      return {
        message: `Cannot create zero-size position. Perp delta: ${args[0]}, USD delta: ${args[1]}`,
        debug: { source, category: ErrorCategory.USER_ERROR },
      };

    case "InvalidFundingInterval":
      return {
        message: `Invalid funding interval: ${args[0]}`,
        debug: { source, category: ErrorCategory.CONFIG_ERROR },
      };

    case "InvalidPriceImpactBand":
      return {
        message: `Invalid price impact band: ${args[0]}`,
        debug: { source, category: ErrorCategory.CONFIG_ERROR },
      };

    case "InvalidMarketDeathThreshold":
      return {
        message: `Invalid market death threshold: ${args[0]}`,
        debug: { source, category: ErrorCategory.CONFIG_ERROR },
      };

    case "InvalidTickRange":
      return {
        message: `Invalid tick range. Lower: ${args[0]}, Upper: ${args[1]}`,
        debug: { source, category: ErrorCategory.CONFIG_ERROR },
      };

    case "MarketNotKillable":
      return {
        message: `Market health (${args[0]}) is above death threshold (${args[1]}). Market cannot be killed yet.`,
        debug: { source, category: ErrorCategory.STATE_ERROR },
      };

    case "InvalidStartingSqrtPriceX96":
      return {
        message: `Invalid starting sqrt price: ${args[0]}`,
        debug: { source, category: ErrorCategory.CONFIG_ERROR },
      };

    // Uniswap V4 PoolManager errors
    case "CurrencyNotSettled":
      return {
        message:
          "Currency balance not settled after operation. The pool manager requires all currency deltas to be settled before unlocking.",
        debug: {
          source,
          category: ErrorCategory.SYSTEM_ERROR,
          retryGuidance: "This indicates an issue with the transaction flow. Please try again.",
        },
      };

    case "PoolNotInitialized":
      return {
        message:
          "Pool does not exist or has not been initialized. Ensure the pool has been created before attempting to interact with it.",
        debug: { source, category: ErrorCategory.STATE_ERROR },
      };

    case "AlreadyUnlocked":
      return {
        message: "Pool manager is already unlocked. This indicates a potential reentrancy issue.",
        debug: {
          source,
          category: ErrorCategory.SYSTEM_ERROR,
          canRetry: true,
          retryGuidance: "This is a temporary state. Please retry your transaction.",
        },
      };

    case "ManagerLocked":
      return {
        message:
          "Uniswap V4 Pool Manager is currently locked. This is a temporary state during transaction processing.",
        debug: {
          source,
          category: ErrorCategory.STATE_ERROR,
          canRetry: true,
          retryGuidance: "Please retry your transaction in a moment.",
        },
      };

    case "TickSpacingTooLarge":
      return {
        message: `Tick spacing (${args[0]}) exceeds the maximum allowed value. Please use a smaller tick spacing.`,
        debug: { source, category: ErrorCategory.CONFIG_ERROR },
      };

    case "TickSpacingTooSmall":
      return {
        message: `Tick spacing (${args[0]}) is below the minimum allowed value. Please use a larger tick spacing.`,
        debug: { source, category: ErrorCategory.CONFIG_ERROR },
      };

    case "CurrenciesOutOfOrderOrEqual":
      return {
        message: `Currencies must be ordered (currency0 < currency1) and not equal. Got currency0: ${args[0]}, currency1: ${args[1]}`,
        debug: { source, category: ErrorCategory.CONFIG_ERROR },
      };

    case "UnauthorizedDynamicLPFeeUpdate":
      return {
        message:
          "Unauthorized attempt to update dynamic LP fee. Only authorized addresses can modify fees.",
        debug: { source, category: ErrorCategory.USER_ERROR },
      };

    case "SwapAmountCannotBeZero":
      return {
        message: "Swap amount cannot be zero. Please specify a valid swap amount.",
        debug: { source, category: ErrorCategory.USER_ERROR },
      };

    case "NonzeroNativeValue":
      return {
        message:
          "Native ETH was sent with the transaction when none was expected. Do not send ETH with this operation.",
        debug: { source, category: ErrorCategory.USER_ERROR },
      };

    case "MustClearExactPositiveDelta":
      return {
        message:
          "Must clear exact positive delta. The transaction must settle the exact amount owed to the pool.",
        debug: { source, category: ErrorCategory.SYSTEM_ERROR },
      };

    // Missing PerpManager errors - ERC721/Ownership
    case "AccountBalanceOverflow":
      return {
        message:
          "Account balance overflow detected. This is a critical error that should not occur under normal conditions.",
        debug: { source, category: ErrorCategory.SYSTEM_ERROR },
      };

    case "BalanceQueryForZeroAddress":
      return {
        message: "Cannot query balance for the zero address.",
        debug: { source, category: ErrorCategory.USER_ERROR },
      };

    case "NotOwnerNorApproved":
      return {
        message: "Caller is not the owner or an approved operator for this position.",
        debug: { source, category: ErrorCategory.USER_ERROR },
      };

    case "TokenAlreadyExists":
      return {
        message: "A position with this ID already exists.",
        debug: { source, category: ErrorCategory.STATE_ERROR },
      };

    case "TokenDoesNotExist":
      return {
        message: "The specified position does not exist.",
        debug: { source, category: ErrorCategory.USER_ERROR },
      };

    case "TransferFromIncorrectOwner":
      return {
        message: "Attempting to transfer position from incorrect owner.",
        debug: { source, category: ErrorCategory.USER_ERROR },
      };

    case "TransferToNonERC721ReceiverImplementer":
      return {
        message:
          "Cannot transfer position to a contract that does not implement ERC721 receiver interface.",
        debug: { source, category: ErrorCategory.USER_ERROR },
      };

    case "TransferToZeroAddress":
      return {
        message: "Cannot transfer position to the zero address.",
        debug: { source, category: ErrorCategory.USER_ERROR },
      };

    case "NewOwnerIsZeroAddress":
      return {
        message: "New owner cannot be the zero address.",
        debug: { source, category: ErrorCategory.USER_ERROR },
      };

    case "NoHandoverRequest":
      return {
        message: "No pending ownership handover request exists.",
        debug: { source, category: ErrorCategory.STATE_ERROR },
      };

    case "Unauthorized":
      return {
        message: "Unauthorized access. Caller does not have permission to perform this operation.",
        debug: { source, category: ErrorCategory.USER_ERROR },
      };

    // Missing PerpManager errors - Transfer/Approval
    case "TransferFromFailed":
      return {
        message:
          "ERC20 transferFrom operation failed. Ensure you have approved sufficient tokens and have enough balance.",
        debug: { source, category: ErrorCategory.USER_ERROR },
      };

    case "TransferFailed":
      return {
        message:
          "ERC20 transfer operation failed. This may indicate insufficient balance or a token contract issue.",
        debug: { source, category: ErrorCategory.SYSTEM_ERROR },
      };

    case "ApproveFailed":
      return {
        message: "ERC20 approve operation failed. Please check the token contract.",
        debug: { source, category: ErrorCategory.SYSTEM_ERROR },
      };

    // Missing PerpManager errors - Module Config
    case "AlreadyInitialized":
      return {
        message: "Contract has already been initialized. Initialization can only occur once.",
        debug: { source, category: ErrorCategory.CONFIG_ERROR },
      };

    case "FeesNotRegistered":
      return {
        message:
          "Fees module has not been registered for this pool. Please register the fees module before proceeding.",
        debug: { source, category: ErrorCategory.CONFIG_ERROR },
      };

    case "FeeTooLarge":
      return {
        message: "The specified fee exceeds the maximum allowed value.",
        debug: { source, category: ErrorCategory.CONFIG_ERROR },
      };

    case "MarginRatiosNotRegistered":
      return {
        message:
          "Margin ratios module has not been registered for this pool. Please register the module before proceeding.",
        debug: { source, category: ErrorCategory.CONFIG_ERROR },
      };

    case "LockupPeriodNotRegistered":
      return {
        message:
          "Lockup period module has not been registered for this pool. Please register the module before proceeding.",
        debug: { source, category: ErrorCategory.CONFIG_ERROR },
      };

    case "SqrtPriceImpactLimitNotRegistered":
      return {
        message:
          "Sqrt price impact limit module has not been registered for this pool. Please register the module before proceeding.",
        debug: { source, category: ErrorCategory.CONFIG_ERROR },
      };

    case "ModuleAlreadyRegistered":
      return {
        message: "This module has already been registered and cannot be registered again.",
        debug: { source, category: ErrorCategory.CONFIG_ERROR },
      };

    // Missing PerpManager errors - Position/Trading
    case "InvalidAction":
      return {
        message: `Invalid action type: ${args[0]}. Please specify a valid action.`,
        debug: { source, category: ErrorCategory.USER_ERROR },
      };

    case "InvalidMarginRatio":
      return {
        message: `Invalid margin ratio: ${args[0]}. The margin ratio must be within acceptable bounds.`,
        debug: { source, category: ErrorCategory.USER_ERROR },
      };

    case "MakerNotAllowed":
      return {
        message: "Maker positions are not allowed for this operation.",
        debug: { source, category: ErrorCategory.USER_ERROR },
      };

    case "PositionLocked":
      return {
        message:
          "This position is currently locked. Maker positions have a time-based lockup period to ensure liquidity stability.",
        debug: { source, category: ErrorCategory.STATE_ERROR },
      };

    case "ZeroDelta":
      return {
        message:
          "Position has zero size. Cannot perform operation on a position with no open size.",
        debug: { source, category: ErrorCategory.STATE_ERROR },
      };

    case "NotPoolManager":
      return {
        message:
          "Only the Uniswap V4 Pool Manager can call this function. This indicates an architectural issue.",
        debug: { source, category: ErrorCategory.SYSTEM_ERROR },
      };

    case "NoLiquidityToReceiveFees":
      return {
        message:
          "No liquidity available to receive fees. Ensure there is sufficient liquidity in the pool.",
        debug: { source, category: ErrorCategory.STATE_ERROR },
      };

    default:
      return {
        message: `Contract error: ${errorName}${args.length > 0 ? ` (${args.join(", ")})` : ""}`,
        debug: { source: ErrorSource.UNKNOWN, category: ErrorCategory.SYSTEM_ERROR },
      };
  }
}

/**
 * Wrap an async function with error handling
 */
export async function withErrorHandling<T>(fn: () => Promise<T>, context: string): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    const parsedError = parseContractError(error);
    parsedError.message = `${context}: ${parsedError.message}`;
    throw parsedError;
  }
}
