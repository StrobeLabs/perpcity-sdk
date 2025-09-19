import { DECIMAL_PRECISION_6, Q96 } from "./constants";

export function priceToSqrtPriceX96(price: number): bigint {
  if (price > Number.MAX_SAFE_INTEGER) {
    throw new Error('Price too large');
  }

  const scaledSqrtPrice: number = Math.sqrt(price) * DECIMAL_PRECISION_6;
  return BigInt(Math.floor(scaledSqrtPrice)) * Q96 / BigInt(DECIMAL_PRECISION_6);
}

export function scale6Decimals(amount: number): bigint {
  if (amount > Number.MAX_SAFE_INTEGER / DECIMAL_PRECISION_6) {
    throw new Error('Amount too large');
  }

  return BigInt(Math.floor(amount * DECIMAL_PRECISION_6));
}

export function scaleX96(amount: number): bigint {
  return BigInt(scale6Decimals(amount)) * Q96 / BigInt(DECIMAL_PRECISION_6);
}

export function priceToTick(price: number, roundDown: boolean): number {
  const logSqrtPrice = Math.log(Math.sqrt(price)) / Math.log(1.0001);
  return roundDown ? Math.floor(logSqrtPrice) : Math.ceil(logSqrtPrice);
}