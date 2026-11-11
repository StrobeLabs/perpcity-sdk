import { describe, expect, it } from "vitest";
import { getPerpBeacon, getPerpFees, getPerpTickSpacing } from "../functions/perp";
import { openMakerPosition, openTakerPosition } from "../functions/perp-actions";
import {
  calculatePnlPercentage,
  calculatePositionSize,
  getPositionId,
  getPositionIsLong,
  getPositionIsMaker,
  getPositionPerpId,
  summarizePreview,
} from "../functions/position";
import { getUserOpenPositions, getUserUsdcBalance, getUserWalletAddress } from "../functions/user";
import type { OpenPositionData, PerpData, PositionPreview, UserData } from "../types/entity-data";

const Q96 = 2n ** 96n;

describe("Perp Functions", () => {
  const mockPerpData = {
    id: "0x123",
    tickSpacing: 30,
    beacon: "0xbeacon",
    fees: { liquidationFee: 0.004, protocolFee: 0.0005, maxSwapFee: 0.01 },
  } as unknown as PerpData;

  it("should extract beacon address", () => {
    expect(getPerpBeacon(mockPerpData)).toBe("0xbeacon");
  });

  it("should extract fees", () => {
    expect(getPerpFees(mockPerpData)).toEqual({
      liquidationFee: 0.004,
      protocolFee: 0.0005,
      maxSwapFee: 0.01,
    });
  });

  it("should extract tick spacing", () => {
    expect(getPerpTickSpacing(mockPerpData)).toBe(30);
  });
});

describe("User Functions", () => {
  const mockUserData: UserData = {
    walletAddress: "0xuser" as any,
    usdcBalance: 1000.0,
    openPositions: [
      {
        perpId: "0x123" as any,
        positionId: BigInt(1),
        isLong: true,
        isMaker: false,
      },
    ],
  };

  it("should extract USDC balance", () => {
    expect(getUserUsdcBalance(mockUserData)).toBe(1000.0);
  });

  it("should extract open positions", () => {
    const positions = getUserOpenPositions(mockUserData);
    expect(positions).toHaveLength(1);
    expect(positions[0].perpId).toBe("0x123");
    expect(positions[0].positionId).toBe(BigInt(1));
  });

  it("should extract wallet address", () => {
    expect(getUserWalletAddress(mockUserData)).toBe("0xuser");
  });
});

describe("Position Functions", () => {
  const mockPositionData: OpenPositionData = {
    perpId: "0x123" as any,
    positionId: BigInt(1),
    isLong: true,
    isMaker: false,
  };

  it("should extract position perp id", () => {
    expect(getPositionPerpId(mockPositionData)).toBe("0x123");
  });

  it("should extract position id", () => {
    expect(getPositionId(mockPositionData)).toBe(BigInt(1));
  });

  it("should extract position side metadata", () => {
    expect(getPositionIsLong(mockPositionData)).toBe(true);
    expect(getPositionIsMaker(mockPositionData)).toBe(false);
  });
});

describe("Position Opening Functions", () => {
  it("openTakerPosition should be a function", () => {
    expect(typeof openTakerPosition).toBe("function");
  });

  it("openMakerPosition should be a function", () => {
    expect(typeof openMakerPosition).toBe("function");
  });

  it("openTakerPosition should have correct signature", () => {
    expect(openTakerPosition.length).toBe(3); // context, perpId, params
  });

  it("openMakerPosition should have correct signature", () => {
    expect(openMakerPosition.length).toBe(3); // context, perpId, params
  });
});

describe("Position Calculation Functions", () => {
  it("calculatePositionSize reads signed perp atoms as whole perps", () => {
    expect(calculatePositionSize({ perpDelta: -2_500_000n })).toBe(-2.5);
  });

  it("summarizePreview converts the previewPosition struct to display units", () => {
    const preview: PositionPreview = {
      isMaker: false,
      markPrice: 2n * Q96,
      settledMargin: 10_000_000n,
      pendingLpFees: 0n,
      pendingFunding: 250_000n,
      pendingUtil: 50_000n,
      pendingReserveUtil: 10_000n,
      value: 40_000_000n,
      unrealizedPnl: -2_000_000n,
      equity: 8_000_000n,
      meetsInitialMargin: true,
      liquidatable: false,
      backstoppable: false,
      nominalLiqFee: 0n,
      payableLiqFee: 0n,
    };
    expect(summarizePreview(preview)).toEqual({
      markPrice: 2,
      value: 40,
      unrealizedPnl: -2,
      equity: 8,
      settledMargin: 10,
      pendingFunding: 0.25,
      pendingUtil: 0.05,
      pendingLpFees: 0,
      leverage: 5,
      liquidatable: false,
      meetsInitialMargin: true,
    });
    expect(summarizePreview({ ...preview, equity: 0n }).leverage).toBe(Infinity);
  });

  it("calculatePnlPercentage returns PnL over the initial margin", () => {
    expect(calculatePnlPercentage(10, -2, 108)).toBeCloseTo(8, 10);
    expect(calculatePnlPercentage(10, 0, 5)).toBe(0);
  });
});
