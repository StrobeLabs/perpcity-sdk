import { describe, expect, it } from "vitest";
import {
  getPerpBeacon,
  getPerpBounds,
  getPerpFees,
  getPerpMark,
  getPerpTickSpacing,
} from "../functions/perp";
import { openMakerPosition, openTakerPosition } from "../functions/perp-manager";
import {
  calculateEntryPrice,
  calculateLeverage,
  calculateLiquidationPrice,
  calculatePositionSize,
  calculatePositionValue,
  getPositionFundingPayment,
  getPositionIsLiquidatable,
  getPositionPnl,
} from "../functions/position";
import { getUserOpenPositions, getUserUsdcBalance, getUserWalletAddress } from "../functions/user";
import type { OpenPositionData, PerpData, PositionRawData, UserData } from "../types/entity-data";

describe("Perp Functions", () => {
  const mockPerpData: PerpData = {
    id: "0x123" as any,
    tickSpacing: 60,
    mark: 50.0,
    beacon: "0xbeacon",
    bounds: {
      minMargin: 100,
      minTakerLeverage: 1,
      maxTakerLeverage: 10,
      liquidationTakerRatio: 0.05,
    },
    fees: {
      creatorFee: 0.001,
      insuranceFee: 0.002,
      lpFee: 0.003,
      liquidationFee: 0.004,
    },
  };

  it("should extract mark price", () => {
    expect(getPerpMark(mockPerpData)).toBe(50.0);
  });

  it("should extract beacon address", () => {
    expect(getPerpBeacon(mockPerpData)).toBe("0xbeacon");
  });

  it("should extract bounds", () => {
    expect(getPerpBounds(mockPerpData)).toEqual({
      minMargin: 100,
      minTakerLeverage: 1,
      maxTakerLeverage: 10,
      liquidationTakerRatio: 0.05,
    });
  });

  it("should extract fees", () => {
    expect(getPerpFees(mockPerpData)).toEqual({
      creatorFee: 0.001,
      insuranceFee: 0.002,
      lpFee: 0.003,
      liquidationFee: 0.004,
    });
  });

  it("should extract tick spacing", () => {
    expect(getPerpTickSpacing(mockPerpData)).toBe(60);
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
        liveDetails: {
          pnl: 50.0,
          fundingPayment: 5.0,
          effectiveMargin: 100.0,
          isLiquidatable: false,
        },
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
    liveDetails: {
      pnl: 75.0,
      fundingPayment: 7.5,
      effectiveMargin: 150.0,
      isLiquidatable: false,
    },
  };

  it("should extract position PnL", () => {
    expect(getPositionPnl(mockPositionData)).toBe(75.0);
  });

  it("should extract funding payment", () => {
    expect(getPositionFundingPayment(mockPositionData)).toBe(7.5);
  });

  it("should extract liquidation status", () => {
    expect(getPositionIsLiquidatable(mockPositionData)).toBe(false);
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
  const mockRawData: PositionRawData = {
    perpId: "0x123" as any,
    positionId: 1n,
    margin: 100,
    entryPerpDelta: 2000000n, // 2 perp tokens (1e6)
    entryUsdDelta: 100000000n, // $100 (1e6)
    marginRatios: { min: 100000, max: 500000, liq: 50000 },
  };

  describe("calculateEntryPrice", () => {
    it("should calculate entry price from raw data", () => {
      const entryPrice = calculateEntryPrice(mockRawData);
      // 100000000 / 2000000 = 50
      expect(entryPrice).toBe(50);
    });

    it("should be a function", () => {
      expect(typeof calculateEntryPrice).toBe("function");
    });
  });

  describe("calculatePositionSize", () => {
    it("should calculate position size from raw data", () => {
      const size = calculatePositionSize(mockRawData);
      // 2000000 / 1e6 = 2
      expect(size).toBe(2);
    });

    it("should be a function", () => {
      expect(typeof calculatePositionSize).toBe("function");
    });
  });

  describe("calculatePositionValue", () => {
    it("should calculate position value with mark price", () => {
      const markPrice = 60;
      const value = calculatePositionValue(mockRawData, markPrice);
      // abs(2) * 60 = 120
      expect(value).toBe(120);
    });

    it("should be a function", () => {
      expect(typeof calculatePositionValue).toBe("function");
    });
  });

  describe("calculateLeverage", () => {
    it("should calculate leverage from value and margin", () => {
      const positionValue = 500;
      const effectiveMargin = 100;
      const leverage = calculateLeverage(positionValue, effectiveMargin);
      expect(leverage).toBe(5);
    });

    it("should be a function", () => {
      expect(typeof calculateLeverage).toBe("function");
    });
  });

  describe("calculateLiquidationPrice", () => {
    it("should calculate liquidation price for position", () => {
      const liqPrice = calculateLiquidationPrice(mockRawData, true);
      expect(liqPrice).not.toBeNull();
      expect(typeof liqPrice).toBe("number");
    });

    it("should be a function", () => {
      expect(typeof calculateLiquidationPrice).toBe("function");
    });
  });
});
