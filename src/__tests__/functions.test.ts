import { describe, it, expect } from 'vitest';
import {
  getPerpMark,
  getPerpIndex,
  getPerpBeacon,
  getPerpOpenInterest,
  getPerpBounds,
  getPerpFees,
  getPerpFundingRate,
  getPerpMarkTimeSeries,
  getPerpIndexTimeSeries,
  getPerpOpenInterestTimeSeries,
  getPerpFundingRateTimeSeries,
  getPerpTickSpacing
} from '../functions/perp';
import {
  getUserUsdcBalance,
  getUserOpenPositions,
  getUserRealizedPnl,
  getUserUnrealizedPnl
} from '../functions/user';
import {
  getPositionPnl,
  getPositionFundingPayment,
  getPositionIsLiquidatable
} from '../functions/position';
import { openTakerPosition, openMakerPosition } from '../functions/perp-manager';
import { PerpData, UserData, OpenPositionData } from '../types/entity-data';

describe('Perp Functions', () => {
  const mockPerpData: PerpData = {
    id: '0x123' as any,
    tickSpacing: 60,
    mark: 50.0,
    index: 49.5,
    beacon: '0xbeacon',
    lastIndexUpdate: 1000,
    openInterest: {
      takerLongNotional: 1000,
      takerShortNotional: 500,
    },
    markTimeSeries: [],
    indexTimeSeries: [],
    fundingRate: 0.001,
    bounds: {
      minMargin: 100,
      minTakerLeverage: 1,
      maxTakerLeverage: 10,
    },
    fees: {
      creatorFee: 0.001,
      insuranceFee: 0.002,
      lpFee: 0.003,
      liquidationFee: 0.004,
    },
    openInterestTimeSeries: [],
    fundingRateTimeSeries: [],
    totalOpenMakerPnl: 0,
    totalOpenTakerPnl: 0,
  };

  it('should extract mark price', () => {
    expect(getPerpMark(mockPerpData)).toBe(50.0);
  });

  it('should extract index price', () => {
    expect(getPerpIndex(mockPerpData)).toBe(49.5);
  });

  it('should extract beacon address', () => {
    expect(getPerpBeacon(mockPerpData)).toBe('0xbeacon');
  });

  it('should extract open interest', () => {
    expect(getPerpOpenInterest(mockPerpData)).toEqual({
      takerLongNotional: 1000,
      takerShortNotional: 500,
    });
  });

  it('should extract bounds', () => {
    expect(getPerpBounds(mockPerpData)).toEqual({
      minMargin: 100,
      minTakerLeverage: 1,
      maxTakerLeverage: 10,
    });
  });

  it('should extract fees', () => {
    expect(getPerpFees(mockPerpData)).toEqual({
      creatorFee: 0.001,
      insuranceFee: 0.002,
      lpFee: 0.003,
      liquidationFee: 0.004,
    });
  });

  it('should extract funding rate', () => {
    expect(getPerpFundingRate(mockPerpData)).toBe(0.001);
  });

  it('should extract tick spacing', () => {
    expect(getPerpTickSpacing(mockPerpData)).toBe(60);
  });

  it('should extract mark time series', () => {
    expect(getPerpMarkTimeSeries(mockPerpData)).toEqual([]);
  });

  it('should extract index time series', () => {
    expect(getPerpIndexTimeSeries(mockPerpData)).toEqual([]);
  });

  it('should extract open interest time series', () => {
    expect(getPerpOpenInterestTimeSeries(mockPerpData)).toEqual([]);
  });

  it('should extract funding rate time series', () => {
    expect(getPerpFundingRateTimeSeries(mockPerpData)).toEqual([]);
  });
});

describe('User Functions', () => {
  const mockUserData: UserData = {
    walletAddress: '0xuser' as any,
    usdcBalance: 1000.0,
    openPositions: [
      {
        perpId: '0x123' as any,
        positionId: BigInt(1),
        isLong: true,
        isMaker: false,
        liveDetails: {
          pnl: 50.0,
          fundingPayment: 5.0,
          effectiveMargin: 100.0,
          isLiquidatable: false,
        },
      }
    ],
    closedPositions: [
      {
        perpId: '0x123' as any,
        wasMaker: false,
        wasLong: true,
        pnlAtClose: 25.0,
      }
    ],
    realizedPnl: 25.0,
    unrealizedPnl: 45.0,
  };

  it('should extract USDC balance', () => {
    expect(getUserUsdcBalance(mockUserData)).toBe(1000.0);
  });

  it('should extract open positions', () => {
    const positions = getUserOpenPositions(mockUserData);
    expect(positions).toHaveLength(1);
    expect(positions[0].perpId).toBe('0x123');
    expect(positions[0].positionId).toBe(BigInt(1));
  });

  it('should extract realized PnL', () => {
    expect(getUserRealizedPnl(mockUserData)).toBe(25.0);
  });

  it('should extract unrealized PnL', () => {
    expect(getUserUnrealizedPnl(mockUserData)).toBe(45.0);
  });
});

describe('Position Functions', () => {
  const mockPositionData: OpenPositionData = {
    perpId: '0x123' as any,
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

  it('should extract position PnL', () => {
    expect(getPositionPnl(mockPositionData)).toBe(75.0);
  });

  it('should extract funding payment', () => {
    expect(getPositionFundingPayment(mockPositionData)).toBe(7.5);
  });

  it('should extract liquidation status', () => {
    expect(getPositionIsLiquidatable(mockPositionData)).toBe(false);
  });
});

describe('Position Opening Functions', () => {
  it('openTakerPosition should be a function', () => {
    expect(typeof openTakerPosition).toBe('function');
  });

  it('openMakerPosition should be a function', () => {
    expect(typeof openMakerPosition).toBe('function');
  });

  it('openTakerPosition should have correct signature', () => {
    expect(openTakerPosition.length).toBe(3); // context, perpId, params
  });

  it('openMakerPosition should have correct signature', () => {
    expect(openMakerPosition.length).toBe(3); // context, perpId, params
  });
});
