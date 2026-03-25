import {
  BIGINT_1E6,
  INT256_THRESHOLD,
  MAX_PRICE,
  MIN_PRICE,
  NUMBER_1E6,
  Q96,
  UINT256_MAX,
} from "./constants";

export function priceToSqrtPriceX96(price: number): bigint {
  if (price <= 0) {
    throw new Error("Price must be positive");
  }
  if (price > Number.MAX_SAFE_INTEGER) {
    throw new Error("Price too large");
  }

  const scaledSqrtPrice: number = Math.sqrt(price) * NUMBER_1E6;
  return (BigInt(Math.floor(scaledSqrtPrice)) * Q96) / BigInt(NUMBER_1E6);
}

/**
 * Scales a number to 6 decimal precision as a bigint
 * @param amount - The amount to scale (can be negative for signed values)
 * @returns The scaled amount as a bigint
 */
export function scale6Decimals(amount: number): bigint {
  if (amount > Number.MAX_SAFE_INTEGER / NUMBER_1E6) {
    throw new Error("Amount too large");
  }

  return BigInt(Math.floor(amount * NUMBER_1E6));
}

export function scaleToX96(amount: number): bigint {
  return (BigInt(scale6Decimals(amount)) * Q96) / BigInt(NUMBER_1E6);
}

export function scaleFromX96(valueX96: bigint): number {
  const valueScaled6Decimals = (valueX96 * BIGINT_1E6) / Q96;

  if (valueScaled6Decimals > Number.MAX_SAFE_INTEGER) {
    throw new Error("Value too large");
  }

  return Number(valueScaled6Decimals) / NUMBER_1E6;
}

export function priceToTick(price: number, roundDown: boolean): number {
  if (price <= 0) {
    throw new Error("Price must be positive");
  }
  if (price < MIN_PRICE || price > MAX_PRICE) {
    throw new Error(
      `Price ${price} is outside the representable range [${MIN_PRICE}, ${MAX_PRICE}]`
    );
  }
  const logPrice = Math.log(price) / Math.log(1.0001);
  return roundDown ? Math.floor(logPrice) : Math.ceil(logPrice);
}

export function tickToPrice(tick: number): number {
  return 1.0001 ** tick;
}

/**
 * Interprets a uint256 as int256 if it exceeds 2^255 (unsigned underflow).
 * The contract returns netMargin as uint256, but it can underflow when
 * the effective margin is negative (position is underwater).
 */
export function uint256ToInt256(value: bigint): bigint {
  if (value >= INT256_THRESHOLD) {
    return value - UINT256_MAX - 1n;
  }
  return value;
}

export function sqrtPriceX96ToPrice(sqrtPriceX96: bigint): number {
  const priceX96 = (sqrtPriceX96 * sqrtPriceX96) / Q96;
  return scaleFromX96(priceX96);
}

export function marginRatioToLeverage(marginRatio: number): number {
  if (marginRatio <= 0) {
    throw new Error("Margin ratio must be greater than 0");
  }
  return NUMBER_1E6 / marginRatio;
}

export function scaleFrom6Decimals(value: number): number {
  return value / NUMBER_1E6;
}
