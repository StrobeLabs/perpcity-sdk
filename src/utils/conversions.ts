import { NUMBER_1E6, BIGINT_1E6, Q96 } from "./constants";

export function priceToSqrtPriceX96(price: number): bigint {
  if (price > Number.MAX_SAFE_INTEGER) {
    throw new Error('Price too large');
  }

  const scaledSqrtPrice: number = Math.sqrt(price) * NUMBER_1E6;
  return BigInt(Math.floor(scaledSqrtPrice)) * Q96 / BigInt(NUMBER_1E6);
}

export function scale6Decimals(amount: number): bigint {
  if (amount > Number.MAX_SAFE_INTEGER / NUMBER_1E6) {
    throw new Error('Amount too large');
  }

  return BigInt(Math.floor(amount * NUMBER_1E6));
}

export function scaleToX96(amount: number): bigint {
  return BigInt(scale6Decimals(amount)) * Q96 / BigInt(NUMBER_1E6);
}

export function scaleFromX96(valueX96: bigint): number {
  const valueScaled6Decimals = valueX96 * BIGINT_1E6 / Q96;

  if (valueScaled6Decimals > Number.MAX_SAFE_INTEGER) {
    throw new Error('Value too large');
  }

  return Number(valueScaled6Decimals) / NUMBER_1E6;
}

export function priceToTick(price: number, roundDown: boolean): number {
  const logPrice = Math.log(price) / Math.log(1.0001);
  return roundDown ? Math.floor(logPrice) : Math.ceil(logPrice);
}

export function sqrtPriceX96ToPrice(sqrtPriceX96: bigint): number {
  const priceX96 = sqrtPriceX96 * sqrtPriceX96 / Q96;
  return scaleFromX96(priceX96);
}

export function marginRatioToLeverage(marginRatio: number): number {
  return NUMBER_1E6 / marginRatio;
}

export function scaleFrom6Decimals(value: number): number {
  return value / NUMBER_1E6;
}