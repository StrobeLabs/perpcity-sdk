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

  it('should create ContractError with proper formatting', () => {
    const error = new ContractError(
      'Price impact too high. Current price: 1000, Min acceptable: 900, Max acceptable: 1100',
      'PriceImpactTooHigh',
      [1000n, 900n, 1100n]
    );
    expect(error.message).toContain('Price impact too high');
    expect(error.errorName).toBe('PriceImpactTooHigh');
  });

  it('should create ContractError for InvalidLevX96', () => {
    const error = new ContractError(
      'Invalid leverage: 15. Maximum allowed: 10',
      'InvalidLevX96',
      [15n, 10n]
    );
    expect(error.message).toContain('Invalid leverage');
    expect(error.errorName).toBe('InvalidLevX96');
  });

  it('should create ContractError for SwapReverted', () => {
    const error = new ContractError(
      'Swap failed. This may be due to insufficient liquidity or slippage tolerance.',
      'SwapReverted',
      []
    );
    expect(error.message).toContain('Swap failed');
    expect(error.errorName).toBe('SwapReverted');
  });
});
