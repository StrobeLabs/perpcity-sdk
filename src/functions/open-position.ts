import type { Hex } from "viem";
import { publicActions } from "viem";
import { PerpCityContext } from "../context";
import { scale6Decimals, scaleFrom6Decimals } from "../utils";
import { PERP_MANAGER_ABI } from "../abis/perp-manager";
import { ClosePositionParams, LiveDetails } from "../entities/openPosition";

// Re-export the OpenPosition class from functions for convenience
export { OpenPosition } from "../entities/openPosition";
