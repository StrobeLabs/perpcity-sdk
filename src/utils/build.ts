import type { Address } from "viem";
import type { PerpCityContext } from "../context";
import type { PerpAddress } from "../types";
import { PerpCityError } from "./errors";

/**
 * Contract build behind a deployed perp. Only the builds that run live markets
 * are listed: `58b42b7` (the first factory) and `v0.2.2` (perpcity-contracts
 * tag `v0.2.2-upgradeable`, 198559a). There is deliberately no value for
 * contracts `main`: protocol math for an unlisted build must fail loudly, not
 * silently reuse a deployed build's rules.
 */
export type PerpBuild = "58b42b7" | "v0.2.2";

export const PERP_BUILDS: readonly PerpBuild[] = ["58b42b7", "v0.2.2"];

/**
 * Pricing module address -> build of the perps that use it. Each factory
 * deploys with its own module set, so the module also names the build. Same
 * table as the backend's `perp_accrual.PRICING_MODULE_BUILDS`.
 */
export const PRICING_MODULE_BUILDS: Readonly<Record<string, PerpBuild>> = {
  "0xf4689da0cac3f23a04145236dbfe81c3c58cfe22": "58b42b7",
  "0xb0061a34425438073ae78c2fc7c94259e5fe6cbf": "v0.2.2",
  "0xc33205b471a9529fdd0a81fdea037737ff5c7a97": "58b42b7",
};

export class UnsupportedBuildError extends PerpCityError {
  constructor(
    public readonly perp: PerpAddress,
    cause?: Error
  ) {
    super(
      `Perp ${perp} is not a supported deployed build (58b42b7 or v0.2.2)`,
      cause,
      "VALIDATION_ERROR"
    );
    this.name = "UnsupportedBuildError";
  }
}

/**
 * Build from the two probes the backend uses: the pricing module address
 * first, then whether the perp answers `emas()` (a view only 58b42b7 has).
 */
export function buildFromProbe(pricingModule: Address, hasEmasView: boolean): PerpBuild {
  return PRICING_MODULE_BUILDS[pricingModule.toLowerCase()] ?? (hasEmasView ? "58b42b7" : "v0.2.2");
}

/** The perp's build, from its (cached) config. */
export async function detectPerpBuild(
  context: PerpCityContext,
  perpAddress: PerpAddress
): Promise<PerpBuild> {
  try {
    return (await context.getPerpConfig(perpAddress)).build;
  } catch (error) {
    throw new UnsupportedBuildError(perpAddress, error instanceof Error ? error : undefined);
  }
}
