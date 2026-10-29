import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PerpCityContext } from "../../context";
import { buildAdjustTakerCall, buildOpenTakerPositionCalls } from "../../functions/calldata";
import { simulateCalls } from "../../functions/simulate";
import type { PerpAddress } from "../../types";
import { type AnvilSetup, setupAnvil } from "../helpers/anvil-setup";

const NEXT_POS_ID_ABI = [
  {
    type: "function",
    name: "nextPosId",
    inputs: [],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
] as const;

describe("simulateCalls (anvil)", () => {
  let setup: AnvilSetup;
  let context: PerpCityContext;
  let perp: PerpAddress;

  beforeAll(async () => {
    setup = await setupAnvil();
    context = setup.context;
    perp = setup.testPerpId as PerpAddress;
  }, 60000);

  afterAll(() => {
    setup?.cleanup();
  });

  async function nextPosId(): Promise<bigint> {
    return setup.publicClient.readContract({
      address: perp,
      abi: NEXT_POS_ID_ABI,
      functionName: "nextPosId",
    });
  }

  it("simulates approve + openTaker, then an adjust of the position the batch created", async () => {
    const posId = await nextPosId();
    const openCalls = await buildOpenTakerPositionCalls(context, perp, {
      margin: 10,
      perpDelta: 20_000000n,
      amt1Limit: 0n,
    });
    const adjust = buildAdjustTakerCall(perp, {
      posId,
      marginDelta: 0n,
      perpDelta: 5_000000n,
      amt1Limit: 0n,
    });

    const result = await simulateCalls(context, setup.account, [...openCalls, adjust]);

    expect(result.ok).toBe(true);
    // Nothing was written to chain.
    expect(await nextPosId()).toBe(posId);
  });

  it("reports the failing index when the adjusted position does not exist yet", async () => {
    const posId = await nextPosId();
    const adjust = buildAdjustTakerCall(perp, {
      posId,
      marginDelta: 0n,
      perpDelta: 5_000000n,
      amt1Limit: 0n,
    });

    const result = await simulateCalls(context, setup.account, [adjust]);

    expect(result.ok).toBe(false);
    if (result.ok !== false) return;
    expect(result.failedIndex).toBe(0);
    expect(result.rawData.length).toBeGreaterThan(2);
  });
});
