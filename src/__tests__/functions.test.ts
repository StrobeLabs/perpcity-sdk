import { describe, it, expect } from 'vitest';
import {
  getPerpMark,
  getPerpBeacon,
  getPerpBounds,
  getPerpFees,
  getPerpTickSpacing
} from '../functions/perp';
import {
  getUserUsdcBalance,
  getUserOpenPositions,
  getUserWalletAddress
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
    beacon: '0xbeacon',
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
  };

  it('should extract mark price', () => {
    expect(getPerpMark(mockPerpData)).toBe(50.0);
  });

  it('should extract beacon address', () => {
    expect(getPerpBeacon(mockPerpData)).toBe('0xbeacon');
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

  it('should extract tick spacing', () => {
    expect(getPerpTickSpacing(mockPerpData)).toBe(60);
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

  it('should extract wallet address', () => {
    expect(getUserWalletAddress(mockUserData)).toBe('0xuser');
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
