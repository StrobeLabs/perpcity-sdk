import {
  type Abi,
  type Address,
  decodeFunctionResult,
  encodeFunctionData,
  type Hex,
  type PublicClient,
  parseAbi,
} from "viem";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { FEES_ABI } from "../../abis/fees";
import { PERP_ABI } from "../../abis/perp";
import {
  buildAdjustTakerCall,
  buildOpenTakerPositionCalls,
  maxTotalFeeFor,
} from "../../functions/calldata";
import {
  adjustTaker,
  createPerp,
  derivePerpDelta,
  openMakerPosition,
  openTakerPosition,
} from "../../functions/perp-actions";
import { closePosition } from "../../functions/position";
import { simulateCalls } from "../../functions/simulate";
import {
  type PerpViewName,
  readCumulatives,
  readMakerDetails,
  readPerpView,
  readPosition,
  readPositionPreview,
  readRates,
  readTakerDetails,
} from "../../functions/views";
import type { PerpCityError } from "../../utils/errors";
import {
  createFreshBeacon,
  mintTestUsdc,
  type SepoliaFork,
  startSepoliaFork,
} from "../helpers/sepolia-fork";

/**
 * v1.0.0 fork test (plan section 6, Level 1 "SDK"). It reads every Perp view
 * through the SDK and checks it against a raw `eth_call` decoded with types
 * written by hand from perpcity-contracts v1.0.0 `IPerp.sol` / `Structs.sol`,
 * so a wrong vendored ABI (F7: `positions`, `makerDetails`, `rates`,
 * `cumulatives` keep their selectors but change shape) fails here.
 *
 * No v1 perp is listed on Arbitrum Sepolia yet, so by default the test forks
 * Sepolia, makes a fresh v1 beacon and perp through the deployed v1
 * factories, and opens a maker and a taker with the SDK. When a listed perp
 * exists, set PERPCITY_V1_PERP (and PERPCITY_V1_POSITION) to read it on the
 * fork instead.
 *
 * Needs `anvil` and an Arbitrum Sepolia RPC (ARBITRUM_SEPOLIA_RPC_URL).
 */

const FORK_URL = process.env.ARBITRUM_SEPOLIA_RPC_URL;
const LISTED_PERP = process.env.PERPCITY_V1_PERP as Address | undefined;
const LISTED_POSITION = process.env.PERPCITY_V1_POSITION;

const Q96 = 2n ** 96n;

/** Hand-written from IPerp.sol / Structs.sol at v1.0.0. Do not generate. */
const STRUCTS_SOL_VIEWS = parseAbi([
  "struct Position { int256 delta; uint128 margin; int256 lastCumlFundingX96; }",
  "struct MakerFunding { int256 belowX96; int256 withinInventoryX192; }",
  "struct Maker { int24 tickLower; int24 tickUpper; uint128 liquidity; uint256 lastLpFeeGrowthInsideX128; MakerFunding lastCumlFunding; int256 lastFundingCorrectionX128; }",
  "struct Taker { uint256 lastUtilPaymentsX96; uint256 lastReserveUtilPaymentsX96; }",
  "struct PositionPreview { bool isMaker; uint256 markPrice; int256 settledMargin; uint256 pendingLpFees; int256 pendingFunding; uint256 pendingUtil; uint256 pendingReserveUtil; uint256 value; int256 unrealizedPnl; int256 equity; bool meetsInitialMargin; bool liquidatable; bool backstoppable; uint256 nominalLiqFee; uint256 payableLiqFee; }",
  "struct Rates { int88 fundingPerDay; uint64 longUtilFeePerDay; uint64 shortUtilFeePerDay; uint40 lastTouch; uint256 lastMark; }",
  "struct Cumulatives { int256 fundingX96; int256 fundingDivSqrtPX192; uint256 lpFeeGrowthGlobalX128; uint256 longUtilPaymentsX96; uint256 shortUtilPaymentsX96; uint256 longReserveUtilPaymentsX96; uint256 shortReserveUtilPaymentsX96; int256 fundingCorrectionX128; }",
  "struct Capacity { uint128 long; uint128 short; }",
  "struct OpenInterest { uint128 long; uint128 short; }",
  "struct FeeFund { uint80 insurance; uint80 creatorFees; uint80 protocolFees; }",
  "struct FundingState { int256 baseX96; int256 inventoryX96; uint256 makerLiquidity; }",
  "struct SolvencyState { uint128 badDebt; uint128 totalMargin; }",
  "struct UtilizationBand { uint128 lower; uint128 upper; }",
  "struct Modules { address beacon; address fees; address funding; address marginRatios; address priceImpact; address pricing; }",
  "struct PoolKey { address currency0; address currency1; uint24 fee; int24 tickSpacing; address hooks; }",
  "function positions(uint256 posId) view returns (Position)",
  "function makerDetails(uint256 posId) view returns (Maker)",
  "function takerDetails(uint256 posId) view returns (Taker)",
  "function previewPosition(uint256 posId) view returns (PositionPreview)",
  "function positionOwner(uint256 posId) view returns (address)",
  "function rates() view returns (Rates)",
  "function cumulatives() view returns (Cumulatives)",
  "function capacity() view returns (Capacity)",
  "function openInterest() view returns (OpenInterest)",
  "function feeFund() view returns (FeeFund)",
  "function fundingState() view returns (FundingState)",
  "function solvencyState() view returns (SolvencyState)",
  "function utilizationBand() view returns (UtilizationBand)",
  "function modules() view returns (Modules)",
  "function poolKey() view returns (PoolKey)",
  "function poolState() view returns (int24 tick, uint160 sqrtPrice, uint256 ammPrice, uint128 liquidity)",
  "function physicalCloseCapacity() view returns (uint128 longClose, uint128 shortClose)",
  "function accountedTvl() view returns (uint256)",
  "function currency0() view returns (address)",
  "function currency1() view returns (address)",
  "function emaWindow() view returns (uint24)",
  "function governor() view returns (address)",
  "function hooks() view returns (address)",
  "function latency() view returns (uint32)",
  "function nextPosId() view returns (uint256)",
  "function owner() view returns (address)",
  "function permissionlessDonationsEnabled() view returns (bool)",
  "function poolId() view returns (bytes32)",
  "function protocolFee() view returns (uint256)",
  "function protocolFeeManager() view returns (address)",
  "function tvlCap() view returns (uint256)",
  "function withdrawalController() view returns (address)",
  "function UPGRADE_INTERFACE_VERSION() view returns (string)",
  "function abdicated(bytes4 selector) view returns (bool)",
  "function readBeaconIndex(address beacon) view returns (uint128)",
  "function ownershipHandoverExpiresAt(address pendingOwner) view returns (uint256)",
]);

/** Static return size in 32-byte words: a field added or dropped (F7) changes it. */
const RETURN_WORDS: Partial<Record<PerpViewName, number>> = {
  positions: 3,
  makerDetails: 7,
  takerDetails: 2,
  previewPosition: 15,
  rates: 5,
  cumulatives: 8,
  capacity: 2,
  openInterest: 2,
  feeFund: 3,
  fundingState: 3,
  solvencyState: 2,
  utilizationBand: 2,
  modules: 6,
  poolKey: 5,
  poolState: 4,
  physicalCloseCapacity: 2,
};

/** Not callable through the market proxy (UUPS reverts by design). */
const SKIPPED_VIEWS = new Set<string>(["proxiableUUID"]);

async function rawView(
  client: PublicClient,
  perp: Address,
  functionName: string,
  args: readonly unknown[]
): Promise<{ data: Hex; decoded: unknown }> {
  const request = { abi: STRUCTS_SOL_VIEWS as Abi, functionName, args };
  const { data } = await client.call({ to: perp, data: encodeFunctionData(request) });
  if (!data) throw new Error(`${functionName}: empty eth_call result`);
  return { data, decoded: decodeFunctionResult({ ...request, data }) };
}

describe.runIf(FORK_URL)("v1.0.0 Perp on an Arbitrum Sepolia fork", () => {
  let fork: SepoliaFork;
  let perp: Address;
  let beacon: Address;
  let makerId: bigint;
  let takerId: bigint;

  beforeAll(async () => {
    fork = await startSepoliaFork(FORK_URL!);
    if (LISTED_PERP) {
      perp = LISTED_PERP;
      beacon = (await readPerpView(fork.publicClient, perp, "modules")).beacon;
      makerId = takerId = BigInt(LISTED_POSITION ?? "1");
      return;
    }

    beacon = await createFreshBeacon(fork, Q96 / 2n); // index 0.5
    perp = await createPerp(fork.context, {
      owner: fork.account,
      governor: fork.account,
      beacon,
      emaWindow: 3600,
      latency: 3600,
      salt: `0x${"11".repeat(32)}`,
      withdrawalConfig: {
        capacity: 1_000_000_000_000n,
        refillPerSecond: 1_000_000_000n,
        challengeWindow: 3600,
      },
    });
    await mintTestUsdc(fork, 1_000_000_000_000n);

    const maker = await openMakerPosition(fork.context, perp, {
      margin: 5_000,
      priceLower: 0.25,
      priceUpper: 1,
      liquidity: 10_000_000_000n,
      maxAmt0In: 2n ** 127n,
      maxAmt1In: 2n ** 127n,
    });
    makerId = maker.positionId;

    const perpData = await fork.context.getPerpData(perp);
    // 40 perps (~$20): small against the test range, inside the price-impact bound.
    const perpDelta = derivePerpDelta({ margin: 20, leverage: 1, price: 0.5, isLong: true });
    const taker = await openTakerPosition(fork.context, perp, {
      margin: 20,
      perpDelta,
      amt1Limit: 1_000_000_000n,
      maxTotalFee: maxTotalFeeFor(20_000_000n, {
        maxSwapFeeE6: BigInt(Math.round(perpData.fees.maxSwapFee * 1e6)),
        protocolFeeE6: BigInt(Math.round(perpData.fees.protocolFee * 1e6)),
      }),
    });
    takerId = taker.positionId;
  }, 240_000);

  afterAll(() => fork?.cleanup());

  it("covers every view in the vendored PERP_ABI", () => {
    const vendored = PERP_ABI.filter(
      (item) => item.type === "function" && item.stateMutability === "view"
    ).map((item) => (item as { name: string }).name);
    const handWritten = new Set(
      (STRUCTS_SOL_VIEWS as Abi)
        .filter((item) => item.type === "function")
        .map((item) => (item as { name: string }).name)
    );
    for (const name of vendored) {
      if (SKIPPED_VIEWS.has(name)) continue;
      expect(handWritten.has(name), `${name} has no hand-written type`).toBe(true);
    }
  });

  it("reads each view through the SDK and matches the raw eth_call", async () => {
    const argsFor = (name: string): readonly unknown[] => {
      if (["positions", "makerDetails", "previewPosition", "positionOwner"].includes(name))
        return [makerId];
      if (name === "takerDetails") return [takerId];
      if (name === "abdicated") return ["0x1d920967"];
      if (name === "readBeaconIndex") return [beacon];
      if (name === "ownershipHandoverExpiresAt") return [fork.account];
      return [];
    };

    for (const item of STRUCTS_SOL_VIEWS as Abi) {
      if (item.type !== "function") continue;
      const name = item.name as PerpViewName;
      const args = argsFor(name);
      const raw = await rawView(fork.publicClient, perp, name, args);
      const viaSdk = await readPerpView(
        fork.publicClient,
        perp,
        name,
        (args.length ? args : undefined) as never
      );
      expect(viaSdk, name).toEqual(raw.decoded);
      const words = RETURN_WORDS[name];
      if (words !== undefined) expect((raw.data.length - 2) / 64, name).toBe(words);
    }
  }, 120_000);

  it("typed struct readers match the raw eth_call (F7 views)", async () => {
    const c = fork.publicClient;
    const raw = async (name: string, args: readonly unknown[] = []) =>
      (await rawView(c, perp, name, args)).decoded;

    expect(await readPosition(c, perp, takerId)).toEqual(await raw("positions", [takerId]));
    expect(await readMakerDetails(c, perp, makerId)).toEqual(await raw("makerDetails", [makerId]));
    expect(await readTakerDetails(c, perp, takerId)).toEqual(await raw("takerDetails", [takerId]));
    expect(await readPositionPreview(c, perp, takerId)).toEqual(
      await raw("previewPosition", [takerId])
    );
    expect(await readRates(c, perp)).toEqual({
      ...((await raw("rates")) as object),
      lastTouch: Number(((await raw("rates")) as { lastTouch: number }).lastTouch),
    });
    expect(await readCumulatives(c, perp)).toEqual(await raw("cumulatives"));
  }, 60_000);

  it("getPositionRawData and previewPosition describe the opened positions", async () => {
    if (LISTED_PERP) return;
    const taker = await fork.context.getPositionRawData(perp, takerId);
    expect(taker.owner.toLowerCase()).toBe(fork.account.toLowerCase());
    expect(taker.makerDetails).toBeNull();
    expect(taker.perpDelta).toBeGreaterThan(0n);
    expect(taker.usdDelta).toBeLessThan(0n);

    const maker = await fork.context.getPositionRawData(perp, makerId);
    expect(maker.makerDetails?.liquidity).toBe(10_000_000_000n);

    const preview = await fork.context.getPositionPreview(perp, takerId);
    expect(preview.isMaker).toBe(false);
    expect(preview.markPrice).toBeGreaterThan(0n);
    expect(preview.equity).toBeGreaterThan(0n);
    expect(preview.liquidatable).toBe(false);

    const cfg = await fork.context.getPerpConfig(perp);
    expect(cfg.beacon.toLowerCase()).toBe(beacon.toLowerCase());
    expect(cfg.latency).toBe(3600);
    expect(cfg.key.tickSpacing).toBe(30);
    expect(
      await fork.publicClient.readContract({
        address: cfg.fees,
        abi: FEES_ABI,
        functionName: "maxSwapFee",
      })
    ).toBeGreaterThan(0n);
  }, 60_000);

  describe("simulateCalls preflight on v1", () => {
    it("passes an approve + openTaker batch", async () => {
      if (LISTED_PERP) return;
      const calls = await buildOpenTakerPositionCalls(fork.context, perp, {
        margin: 10,
        perpDelta: 10_000_000n,
        amt1Limit: 1_000_000_000n,
        maxTotalFee: 10_000_000n,
      });
      const result = await simulateCalls(fork.context, fork.account, calls, { timeoutMs: 30_000 });
      expect(result.ok).toBe(true);
    }, 60_000);

    it("reports the failing call and its v1 code", async () => {
      if (LISTED_PERP) return;
      const missing = buildAdjustTakerCall(perp, {
        posId: 999_999n,
        marginDelta: 0n,
        perpDelta: -1n,
        amt1Limit: 0n,
        maxTotalFee: 1n,
        reduceOnly: true,
      });
      const result = await simulateCalls(fork.context, fork.account, [missing], {
        timeoutMs: 30_000,
      });
      expect(result.ok).toBe(false);
      if (result.ok !== false) return;
      expect(result.failedIndex).toBe(0);
      expect(result.error.code).toBe("POSITION_NOT_FOUND");
    }, 60_000);
  });

  describe("the contract enforces the new trade fields", () => {
    const adjust = (over: Partial<Parameters<typeof adjustTaker>[2]>) =>
      adjustTaker(fork.context, perp, {
        posId: takerId,
        marginDelta: 0n,
        perpDelta: -1_000_000n,
        amt1Limit: 0n,
        maxTotalFee: 10_000_000n,
        reduceOnly: true,
        ...over,
      }).then(
        () => null,
        (error: PerpCityError) => error.code
      );

    it("an expired deadline reverts DeadlineExpired", async () => {
      if (LISTED_PERP) return;
      expect(await adjust({ deadline: 1n })).toBe("DEADLINE_EXPIRED");
    }, 60_000);

    it("a zero fee cap reverts MaxTotalFeeExceeded", async () => {
      if (LISTED_PERP) return;
      expect(await adjust({ maxTotalFee: 0n })).toBe("FEE_CAP_EXCEEDED");
    }, 60_000);

    it("reduceOnly rejects a flip", async () => {
      if (LISTED_PERP) return;
      const { perpDelta } = await fork.context.getPositionRawData(perp, takerId);
      expect(await adjust({ perpDelta: -2n * perpDelta })).toBe("REDUCE_ONLY_VIOLATED");
    }, 60_000);

    it("closePosition closes the taker with reduceOnly and a fee cap", async () => {
      if (LISTED_PERP) return;
      await closePosition(fork.context, perp, takerId, {
        amt1Limit: 0n,
        maxTotalFee: 10_000_000n,
      });
      expect(await readPerpView(fork.publicClient, perp, "positionOwner", [takerId])).toBe(
        "0x0000000000000000000000000000000000000000"
      );
    }, 60_000);
  });

  it("a maker close with inventory converts to a taker; a reduce-only close ends it", async () => {
    if (LISTED_PERP) return;
    const maker = await openMakerPosition(fork.context, perp, {
      margin: 5_000,
      priceLower: 0.25,
      priceUpper: 1,
      liquidity: 10_000_000_000n,
      maxAmt0In: 2n ** 127n,
      maxAmt1In: 2n ** 127n,
    });

    // A long trade through both ranges leaves the new maker short perp inventory.
    const perpData = await fork.context.getPerpData(perp);
    await openTakerPosition(fork.context, perp, {
      margin: 20,
      perpDelta: derivePerpDelta({ margin: 20, leverage: 1, price: 0.5, isLong: true }),
      amt1Limit: 1_000_000_000n,
      maxTotalFee: maxTotalFeeFor(20_000_000n, {
        maxSwapFeeE6: BigInt(Math.round(perpData.fees.maxSwapFee * 1e6)),
        protocolFeeE6: BigInt(Math.round(perpData.fees.protocolFee * 1e6)),
      }),
    });

    const makerClose = await closePosition(fork.context, perp, maker.positionId, {
      amt0Limit: 0n,
      amt1Limit: 0n,
    });
    expect(makerClose.converted).toBe(true);
    const converted = await fork.context.getPositionRawData(perp, maker.positionId);
    expect(converted.owner.toLowerCase()).toBe(fork.account.toLowerCase());
    expect(converted.makerDetails).toBeNull();
    expect(converted.perpDelta).toBeLessThan(0n);

    // Short close: amt1Limit is the max USD paid, so it cannot be 0.
    const takerClose = await closePosition(fork.context, perp, maker.positionId, {
      amt1Limit: 1_000_000_000n,
      maxTotalFee: 10_000_000n,
    });
    expect(takerClose.converted).toBe(false);
    expect(await readPerpView(fork.publicClient, perp, "positionOwner", [maker.positionId])).toBe(
      "0x0000000000000000000000000000000000000000"
    );
  }, 120_000);
});
