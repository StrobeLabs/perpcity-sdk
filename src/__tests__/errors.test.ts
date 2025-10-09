import { describe, it, expect } from 'vitest';
import {
  PerpCityError,
  ContractError,
  TransactionRejectedError,
  InsufficientFundsError,
  GraphQLError,
  RPCError,
  ValidationError,
  parseContractError,
} from '../utils/errors';
import { BaseError, ContractFunctionRevertedError } from 'viem';

describe('Error Classes', () => {
  it('should create PerpCityError with message', () => {
    const error = new PerpCityError('Test error');
    expect(error.message).toBe('Test error');
    expect(error.name).toBe('PerpCityError');
  });

  it('should create ContractError with error details', () => {
    const error = new ContractError(
      'Invalid margin',
      'InvalidMargin',
      [100n]
    );
    expect(error.message).toBe('Invalid margin');
    expect(error.errorName).toBe('InvalidMargin');
    expect(error.args).toEqual([100n]);
    expect(error.name).toBe('ContractError');
  });

  it('should create TransactionRejectedError', () => {
    const error = new TransactionRejectedError();
    expect(error.message).toBe('Transaction rejected by user');
    expect(error.name).toBe('TransactionRejectedError');
  });

  it('should create InsufficientFundsError', () => {
    const error = new InsufficientFundsError();
    expect(error.message).toBe('Insufficient funds for transaction');
    expect(error.name).toBe('InsufficientFundsError');
  });

  it('should create GraphQLError', () => {
    const error = new GraphQLError('Query failed');
    expect(error.message).toBe('Query failed');
    expect(error.name).toBe('GraphQLError');
  });

  it('should create RPCError', () => {
    const error = new RPCError('RPC call failed');
    expect(error.message).toBe('RPC call failed');
    expect(error.name).toBe('RPCError');
  });

  it('should create ValidationError', () => {
    const error = new ValidationError('Validation failed');
    expect(error.message).toBe('Validation failed');
    expect(error.name).toBe('ValidationError');
  });
});

describe('parseContractError', () => {
  it('should pass through PerpCityError instances', () => {
    const originalError = new ContractError('Test', 'InvalidMargin', [100n]);
    const result = parseContractError(originalError);
    expect(result).toBe(originalError);
  });

  it('should handle generic Error', () => {
    const error = new Error('Something went wrong');
    const result = parseContractError(error);
    expect(result).toBeInstanceOf(PerpCityError);
    expect(result.message).toBe('Something went wrong');
    expect(result.cause).toBe(error);
  });

  it('should handle unknown error types', () => {
    const result = parseContractError('String error');
    expect(result).toBeInstanceOf(PerpCityError);
    expect(result.message).toBe('String error');
  });

  it('should parse ContractFunctionRevertedError for PriceImpactTooHigh', () => {
    // Create a mock ContractFunctionRevertedError instance
    const mockRevertError = new ContractFunctionRevertedError({
      abi: [],
      functionName: 'test',
    } as any);
    // Manually set the data property
    (mockRevertError as any).data = {
      errorName: 'PriceImpactTooHigh',
      args: [1000n, 900n, 1100n],
    };

    // Create a proper BaseError instance
    const mockError = new BaseError('Contract execution reverted', {
      cause: mockRevertError,
    });
    // Override walk to return our mock revert error
    (mockError as any).walk = (fn: (err: any) => any) => {
      if (fn(mockRevertError)) return mockRevertError;
      return null;
    };

    const result = parseContractError(mockError);
    expect(result).toBeInstanceOf(ContractError);
    expect((result as ContractError).errorName).toBe('PriceImpactTooHigh');
    expect((result as ContractError).args).toEqual([1000n, 900n, 1100n]);
    expect(result.message).toContain('Price impact too high');
    expect(result.message).toContain('1000');
    expect(result.message).toContain('900');
    expect(result.message).toContain('1100');
  });

  it('should parse ContractFunctionRevertedError for InvalidLevX96', () => {
    const mockRevertError = new ContractFunctionRevertedError({
      abi: [],
      functionName: 'test',
    } as any);
    (mockRevertError as any).data = {
      errorName: 'InvalidLevX96',
      args: [15n, 10n],
    };

    const mockError = new BaseError('Contract execution reverted', {
      cause: mockRevertError,
    });
    (mockError as any).walk = (fn: (err: any) => any) => {
      if (fn(mockRevertError)) return mockRevertError;
      return null;
    };

    const result = parseContractError(mockError);
    expect(result).toBeInstanceOf(ContractError);
    expect((result as ContractError).errorName).toBe('InvalidLevX96');
    expect((result as ContractError).args).toEqual([15n, 10n]);
    expect(result.message).toContain('Invalid leverage');
    expect(result.message).toContain('15');
    expect(result.message).toContain('10');
  });

  it('should parse ContractFunctionRevertedError for SwapReverted', () => {
    const mockRevertError = new ContractFunctionRevertedError({
      abi: [],
      functionName: 'test',
    } as any);
    (mockRevertError as any).data = {
      errorName: 'SwapReverted',
      args: [],
    };

    const mockError = new BaseError('Contract execution reverted', {
      cause: mockRevertError,
    });
    (mockError as any).walk = (fn: (err: any) => any) => {
      if (fn(mockRevertError)) return mockRevertError;
      return null;
    };

    const result = parseContractError(mockError);
    expect(result).toBeInstanceOf(ContractError);
    expect((result as ContractError).errorName).toBe('SwapReverted');
    expect((result as ContractError).args).toEqual([]);
    expect(result.message).toContain('Swap failed');
    expect(result.message).toContain('insufficient liquidity or slippage');
  });

  it('should parse BaseError with "User rejected the request" as TransactionRejectedError', () => {
    const mockError = new BaseError('User rejected the request');
    (mockError as any).walk = () => null;

    const result = parseContractError(mockError);
    expect(result).toBeInstanceOf(TransactionRejectedError);
    expect(result.message).toContain('User rejected the request');
  });

  it('should parse BaseError with code 4001 as TransactionRejectedError', () => {
    const mockError = new BaseError('Transaction was rejected');
    (mockError as any).code = 4001;
    (mockError as any).walk = () => null;

    const result = parseContractError(mockError);
    expect(result).toBeInstanceOf(TransactionRejectedError);
  });

  it('should parse BaseError with "insufficient funds" as InsufficientFundsError', () => {
    const mockError = new BaseError('insufficient funds for gas * price + value');
    (mockError as any).walk = () => null;

    const result = parseContractError(mockError);
    expect(result).toBeInstanceOf(InsufficientFundsError);
    expect(result.message).toContain('insufficient funds');
  });

  it('should parse BaseError without ContractFunctionRevertedError as PerpCityError', () => {
    const mockError = new BaseError('Generic RPC error', {
      details: 'Connection timeout',
    });
    (mockError as any).shortMessage = 'RPC request failed';
    (mockError as any).walk = () => null;

    const result = parseContractError(mockError);
    expect(result).toBeInstanceOf(PerpCityError);
    expect(result).not.toBeInstanceOf(ContractError);
    expect(result.message).toBe('RPC request failed');
  });
});
