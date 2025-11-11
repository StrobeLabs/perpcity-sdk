import { BaseError, ContractFunctionRevertedError, decodeErrorResult } from "viem";
import { PERP_MANAGER_ABI } from "../abis/perp-manager";

/**
 * Base class for all PerpCity SDK errors
 */
export class PerpCityError extends Error {
  constructor(message: string, public readonly cause?: Error) {
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
      const message = formatContractError(errorName, args);
      return new ContractError(message, errorName, args, error as Error);
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
 * Format a contract error name and args into a user-friendly message
 */
function formatContractError(errorName: string, args: readonly unknown[]): string {
  switch (errorName) {
    case "InvalidBeaconAddress":
      return `Invalid beacon address: ${args[0]}`;

    case "InvalidTradingFeeSplits":
      return `Invalid trading fee splits. Insurance split: ${args[0]}, Creator split: ${args[1]}`;

    case "InvalidMaxOpeningLev":
      return `Invalid maximum opening leverage: ${args[0]}`;

    case "InvalidLiquidationLev":
      return `Invalid liquidation leverage: ${args[0]}. Must be less than max opening leverage: ${args[1]}`;

    case "InvalidLiquidationFee":
      return `Invalid liquidation fee: ${args[0]}`;

    case "InvalidLiquidatorFeeSplit":
      return `Invalid liquidator fee split: ${args[0]}`;

    case "InvalidClose":
      return `Cannot close position. Caller: ${args[0]}, Holder: ${args[1]}, Is Liquidated: ${args[2]}`;

    case "InvalidCaller":
      return `Invalid caller. Expected: ${args[1]}, Got: ${args[0]}`;

    case "InvalidLiquidity":
      return `Invalid liquidity amount: ${args[0]}`;

    case "InvalidMargin":
      return `Invalid margin amount: ${args[0]}`;

    case "InvalidLevX96":
      return `Invalid leverage: ${args[0]}. Maximum allowed: ${args[1]}`;

    case "MakerPositionLocked":
      return `Maker position is locked until ${new Date(Number(args[1]) * 1000).toISOString()}. Current time: ${new Date(Number(args[0]) * 1000).toISOString()}`;

    case "MaximumAmountExceeded":
      return `Maximum amount exceeded. Maximum: ${args[0]}, Requested: ${args[1]}`;

    case "MinimumAmountInsufficient":
      return `Minimum amount not met. Required: ${args[0]}, Received: ${args[1]}`;

    case "PriceImpactTooHigh":
      return `Price impact too high. Current price: ${args[0]}, Min acceptable: ${args[1]}, Max acceptable: ${args[2]}`;

    case "SwapReverted":
      return "Swap failed. This may be due to insufficient liquidity or slippage tolerance.";

    case "ZeroSizePosition":
      return `Cannot create zero-size position. Perp delta: ${args[0]}, USD delta: ${args[1]}`;

    case "InvalidFundingInterval":
      return `Invalid funding interval: ${args[0]}`;

    case "InvalidPriceImpactBand":
      return `Invalid price impact band: ${args[0]}`;

    case "InvalidMarketDeathThreshold":
      return `Invalid market death threshold: ${args[0]}`;

    case "InvalidTickRange":
      return `Invalid tick range. Lower: ${args[0]}, Upper: ${args[1]}`;

    case "MarketNotKillable":
      return `Market health (${args[0]}) is above death threshold (${args[1]}). Market cannot be killed yet.`;

    case "InvalidStartingSqrtPriceX96":
      return `Invalid starting sqrt price: ${args[0]}`;

    default:
      return `Contract error: ${errorName}${args.length > 0 ? ` (${args.join(", ")})` : ""}`;
  }
}

/**
 * Wrap an async function with error handling
 */
export async function withErrorHandling<T>(
  fn: () => Promise<T>,
  context: string
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    const parsedError = parseContractError(error);
    parsedError.message = `${context}: ${parsedError.message}`;
    throw parsedError;
  }
}
