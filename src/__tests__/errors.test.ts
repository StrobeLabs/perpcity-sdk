import { BaseError, ContractFunctionRevertedError, keccak256, toBytes } from "viem";
import { describe, expect, it } from "vitest";
import { ERROR_SELECTORS, EXTENDED_ERROR_DECODE_ABI } from "../abis/error-decode";
import { PERP_ABI } from "../abis/perp";
import {
  ContractError,
  codeForErrorName,
  contractErrorFromRevertData,
  ErrorCategory,
  ErrorSource,
  InsufficientFundsError,
  PerpCityError,
  parseContractError,
  RPCError,
  TransactionRejectedError,
  TransactionRevertedError,
  ValidationError,
  withErrorHandling,
} from "../utils/errors";

describe("Error Classes", () => {
  it("should create PerpCityError with message", () => {
    const error = new PerpCityError("Test error");
    expect(error.message).toBe("Test error");
    expect(error.name).toBe("PerpCityError");
  });

  it("should create ContractError with error details", () => {
    const error = new ContractError("Invalid margin", "InvalidMargin", [100n], {
      source: ErrorSource.PERP,
      category: ErrorCategory.USER_ERROR,
    });
    expect(error.message).toBe("Invalid margin");
    expect(error.errorName).toBe("InvalidMargin");
    expect(error.args).toEqual([100n]);
    expect(error.name).toBe("ContractError");
    expect(error.debug?.source).toBe(ErrorSource.PERP);
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

function createMockRawRevertError(raw: `0x${string}`) {
  const mockRevertError = new ContractFunctionRevertedError({
    abi: [],
    functionName: "test",
  } as any);
  (mockRevertError as any).data = undefined;
  (mockRevertError as any).raw = raw;
  (mockRevertError as any).signature = raw.slice(0, 10);

  const mockError = new BaseError("Contract execution reverted", {
    cause: mockRevertError,
  });
  (mockError as any).walk = (fn: (err: any) => any) => {
    if (fn(mockRevertError)) return mockRevertError;
    return null;
  };

  return mockError;
}

function selectorFor(signature: string): `0x${string}` {
  return keccak256(toBytes(signature)).slice(0, 10) as `0x${string}`;
}

describe("machine-readable error codes", () => {
  it("defaults PerpCityError code to UNKNOWN", () => {
    const error = new PerpCityError("Test error");
    expect(error.code).toBe("UNKNOWN");
  });

  it("accepts an explicit code on PerpCityError", () => {
    const error = new PerpCityError("Test error", undefined, "VALIDATION_ERROR");
    expect(error.code).toBe("VALIDATION_ERROR");
  });

  it("sets subclass default codes", () => {
    expect(new TransactionRejectedError().code).toBe("USER_REJECTED");
    expect(new InsufficientFundsError().code).toBe("INSUFFICIENT_GAS");
    expect(new RPCError("rpc down").code).toBe("RPC_ERROR");
    expect(new ValidationError("bad input").code).toBe("VALIDATION_ERROR");
  });

  const NAME_TO_CODE: [string, string][] = [
    ["TransferFromFailed", "INSUFFICIENT_USDC_BALANCE"],
    ["MarginTooLow", "MARGIN_BELOW_MINIMUM"],
    ["MarginRatioTooLow", "MARGIN_RATIO_TOO_LOW"],
    ["HealthNotImproved", "MARGIN_RATIO_TOO_LOW"],
    ["MinAmtUnmet", "SLIPPAGE_EXCEEDED"],
    ["MaxAmtExceeded", "SLIPPAGE_EXCEEDED"],
    ["MaxTotalFeeExceeded", "FEE_CAP_EXCEEDED"],
    ["DeadlineExpired", "DEADLINE_EXPIRED"],
    ["ReduceOnlyViolated", "REDUCE_ONLY_VIOLATED"],
    ["LongCloseCapacityExceeded", "CLOSE_CAPACITY_EXCEEDED"],
    ["ShortCloseCapacityExceeded", "CLOSE_CAPACITY_EXCEEDED"],
    ["StaleBeaconIndex", "STALE_INDEX"],
    ["BeaconIndexUnreadable", "STALE_INDEX"],
    ["PriceImpactTooHigh", "PRICE_IMPACT_TOO_HIGH"],
    ["InsufficientLiquidityToFill", "INSUFFICIENT_LIQUIDITY"],
    ["PositionDoesNotExist", "POSITION_NOT_FOUND"],
    ["NonMakerPosition", "WRONG_POSITION_KIND"],
    ["NonTakerPosition", "WRONG_POSITION_KIND"],
    ["NotLiquidatable", "NOT_LIQUIDATABLE"],
    ["Abdicated", "MARKET_ABDICATED"],
    ["TvlCapExceeded", "TVL_CAP_EXCEEDED"],
    ["ClaimNotReady", "WITHDRAWAL_NOT_READY"],
    ["ReleasesArePaused", "WITHDRAWAL_PAUSED"],
    ["Unauthorized", "UNAUTHORIZED"],
    ["UnauthorizedCaller", "UNAUTHORIZED"],
    ["NotGovernor", "UNAUTHORIZED"],
    ["NegativeMargin", "CONTRACT_REVERT"],
    ["ZeroDelta", "CONTRACT_REVERT"],
    ["ManagerLocked", "CONTRACT_REVERT"],
  ];

  it.each(NAME_TO_CODE)("codeForErrorName(%s) is %s", (name, code) => {
    expect(codeForErrorName(name)).toBe(code);
  });

  it("returns UNKNOWN for an undecoded error name", () => {
    expect(codeForErrorName("Unknown")).toBe("UNKNOWN");
    expect(codeForErrorName("SomethingNeverSeen")).toBe("CONTRACT_REVERT");
  });

  it("carries the code on ContractError produced by parseContractError", () => {
    const result = parseContractError(createMockContractError("MarginTooLow", []));
    expect(result).toBeInstanceOf(ContractError);
    expect(result.code).toBe("MARGIN_BELOW_MINIMUM");
  });
});

describe("raw revert data decode fallback", () => {
  it("decodes solady TransferFromFailed from raw bytes as insufficient USDC", () => {
    const result = parseContractError(createMockRawRevertError("0x7939f424"));

    expect(result).toBeInstanceOf(ContractError);
    expect((result as ContractError).errorName).toBe("TransferFromFailed");
    expect(result.code).toBe("INSUFFICIENT_USDC_BALANCE");
    expect(result.message).not.toContain("Unknown");
    expect((result as ContractError).debug?.errorSelector).toBe("0x7939f424");
    expect((result as ContractError).debug?.rawData).toBe("0x7939f424");
  });

  it("decodes v1 MaxTotalFeeExceeded from raw bytes", () => {
    const result = parseContractError(
      createMockRawRevertError(selectorFor("MaxTotalFeeExceeded()"))
    );

    expect(result).toBeInstanceOf(ContractError);
    expect((result as ContractError).errorName).toBe("MaxTotalFeeExceeded");
    expect(result.code).toBe("FEE_CAP_EXCEEDED");
  });

  it("decodes V4 ManagerLocked from raw bytes with retry guidance", () => {
    const result = parseContractError(createMockRawRevertError(selectorFor("ManagerLocked()")));

    expect(result).toBeInstanceOf(ContractError);
    expect((result as ContractError).errorName).toBe("ManagerLocked");
    expect((result as ContractError).debug?.canRetry).toBe(true);
    expect((result as ContractError).debug?.source).toBe(ErrorSource.POOL_MANAGER);
  });

  it("keeps Unknown for an unrecognized selector but reports the selector", () => {
    const result = parseContractError(createMockRawRevertError("0xdeadbeef"));

    expect(result).toBeInstanceOf(ContractError);
    expect((result as ContractError).errorName).toBe("Unknown");
    expect(result.code).toBe("UNKNOWN");
    expect((result as ContractError).debug?.errorSelector).toBe("0xdeadbeef");
  });

  it("populates errorSelector and rawData on ABI-decoded reverts too", () => {
    const mockError = createMockContractError("MarginTooLow", []);
    const revertError = (mockError as any).walk(() => true);
    (revertError as any).raw = selectorFor("MarginTooLow()");
    (revertError as any).signature = selectorFor("MarginTooLow()");

    const result = parseContractError(mockError);
    expect((result as ContractError).debug?.errorSelector).toBe(selectorFor("MarginTooLow()"));
    expect((result as ContractError).debug?.rawData).toBe(selectorFor("MarginTooLow()"));
  });

  it("exports selector constants that match their signatures", () => {
    expect(ERROR_SELECTORS.TransferFromFailed).toBe("0x7939f424");
    expect(ERROR_SELECTORS.MarginRatioTooLow).toBe(selectorFor("MarginRatioTooLow()"));
    expect(ERROR_SELECTORS.MarginRatioTooLow).toBe("0xb2c649db");
  });

  it("every EXTENDED_ERROR_DECODE_ABI entry has a non-generic mapping and a code", () => {
    for (const entry of EXTENDED_ERROR_DECODE_ABI) {
      const result = parseContractError(
        createMockContractError(entry.name, new Array(entry.inputs.length).fill(0n))
      );
      expect(result, entry.name).toBeInstanceOf(ContractError);
      expect(result.message, entry.name).not.toContain("Contract error:");
      expect(result.message, entry.name).not.toContain("undefined");
      expect(result.code, entry.name).not.toBe("UNKNOWN");
    }
  });
});

describe("withErrorHandling structured fields", () => {
  it("prefixes the message but preserves shortMessage and sets operation", async () => {
    const failing = async () => {
      throw createMockContractError("MarginTooLow", []);
    };

    try {
      await withErrorHandling(failing, "openTakerPosition");
      expect.unreachable("should have thrown");
    } catch (error) {
      const parsed = error as PerpCityError;
      expect(parsed).toBeInstanceOf(ContractError);
      expect(parsed.operation).toBe("openTakerPosition");
      expect(parsed.message).toContain("openTakerPosition: ");
      expect(parsed.shortMessage).not.toContain("openTakerPosition");
      expect(parsed.message).toContain(parsed.shortMessage as string);
      expect(parsed.code).toBe("MARGIN_BELOW_MINIMUM");
    }
  });

  it("does not double-prefix when calls are nested", async () => {
    const failing = async () => {
      throw createMockContractError("MarginTooLow", []);
    };

    const error = await withErrorHandling(() => withErrorHandling(failing, "inner"), "outer").catch(
      (e: PerpCityError) => e
    );

    expect(error.operation).toBe("inner");
    expect(error.message.startsWith("inner: ")).toBe(true);
    expect(error.message).not.toContain("outer");
  });
});

describe("TransactionRevertedError", () => {
  it("is a PerpCityError carrying the tx hash and TX_REVERTED_ONCHAIN", () => {
    const error = new TransactionRevertedError("0xabc123");
    expect(error).toBeInstanceOf(PerpCityError);
    expect(error.name).toBe("TransactionRevertedError");
    expect(error.txHash).toBe("0xabc123");
    expect(error.code).toBe("TX_REVERTED_ONCHAIN");
    expect(error.message).toBe("Transaction reverted. Hash: 0xabc123");
  });
});

describe("v1.0.0 error table", () => {
  const perpErrors = PERP_ABI.filter((item) => item.type === "error");

  it("PERP_ABI carries every Errors.sol error, including library reverts", () => {
    const names = new Set<string>(perpErrors.map((e) => e.name));
    for (const name of [
      "MarginRatioTooLow",
      "MaxTotalFeeExceeded",
      "MinAmtUnmet",
      "MaxAmtExceeded",
      "DeadlineExpired",
      "ReduceOnlyViolated",
      "LongCloseCapacityExceeded",
      "ShortCloseCapacityExceeded",
      "StaleBeaconIndex",
      "TvlCapExceeded",
      "UnauthorizedPoolAction",
    ]) {
      expect(names.has(name), name).toBe(true);
    }
    expect(perpErrors.length).toBeGreaterThanOrEqual(51);
  });

  it.each(
    perpErrors.map((e) => [e.name, e] as const)
  )("%s decodes from its raw selector to a mapped message", (_name, entry) => {
    const signature = `${entry.name}(${entry.inputs.map((i) => i.type).join(",")})`;
    // Zero words for each (static) argument.
    const data = `${selectorFor(signature)}${"00".repeat(32 * entry.inputs.length)}` as const;
    const error = contractErrorFromRevertData(data);
    expect(error.errorName).toBe(entry.name);
    expect(error.message).not.toContain("Contract error:");
  });

  it("no v0 error name is left in the table", () => {
    for (const name of [
      "LongUtilizationExceeded",
      "InvalidLevX96",
      "SwapReverted",
      "PositionLocked",
    ]) {
      expect(codeForErrorName(name as never), name).toBe("CONTRACT_REVERT");
    }
  });
});
