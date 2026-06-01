import type { Hex } from "viem";
import type { PerpCityContext } from "../dist";
import { setup } from "./setup";

export async function view(context: PerpCityContext, perpId: Hex): Promise<void> {
  // Fetch perp data
  console.log("Fetching perp data for:", perpId);
  const perpData = await context.getPerpData(perpId);
  console.log("perpData:");
  console.log("  id:", perpData.id);
  console.log("  mark:", perpData.mark);
  console.log("  beacon:", perpData.beacon);
  console.log("  tickSpacing:", perpData.tickSpacing);
  console.log("  bounds:", perpData.bounds);
  console.log("  fees:", perpData.fees);
  console.log();

  // Fetch perp config
  const perpConfig = await context.getPerpConfig(perpId);
  console.log("perpConfig:");
  console.log("  creator:", perpConfig.creator);
  console.log("  beacon:", perpConfig.beacon);
  console.log("  fees module:", perpConfig.fees);
  console.log("  funding module:", perpConfig.funding);
  console.log("  marginRatios module:", perpConfig.marginRatios);
  console.log("  priceImpact module:", perpConfig.priceImpact);
  console.log("  pricing module:", perpConfig.pricing);
  console.log("  protocolFeeManager:", perpConfig.protocolFeeManager);
  console.log("  poolId:", perpConfig.poolId);
  console.log();

  // Get user's USDC balance and positions
  // Note: getUserData requires position metadata tracked from transaction receipts
  // For a simple balance check without positions, use this approach:
  const userAddress = context.walletClient.account?.address;
  if (userAddress) {
    console.log("User address:", userAddress);
    // To get user data with positions, you need to track position IDs from transaction receipts
    // Example with no open positions:
    const userData = await context.getUserData(userAddress, []);
    console.log("usdcBalance:", userData.usdcBalance);
    console.log("openPositions count:", userData.openPositions.length);
  }
}

async function main() {
  const { context, perpId } = setup();
  await view(context, perpId);
}

main();
