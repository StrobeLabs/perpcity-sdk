import { DECIMAL_PRECISION_6, Q96 } from "./constants";

export function priceToSqrtPriceX96(price: number): bigint {
  if (price > Number.MAX_SAFE_INTEGER) {
    throw new Error('Price too large');
  }

  const scaledSqrtPrice: number = Math.sqrt(price) * DECIMAL_PRECISION_6;
  return BigInt(Math.floor(scaledSqrtPrice)) * Q96;
}