import type { Hex } from "viem";
import { type PerpCityContext, summarizePreview } from "../dist";
import { setup } from "./setup";

export async function view(context: PerpCityContext, perpId: Hex): Promise<void> {
  console.log("Fetching perp data for:", perpId);
  const perpData = await context.getPerpData(perpId);
  console.log("perpData:");
  console.log("  pool price:", perpData.ammPrice);
  console.log("  cached mark:", perpData.lastMark);
  console.log("  beacon:", perpData.beacon);
  console.log("  tickSpacing:", perpData.tickSpacing);
  console.log("  taker margin ratios (1e6):", perpData.takerMarginRatios);
  console.log("  fees:", perpData.fees);
  console.log("  open interest:", perpData.openInterest);
  console.log();

  const perpConfig = await context.getPerpConfig(perpId);
  console.log("perpConfig:");
  console.log("  owner:", perpConfig.owner);
  console.log("  governor:", perpConfig.governor);
  console.log("  latency (s):", perpConfig.latency);
  console.log("  withdrawal controller:", perpConfig.withdrawalController);
  console.log("  poolId:", perpConfig.poolId);
  console.log();

  // previewPosition: the contract's own equity, PnL and health for a position.
  const positionId = process.env.POSITION_ID;
  if (positionId) {
    const preview = await context.getPositionPreview(perpId, BigInt(positionId));
    console.log("position", positionId, summarizePreview(preview));
  }
}

async function main() {
  const { context, perpId } = setup();
  await view(context, perpId);
}

main();
