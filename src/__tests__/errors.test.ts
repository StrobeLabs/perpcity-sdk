import { BaseError, ContractFunctionRevertedError } from "viem";
import { describe, expect, it } from "vitest";
import {
  ContractError,
  ErrorCategory,
  ErrorSource,
  InsufficientFundsError,
  PerpCityError,
  parseContractError,
  RPCError,
  TransactionRejectedError,
  ValidationError,
} from "../utils/errors";

describe("Error Classes", () => {
  it("should create PerpCityError with message", () => {
    const error = new PerpCityError("Test error");
    expect(error.message).toBe("Test error");
    expect(error.name).toBe("PerpCityError");
  });

  it("should create ContractError with error details", () => {
    const error = new ContractError("Invalid margin", "InvalidMargin", [100n], {
      source: ErrorSource.PERP_MANAGER,
      category: ErrorCategory.USER_ERROR,
    });
    expect(error.message).toBe("Invalid margin");
    expect(error.errorName).toBe("InvalidMargin");
    expect(error.args).toEqual([100n]);
    expect(error.name).toBe("ContractError");
    expect(error.debug?.source).toBe(ErrorSource.PERP_MANAGER);
    expect(error.debug?.category).toBe(ErrorCategory.USER_ERROR);
  });

  it("should create TransactionRejectedError", () => {
    const error = new TransactionRejectedError();
    expect(error.message).toBe("Transaction rejected by user");
    expect(error.name).toBe("TransactionRejectedError");
  });

  it("should create InsufficientFundsError", () => {
    const error = new InsufficientFundsError();
    expect(error.message).toBe("Insufficient funds for transaction");
    expect(error.name).toBe("InsufficientFundsError");
  });

  it("should create RPCError", () => {
    const error = new RPCError("RPC call failed");
    expect(error.message).toBe("RPC call failed");
    expect(error.name).toBe("RPCError");
  });

  it("should create ValidationError", () => {
    const error = new ValidationError("Validation failed");
    expect(error.message).toBe("Validation failed");
    expect(error.name).toBe("ValidationError");
  });
});

describe("parseContractError", () => {
  it("should pass through PerpCityError instances", () => {
    const originalError = new ContractError("Test", "InvalidMargin", [100n]);
    const result = parseContractError(originalError);
    expect(result).toBe(originalError);
  });

  it("should handle generic Error", () => {
    const error = new Error("Something went wrong");
    const result = parseContractError(error);
    expect(result).toBeInstanceOf(PerpCityError);
    expect(result.message).toBe("Something went wrong");
    expect(result.cause).toBe(error);
  });

  it("should handle unknown error types", () => {
    const result = parseContractError("String error");
    expect(result).toBeInstanceOf(PerpCityError);
    expect(result.message).toBe("String error");
  });

  it("should parse ContractFunctionRevertedError for PriceImpactTooHigh", () => {
    // Create a mock ContractFunctionRevertedError instance
    const mockRevertError = new ContractFunctionRevertedError({
      abi: [],
      functionName: "test",
    } as any);
    // Manually set the data property
    (mockRevertError as any).data = {
      errorName: "PriceImpactTooHigh",
      args: [1000n, 900n, 1100n],
    };

    // Create a proper BaseError instance
    const mockError = new BaseError("Contract execution reverted", {
      cause: mockRevertError,
    });
    // Override walk to return our mock revert error
    (mockError as any).walk = (fn: (err: any) => any) => {
      if (fn(mockRevertError)) return mockRevertError;
      return null;
    };

    const result = parseContractError(mockError);
    expect(result).toBeInstanceOf(ContractError);
    expect((result as ContractError).errorName).toBe("PriceImpactTooHigh");
    expect((result as ContractError).args).toEqual([1000n, 900n, 1100n]);
    expect(result.message).toContain("Price impact too high");
    expect(result.message).toContain("1000");
    expect(result.message).toContain("900");
    expect(result.message).toContain("1100");
  });

  it("should parse ContractFunctionRevertedError for InvalidLevX96", () => {
    const mockRevertError = new ContractFunctionRevertedError({
      abi: [],
      functionName: "test",
    } as any);
    (mockRevertError as any).data = {
      errorName: "InvalidLevX96",
      args: [15n, 10n],
    };

    const mockError = new BaseError("Contract execution reverted", {
      cause: mockRevertError,
    });
    (mockError as any).walk = (fn: (err: any) => any) => {
      if (fn(mockRevertError)) return mockRevertError;
      return null;
    };

    const result = parseContractError(mockError);
    expect(result).toBeInstanceOf(ContractError);
    expect((result as ContractError).errorName).toBe("InvalidLevX96");
    expect((result as ContractError).args).toEqual([15n, 10n]);
    expect(result.message).toContain("Invalid leverage");
    expect(result.message).toContain("15");
    expect(result.message).toContain("10");
  });

  it("should parse ContractFunctionRevertedError for SwapReverted", () => {
    const mockRevertError = new ContractFunctionRevertedError({
      abi: [],
      functionName: "test",
    } as any);
    (mockRevertError as any).data = {
      errorName: "SwapReverted",
      args: [],
    };

    const mockError = new BaseError("Contract execution reverted", {
      cause: mockRevertError,
    });
    (mockError as any).walk = (fn: (err: any) => any) => {
      if (fn(mockRevertError)) return mockRevertError;
      return null;
    };

    const result = parseContractError(mockError);
    expect(result).toBeInstanceOf(ContractError);
    expect((result as ContractError).errorName).toBe("SwapReverted");
    expect((result as ContractError).args).toEqual([]);
    expect(result.message).toContain("Swap failed");
    expect(result.message).toContain("insufficient liquidity or slippage");
  });

  it('should parse BaseError with "User rejected the request" as TransactionRejectedError', () => {
    const mockError = new BaseError("User rejected the request");
    (mockError as any).walk = () => null;

    const result = parseContractError(mockError);
    expect(result).toBeInstanceOf(TransactionRejectedError);
    expect(result.message).toContain("User rejected the request");
  });

  it("should parse BaseError with code 4001 as TransactionRejectedError", () => {
    const mockError = new BaseError("Transaction was rejected");
    (mockError as any).code = 4001;
    (mockError as any).walk = () => null;

    const result = parseContractError(mockError);
    expect(result).toBeInstanceOf(TransactionRejectedError);
  });

  it('should parse BaseError with "insufficient funds" as InsufficientFundsError', () => {
    const mockError = new BaseError("insufficient funds for gas * price + value");
    (mockError as any).walk = () => null;

    const result = parseContractError(mockError);
    expect(result).toBeInstanceOf(InsufficientFundsError);
    expect(result.message).toContain("insufficient funds");
  });

  it("should parse BaseError without ContractFunctionRevertedError as PerpCityError", () => {
    const mockError = new BaseError("Generic RPC error", {
      details: "Connection timeout",
    });
    (mockError as any).shortMessage = "RPC request failed";
    (mockError as any).walk = () => null;

    const result = parseContractError(mockError);
    expect(result).toBeInstanceOf(PerpCityError);
    expect(result).not.toBeInstanceOf(ContractError);
    expect(result.message).toBe("RPC request failed");
  });
});

// Helper function to create mock contract errors
function createMockContractError(errorName: string, args: readonly unknown[] = []) {
  const mockRevertError = new ContractFunctionRevertedError({
    abi: [],
    functionName: "test",
  } as any);
  (mockRevertError as any).data = {
    errorName,
    args,
  };

  const mockError = new BaseError("Contract execution reverted", {
    cause: mockRevertError,
  });
  (mockError as any).walk = (fn: (err: any) => any) => {
    if (fn(mockRevertError)) return mockRevertError;
    return null;
  };

  return mockError;
}

describe("Uniswap V4 PoolManager Errors", () => {
  it("should parse CurrencyNotSettled with retry guidance", () => {
    const mockError = createMockContractError("CurrencyNotSettled");
    const result = parseContractError(mockError);

    expect(result).toBeInstanceOf(ContractError);
    expect((result as ContractError).errorName).toBe("CurrencyNotSettled");
    expect(result.message).toContain("Currency balance not settled");
    expect((result as ContractError).debug?.source).toBe(ErrorSource.POOL_MANAGER);
    expect((result as ContractError).debug?.category).toBe(ErrorCategory.SYSTEM_ERROR);
    expect((result as ContractError).debug?.retryGuidance).toContain("try again");
  });

  it("should parse PoolNotInitialized", () => {
    const mockError = createMockContractError("PoolNotInitialized");
    const result = parseContractError(mockError);

    expect(result).toBeInstanceOf(ContractError);
    expect((result as ContractError).errorName).toBe("PoolNotInitialized");
    expect(result.message).toContain("Pool does not exist");
    expect((result as ContractError).debug?.source).toBe(ErrorSource.POOL_MANAGER);
    expect((result as ContractError).debug?.category).toBe(ErrorCategory.STATE_ERROR);
  });

  it("should parse AlreadyUnlocked with retry guidance", () => {
    const mockError = createMockContractError("AlreadyUnlocked");
    const result = parseContractError(mockError);

    expect(result).toBeInstanceOf(ContractError);
    expect((result as ContractError).errorName).toBe("AlreadyUnlocked");
    expect(result.message).toContain("already unlocked");
    expect((result as ContractError).debug?.source).toBe(ErrorSource.POOL_MANAGER);
    expect((result as ContractError).debug?.category).toBe(ErrorCategory.SYSTEM_ERROR);
    expect((result as ContractError).debug?.canRetry).toBe(true);
  });

  it("should parse ManagerLocked with retry guidance", () => {
    const mockError = createMockContractError("ManagerLocked");
    const result = parseContractError(mockError);

    expect(result).toBeInstanceOf(ContractError);
    expect((result as ContractError).errorName).toBe("ManagerLocked");
    expect(result.message).toContain("Pool Manager is currently locked");
    expect((result as ContractError).debug?.source).toBe(ErrorSource.POOL_MANAGER);
    expect((result as ContractError).debug?.category).toBe(ErrorCategory.STATE_ERROR);
    expect((result as ContractError).debug?.canRetry).toBe(true);
    expect((result as ContractError).debug?.retryGuidance).toContain("retry");
  });

  it("should parse TickSpacingTooLarge with args", () => {
    const mockError = createMockContractError("TickSpacingTooLarge", [1000]);
    const result = parseContractError(mockError);

    expect(result).toBeInstanceOf(ContractError);
    expect((result as ContractError).errorName).toBe("TickSpacingTooLarge");
    expect(result.message).toContain("Tick spacing");
    expect(result.message).toContain("1000");
    expect((result as ContractError).debug?.source).toBe(ErrorSource.POOL_MANAGER);
    expect((result as ContractError).debug?.category).toBe(ErrorCategory.CONFIG_ERROR);
  });

  it("should parse TickSpacingTooSmall with args", () => {
    const mockError = createMockContractError("TickSpacingTooSmall", [1]);
    const result = parseContractError(mockError);

    expect(result).toBeInstanceOf(ContractError);
    expect((result as ContractError).errorName).toBe("TickSpacingTooSmall");
    expect(result.message).toContain("Tick spacing");
    expect(result.message).toContain("1");
    expect((result as ContractError).debug?.source).toBe(ErrorSource.POOL_MANAGER);
    expect((result as ContractError).debug?.category).toBe(ErrorCategory.CONFIG_ERROR);
  });

  it("should parse CurrenciesOutOfOrderOrEqual with currency addresses", () => {
    const mockError = createMockContractError("CurrenciesOutOfOrderOrEqual", [
      "0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6",
      "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    ]);
    const result = parseContractError(mockError);

    expect(result).toBeInstanceOf(ContractError);
    expect((result as ContractError).errorName).toBe("CurrenciesOutOfOrderOrEqual");
    expect(result.message).toContain("Currencies must be ordered");
    expect(result.message).toContain("0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6");
    expect((result as ContractError).debug?.source).toBe(ErrorSource.POOL_MANAGER);
    expect((result as ContractError).debug?.category).toBe(ErrorCategory.CONFIG_ERROR);
  });

  it("should parse UnauthorizedDynamicLPFeeUpdate", () => {
    const mockError = createMockContractError("UnauthorizedDynamicLPFeeUpdate");
    const result = parseContractError(mockError);

    expect(result).toBeInstanceOf(ContractError);
    expect((result as ContractError).errorName).toBe("UnauthorizedDynamicLPFeeUpdate");
    expect(result.message).toContain("Unauthorized attempt");
    expect((result as ContractError).debug?.source).toBe(ErrorSource.POOL_MANAGER);
    expect((result as ContractError).debug?.category).toBe(ErrorCategory.USER_ERROR);
  });

  it("should parse SwapAmountCannotBeZero", () => {
    const mockError = createMockContractError("SwapAmountCannotBeZero");
    const result = parseContractError(mockError);

    expect(result).toBeInstanceOf(ContractError);
    expect((result as ContractError).errorName).toBe("SwapAmountCannotBeZero");
    expect(result.message).toContain("cannot be zero");
    expect((result as ContractError).debug?.source).toBe(ErrorSource.POOL_MANAGER);
    expect((result as ContractError).debug?.category).toBe(ErrorCategory.USER_ERROR);
  });

  it("should parse NonzeroNativeValue", () => {
    const mockError = createMockContractError("NonzeroNativeValue");
    const result = parseContractError(mockError);

    expect(result).toBeInstanceOf(ContractError);
    expect((result as ContractError).errorName).toBe("NonzeroNativeValue");
    expect(result.message).toContain("Native ETH was sent");
    expect((result as ContractError).debug?.source).toBe(ErrorSource.POOL_MANAGER);
    expect((result as ContractError).debug?.category).toBe(ErrorCategory.USER_ERROR);
  });

  it("should parse MustClearExactPositiveDelta", () => {
    const mockError = createMockContractError("MustClearExactPositiveDelta");
    const result = parseContractError(mockError);

    expect(result).toBeInstanceOf(ContractError);
    expect((result as ContractError).errorName).toBe("MustClearExactPositiveDelta");
    expect(result.message).toContain("exact positive delta");
    expect((result as ContractError).debug?.source).toBe(ErrorSource.POOL_MANAGER);
    expect((result as ContractError).debug?.category).toBe(ErrorCategory.SYSTEM_ERROR);
  });
});

describe("PerpManager ERC721/Ownership Errors", () => {
  it("should parse AccountBalanceOverflow", () => {
    const mockError = createMockContractError("AccountBalanceOverflow");
    const result = parseContractError(mockError);

    expect(result).toBeInstanceOf(ContractError);
    expect((result as ContractError).errorName).toBe("AccountBalanceOverflow");
    expect(result.message).toContain("balance overflow");
    expect((result as ContractError).debug?.source).toBe(ErrorSource.PERP_MANAGER);
    expect((result as ContractError).debug?.category).toBe(ErrorCategory.SYSTEM_ERROR);
  });

  it("should parse BalanceQueryForZeroAddress", () => {
    const mockError = createMockContractError("BalanceQueryForZeroAddress");
    const result = parseContractError(mockError);

    expect(result).toBeInstanceOf(ContractError);
    expect((result as ContractError).errorName).toBe("BalanceQueryForZeroAddress");
    expect(result.message).toContain("zero address");
    expect((result as ContractError).debug?.source).toBe(ErrorSource.PERP_MANAGER);
    expect((result as ContractError).debug?.category).toBe(ErrorCategory.USER_ERROR);
  });

  it("should parse NotOwnerNorApproved", () => {
    const mockError = createMockContractError("NotOwnerNorApproved");
    const result = parseContractError(mockError);

    expect(result).toBeInstanceOf(ContractError);
    expect((result as ContractError).errorName).toBe("NotOwnerNorApproved");
    expect(result.message).toContain("not the owner or an approved operator");
    expect((result as ContractError).debug?.source).toBe(ErrorSource.PERP_MANAGER);
    expect((result as ContractError).debug?.category).toBe(ErrorCategory.USER_ERROR);
  });

  it("should parse TokenAlreadyExists", () => {
    const mockError = createMockContractError("TokenAlreadyExists");
    const result = parseContractError(mockError);

    expect(result).toBeInstanceOf(ContractError);
    expect((result as ContractError).errorName).toBe("TokenAlreadyExists");
    expect(result.message).toContain("already exists");
    expect((result as ContractError).debug?.source).toBe(ErrorSource.PERP_MANAGER);
    expect((result as ContractError).debug?.category).toBe(ErrorCategory.STATE_ERROR);
  });

  it("should parse TokenDoesNotExist", () => {
    const mockError = createMockContractError("TokenDoesNotExist");
    const result = parseContractError(mockError);

    expect(result).toBeInstanceOf(ContractError);
    expect((result as ContractError).errorName).toBe("TokenDoesNotExist");
    expect(result.message).toContain("does not exist");
    expect((result as ContractError).debug?.source).toBe(ErrorSource.PERP_MANAGER);
    expect((result as ContractError).debug?.category).toBe(ErrorCategory.USER_ERROR);
  });

  it("should parse TransferFromIncorrectOwner", () => {
    const mockError = createMockContractError("TransferFromIncorrectOwner");
    const result = parseContractError(mockError);

    expect(result).toBeInstanceOf(ContractError);
    expect((result as ContractError).errorName).toBe("TransferFromIncorrectOwner");
    expect(result.message).toContain("incorrect owner");
    expect((result as ContractError).debug?.source).toBe(ErrorSource.PERP_MANAGER);
    expect((result as ContractError).debug?.category).toBe(ErrorCategory.USER_ERROR);
  });

  it("should parse TransferToNonERC721ReceiverImplementer", () => {
    const mockError = createMockContractError("TransferToNonERC721ReceiverImplementer");
    const result = parseContractError(mockError);

    expect(result).toBeInstanceOf(ContractError);
    expect((result as ContractError).errorName).toBe("TransferToNonERC721ReceiverImplementer");
    expect(result.message).toContain("does not implement ERC721 receiver");
    expect((result as ContractError).debug?.source).toBe(ErrorSource.PERP_MANAGER);
    expect((result as ContractError).debug?.category).toBe(ErrorCategory.USER_ERROR);
  });

  it("should parse TransferToZeroAddress", () => {
    const mockError = createMockContractError("TransferToZeroAddress");
    const result = parseContractError(mockError);

    expect(result).toBeInstanceOf(ContractError);
    expect((result as ContractError).errorName).toBe("TransferToZeroAddress");
    expect(result.message).toContain("zero address");
    expect((result as ContractError).debug?.source).toBe(ErrorSource.PERP_MANAGER);
    expect((result as ContractError).debug?.category).toBe(ErrorCategory.USER_ERROR);
  });

  it("should parse NewOwnerIsZeroAddress", () => {
    const mockError = createMockContractError("NewOwnerIsZeroAddress");
    const result = parseContractError(mockError);

    expect(result).toBeInstanceOf(ContractError);
    expect((result as ContractError).errorName).toBe("NewOwnerIsZeroAddress");
    expect(result.message).toContain("zero address");
    expect((result as ContractError).debug?.source).toBe(ErrorSource.PERP_MANAGER);
    expect((result as ContractError).debug?.category).toBe(ErrorCategory.USER_ERROR);
  });

  it("should parse NoHandoverRequest", () => {
    const mockError = createMockContractError("NoHandoverRequest");
    const result = parseContractError(mockError);

    expect(result).toBeInstanceOf(ContractError);
    expect((result as ContractError).errorName).toBe("NoHandoverRequest");
    expect(result.message).toContain("No pending ownership handover");
    expect((result as ContractError).debug?.source).toBe(ErrorSource.PERP_MANAGER);
    expect((result as ContractError).debug?.category).toBe(ErrorCategory.STATE_ERROR);
  });

  it("should parse Unauthorized", () => {
    const mockError = createMockContractError("Unauthorized");
    const result = parseContractError(mockError);

    expect(result).toBeInstanceOf(ContractError);
    expect((result as ContractError).errorName).toBe("Unauthorized");
    expect(result.message).toContain("Unauthorized access");
    expect((result as ContractError).debug?.source).toBe(ErrorSource.PERP_MANAGER);
    expect((result as ContractError).debug?.category).toBe(ErrorCategory.USER_ERROR);
  });
});

describe("PerpManager Transfer/Approval Errors", () => {
  it("should parse TransferFromFailed", () => {
    const mockError = createMockContractError("TransferFromFailed");
    const result = parseContractError(mockError);

    expect(result).toBeInstanceOf(ContractError);
    expect((result as ContractError).errorName).toBe("TransferFromFailed");
    expect(result.message).toContain("transferFrom operation failed");
    expect((result as ContractError).debug?.source).toBe(ErrorSource.PERP_MANAGER);
    expect((result as ContractError).debug?.category).toBe(ErrorCategory.USER_ERROR);
  });

  it("should parse TransferFailed", () => {
    const mockError = createMockContractError("TransferFailed");
    const result = parseContractError(mockError);

    expect(result).toBeInstanceOf(ContractError);
    expect((result as ContractError).errorName).toBe("TransferFailed");
    expect(result.message).toContain("transfer operation failed");
    expect((result as ContractError).debug?.source).toBe(ErrorSource.PERP_MANAGER);
    expect((result as ContractError).debug?.category).toBe(ErrorCategory.SYSTEM_ERROR);
  });

  it("should parse ApproveFailed", () => {
    const mockError = createMockContractError("ApproveFailed");
    const result = parseContractError(mockError);

    expect(result).toBeInstanceOf(ContractError);
    expect((result as ContractError).errorName).toBe("ApproveFailed");
    expect(result.message).toContain("approve operation failed");
    expect((result as ContractError).debug?.source).toBe(ErrorSource.PERP_MANAGER);
    expect((result as ContractError).debug?.category).toBe(ErrorCategory.SYSTEM_ERROR);
  });
});

describe("PerpManager Module Config Errors", () => {
  it("should parse AlreadyInitialized", () => {
    const mockError = createMockContractError("AlreadyInitialized");
    const result = parseContractError(mockError);

    expect(result).toBeInstanceOf(ContractError);
    expect((result as ContractError).errorName).toBe("AlreadyInitialized");
    expect(result.message).toContain("already been initialized");
    expect((result as ContractError).debug?.source).toBe(ErrorSource.PERP_MANAGER);
    expect((result as ContractError).debug?.category).toBe(ErrorCategory.CONFIG_ERROR);
  });

  it("should parse FeesNotRegistered", () => {
    const mockError = createMockContractError("FeesNotRegistered");
    const result = parseContractError(mockError);

    expect(result).toBeInstanceOf(ContractError);
    expect((result as ContractError).errorName).toBe("FeesNotRegistered");
    expect(result.message).toContain("Fees module has not been registered");
    expect((result as ContractError).debug?.source).toBe(ErrorSource.PERP_MANAGER);
    expect((result as ContractError).debug?.category).toBe(ErrorCategory.CONFIG_ERROR);
  });

  it("should parse FeeTooLarge", () => {
    const mockError = createMockContractError("FeeTooLarge");
    const result = parseContractError(mockError);

    expect(result).toBeInstanceOf(ContractError);
    expect((result as ContractError).errorName).toBe("FeeTooLarge");
    expect(result.message).toContain("fee exceeds");
    expect((result as ContractError).debug?.source).toBe(ErrorSource.PERP_MANAGER);
    expect((result as ContractError).debug?.category).toBe(ErrorCategory.CONFIG_ERROR);
  });

  it("should parse MarginRatiosNotRegistered", () => {
    const mockError = createMockContractError("MarginRatiosNotRegistered");
    const result = parseContractError(mockError);

    expect(result).toBeInstanceOf(ContractError);
    expect((result as ContractError).errorName).toBe("MarginRatiosNotRegistered");
    expect(result.message).toContain("Margin ratios module");
    expect((result as ContractError).debug?.source).toBe(ErrorSource.PERP_MANAGER);
    expect((result as ContractError).debug?.category).toBe(ErrorCategory.CONFIG_ERROR);
  });

  it("should parse LockupPeriodNotRegistered", () => {
    const mockError = createMockContractError("LockupPeriodNotRegistered");
    const result = parseContractError(mockError);

    expect(result).toBeInstanceOf(ContractError);
    expect((result as ContractError).errorName).toBe("LockupPeriodNotRegistered");
    expect(result.message).toContain("Lockup period module");
    expect((result as ContractError).debug?.source).toBe(ErrorSource.PERP_MANAGER);
    expect((result as ContractError).debug?.category).toBe(ErrorCategory.CONFIG_ERROR);
  });

  it("should parse SqrtPriceImpactLimitNotRegistered", () => {
    const mockError = createMockContractError("SqrtPriceImpactLimitNotRegistered");
    const result = parseContractError(mockError);

    expect(result).toBeInstanceOf(ContractError);
    expect((result as ContractError).errorName).toBe("SqrtPriceImpactLimitNotRegistered");
    expect(result.message).toContain("Sqrt price impact limit module");
    expect((result as ContractError).debug?.source).toBe(ErrorSource.PERP_MANAGER);
    expect((result as ContractError).debug?.category).toBe(ErrorCategory.CONFIG_ERROR);
  });

  it("should parse ModuleAlreadyRegistered", () => {
    const mockError = createMockContractError("ModuleAlreadyRegistered");
    const result = parseContractError(mockError);

    expect(result).toBeInstanceOf(ContractError);
    expect((result as ContractError).errorName).toBe("ModuleAlreadyRegistered");
    expect(result.message).toContain("already been registered");
    expect((result as ContractError).debug?.source).toBe(ErrorSource.PERP_MANAGER);
    expect((result as ContractError).debug?.category).toBe(ErrorCategory.CONFIG_ERROR);
  });
});

describe("PerpManager Position/Trading Errors", () => {
  it("should parse InvalidAction with args", () => {
    const mockError = createMockContractError("InvalidAction", [5]);
    const result = parseContractError(mockError);

    expect(result).toBeInstanceOf(ContractError);
    expect((result as ContractError).errorName).toBe("InvalidAction");
    expect(result.message).toContain("Invalid action type");
    expect(result.message).toContain("5");
    expect((result as ContractError).debug?.source).toBe(ErrorSource.PERP_MANAGER);
    expect((result as ContractError).debug?.category).toBe(ErrorCategory.USER_ERROR);
  });

  it("should parse InvalidMarginRatio with args", () => {
    const mockError = createMockContractError("InvalidMarginRatio", [150]);
    const result = parseContractError(mockError);

    expect(result).toBeInstanceOf(ContractError);
    expect((result as ContractError).errorName).toBe("InvalidMarginRatio");
    expect(result.message).toContain("Invalid margin ratio");
    expect(result.message).toContain("150");
    expect((result as ContractError).debug?.source).toBe(ErrorSource.PERP_MANAGER);
    expect((result as ContractError).debug?.category).toBe(ErrorCategory.USER_ERROR);
  });

  it("should parse MakerNotAllowed", () => {
    const mockError = createMockContractError("MakerNotAllowed");
    const result = parseContractError(mockError);

    expect(result).toBeInstanceOf(ContractError);
    expect((result as ContractError).errorName).toBe("MakerNotAllowed");
    expect(result.message).toContain("Maker positions are not allowed");
    expect((result as ContractError).debug?.source).toBe(ErrorSource.PERP_MANAGER);
    expect((result as ContractError).debug?.category).toBe(ErrorCategory.USER_ERROR);
  });

  it("should parse PositionLocked", () => {
    const mockError = createMockContractError("PositionLocked");
    const result = parseContractError(mockError);

    expect(result).toBeInstanceOf(ContractError);
    expect((result as ContractError).errorName).toBe("PositionLocked");
    expect(result.message).toContain("currently locked");
    expect((result as ContractError).debug?.source).toBe(ErrorSource.PERP_MANAGER);
    expect((result as ContractError).debug?.category).toBe(ErrorCategory.STATE_ERROR);
  });

  it("should parse ZeroDelta", () => {
    const mockError = createMockContractError("ZeroDelta");
    const result = parseContractError(mockError);

    expect(result).toBeInstanceOf(ContractError);
    expect((result as ContractError).errorName).toBe("ZeroDelta");
    expect(result.message).toContain("zero size");
    expect((result as ContractError).debug?.source).toBe(ErrorSource.PERP_MANAGER);
    expect((result as ContractError).debug?.category).toBe(ErrorCategory.STATE_ERROR);
  });

  it("should parse NotPoolManager", () => {
    const mockError = createMockContractError("NotPoolManager");
    const result = parseContractError(mockError);

    expect(result).toBeInstanceOf(ContractError);
    expect((result as ContractError).errorName).toBe("NotPoolManager");
    expect(result.message).toContain("Only the Uniswap V4 Pool Manager");
    expect((result as ContractError).debug?.source).toBe(ErrorSource.PERP_MANAGER);
    expect((result as ContractError).debug?.category).toBe(ErrorCategory.SYSTEM_ERROR);
  });

  it("should parse NoLiquidityToReceiveFees", () => {
    const mockError = createMockContractError("NoLiquidityToReceiveFees");
    const result = parseContractError(mockError);

    expect(result).toBeInstanceOf(ContractError);
    expect((result as ContractError).errorName).toBe("NoLiquidityToReceiveFees");
    expect(result.message).toContain("No liquidity available");
    expect((result as ContractError).debug?.source).toBe(ErrorSource.PERP_MANAGER);
    expect((result as ContractError).debug?.category).toBe(ErrorCategory.STATE_ERROR);
  });
});

describe("Raw JSON-RPC Error Parsing", () => {
  // Using selectors from actual deployed contracts (perpcity-indexer/abis/PerpManager.json)
  // InvalidMargin() selector: 0x3a29e65e
  // InvalidMarginRatio(uint256) selector: 0xfce16dd4
  // MaximumAmountExceeded(uint256,uint256) selector: 0xfbf41624
  // TokenDoesNotExist() selector: 0xceea21b6

  it("should decode error from JSON-RPC body format", () => {
    // Simulate the error format from issue #140
    // InvalidMargin() - no args - selector 0x3a29e65e
    const mockErrorMessage = `processing response error (body="{\\"jsonrpc\\":\\"2.0\\",\\"id\\":93,\\"error\\":{\\"code\\":3,\\"message\\":\\"execution reverted\\",\\"data\\":\\"0x3a29e65e\\"}}")`;

    const mockError = new Error(mockErrorMessage);
    const result = parseContractError(mockError);

    expect(result).toBeInstanceOf(ContractError);
    expect((result as ContractError).errorName).toBe("InvalidMargin");
    expect(result.message).toContain("Invalid margin amount");
  });

  it("should decode InvalidMarginRatio with args from JSON-RPC body", () => {
    // InvalidMarginRatio(uint256) selector: 0xfce16dd4
    // Args: marginRatio=150 (0x96 in hex)
    const mockErrorMessage = `processing response error (body="{\\"jsonrpc\\":\\"2.0\\",\\"id\\":1,\\"error\\":{\\"code\\":3,\\"message\\":\\"execution reverted\\",\\"data\\":\\"0xfce16dd40000000000000000000000000000000000000000000000000000000000000096\\"}}")`;

    const mockError = new Error(mockErrorMessage);
    const result = parseContractError(mockError);

    expect(result).toBeInstanceOf(ContractError);
    expect((result as ContractError).errorName).toBe("InvalidMarginRatio");
    expect(result.message).toContain("Invalid margin ratio");
    expect(result.message).toContain("150");
  });

  it("should handle pipe characters in truncated messages", () => {
    // Format with pipe characters inserted during truncation
    // InvalidMargin() - selector 0x3a29e65e
    const mockErrorMessage = `openTakerPosition: Execution reverted with reason: processing response error (body="{\\"|jsonrpc\\":\\"2.0\\",\\"id|\\": 93,\\"error|\\": {\\"code\\":3,\\"message\\":\\"execution reverted\\",\\"data\\":\\"0x3a29e65e\\"}}")`;

    const mockError = new Error(mockErrorMessage);
    const result = parseContractError(mockError);

    // Should still be able to parse despite pipe characters
    expect(result).toBeInstanceOf(ContractError);
    expect((result as ContractError).errorName).toBe("InvalidMargin");
  });

  it("should decode error from direct hex data in message", () => {
    // Sometimes errors contain raw hex data directly
    // TokenDoesNotExist() - selector 0xceea21b6
    const mockErrorMessage = `execution reverted: data=0xceea21b6`;

    const mockError = new Error(mockErrorMessage);
    const result = parseContractError(mockError);

    expect(result).toBeInstanceOf(ContractError);
    expect((result as ContractError).errorName).toBe("TokenDoesNotExist");
    expect(result.message).toContain("does not exist");
  });

  it("should fall back to PerpCityError for unknown error selectors", () => {
    // Unknown error selector
    const mockErrorMessage = `processing response error (body="{\\"jsonrpc\\":\\"2.0\\",\\"id\\":1,\\"error\\":{\\"code\\":3,\\"message\\":\\"execution reverted\\",\\"data\\":\\"0xdeadbeef\\"}}")`;

    const mockError = new Error(mockErrorMessage);
    const result = parseContractError(mockError);

    // Should fall back to PerpCityError since selector is unknown
    expect(result).toBeInstanceOf(PerpCityError);
    expect(result).not.toBeInstanceOf(ContractError);
  });

  it("should handle malformed JSON gracefully", () => {
    const mockErrorMessage = `processing response error (body="not valid json")`;

    const mockError = new Error(mockErrorMessage);
    const result = parseContractError(mockError);

    // Should fall back to PerpCityError
    expect(result).toBeInstanceOf(PerpCityError);
    expect(result.message).toContain("processing response error");
  });

  it("should decode MaximumAmountExceeded error with args", () => {
    // MaximumAmountExceeded(uint256,uint256) selector: 0xfbf41624
    // Args: maximumAmount=1000 (0x3e8), amountRequested=2000 (0x7d0)
    const mockErrorMessage = `processing response error (body="{\\"jsonrpc\\":\\"2.0\\",\\"id\\":1,\\"error\\":{\\"code\\":3,\\"message\\":\\"execution reverted\\",\\"data\\":\\"0xfbf4162400000000000000000000000000000000000000000000000000000000000003e800000000000000000000000000000000000000000000000000000000000007d0\\"}}")`;

    const mockError = new Error(mockErrorMessage);
    const result = parseContractError(mockError);

    expect(result).toBeInstanceOf(ContractError);
    expect((result as ContractError).errorName).toBe("MaximumAmountExceeded");
    expect(result.message).toContain("Maximum");
    expect(result.message).toContain("1000");
    expect(result.message).toContain("2000");
  });

  it("should decode ZeroDelta error", () => {
    // ZeroDelta() - no args - selector 0x6f0f5899
    const mockErrorMessage = `processing response error (body="{\\"jsonrpc\\":\\"2.0\\",\\"id\\":1,\\"error\\":{\\"code\\":3,\\"message\\":\\"execution reverted\\",\\"data\\":\\"0x6f0f5899\\"}}")`;

    const mockError = new Error(mockErrorMessage);
    const result = parseContractError(mockError);

    expect(result).toBeInstanceOf(ContractError);
    expect((result as ContractError).errorName).toBe("ZeroDelta");
    expect(result.message).toContain("zero size");
  });
});
