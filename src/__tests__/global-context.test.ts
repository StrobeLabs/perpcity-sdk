import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GlobalPerpCityContext } from '../context/global-context';
import { PerpCityContext } from '../context';
import { Hex } from 'viem';

// Mock the dependencies
vi.mock('graphql-request', () => ({
  GraphQLClient: vi.fn().mockImplementation(() => ({
    request: vi.fn(),
  })),
}));

vi.mock('../context', () => ({
  PerpCityContext: vi.fn(),
}));

vi.mock('../utils', () => ({
  scaleFrom6Decimals: vi.fn((x) => x / 1e6),
  sqrtPriceX96ToPrice: vi.fn((x) => Number(x) / 1e18),
  marginRatioToLeverage: vi.fn((x) => 1 / Number(x)),
}));

vi.mock('../abis/perp-manager', () => ({
  PERP_MANAGER_ABI: [],
}));

vi.mock('viem', () => ({
  erc20Abi: [],
}));

describe('GlobalPerpCityContext', () => {
  let mockContext: PerpCityContext;
  let globalContext: GlobalPerpCityContext;
  let mockPerpId: Hex;

  beforeEach(() => {
    mockContext = {
      walletClient: {
        readContract: vi.fn(),
        simulateContract: vi.fn(),
        writeContract: vi.fn(),
        account: { address: '0x123' as Hex },
        extend: vi.fn(),
      },
      goldskyClient: {
        request: vi.fn(),
      },
      deployments: vi.fn(() => ({
        perpManager: '0xperpManager',
        usdc: '0xusdc',
      })),
    } as any;

    globalContext = new GlobalPerpCityContext(mockContext);
    mockPerpId = '0x7a6f376ed26ed212e84ab8b3bec9df5b9c8d1ca543f0527c48675131a4bf9bae' as Hex;
  });

  describe('getPerpData', () => {
    it('should fetch and return complete perp data', async () => {
      // Mock GraphQL responses
      const mockPerpResponse = {
        perp: {
          beacon: { id: '0xbeacon' as Hex }
        },
        perpSnapshots: [
          {
            timestamp: BigInt(1000),
            markPrice: '50000000',
            takerLongNotional: '1000000',
            takerShortNotional: '2000000',
            fundingRate: '100',
          }
        ]
      };

      const mockBeaconResponse = {
        beaconSnapshots: [
          {
            timestamp: BigInt(1000),
            indexPrice: '50000000',
          }
        ]
      };

      const mockContractData = {
        tickSpacing: 60,
        mark: 50.0,
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

      // Mock the GraphQL client requests
      (mockContext.goldskyClient.request as any)
        .mockResolvedValueOnce(mockPerpResponse)
        .mockResolvedValueOnce(mockBeaconResponse);

      // Mock contract reads
      (mockContext.walletClient.readContract as any)
        .mockResolvedValueOnce(60) // tickSpacing
        .mockResolvedValueOnce(BigInt('50000000000000000000000')) // sqrtPriceX96
        .mockResolvedValueOnce([100, 0, 0, 0, 1000, 100]) // bounds
        .mockResolvedValueOnce([1000, 2000, 3000, 4000]); // fees

      const result = await globalContext.getPerpData(mockPerpId);

      expect(result).toEqual({
        id: mockPerpId,
        tickSpacing: 60,
        mark: 49999.99999999999, // Mock sqrtPriceX96ToPrice result
        index: 50000000, // Raw value from mock
        beacon: '0xbeacon',
        lastIndexUpdate: 1000,
        openInterest: {
          takerLongNotional: 1000000, // Raw value from mock
          takerShortNotional: 2000000, // Raw value from mock
        },
        markTimeSeries: [{
          timestamp: 1000,
          value: 50000000, // Raw value from mock
        }],
        indexTimeSeries: [{
          timestamp: 1000,
          value: 50000000, // Raw value from mock
        }],
        fundingRate: 100, // Raw value from mock
        bounds: {
          minMargin: 100,
          minTakerLeverage: 0.01, // Mock marginRatioToLeverage result
          maxTakerLeverage: 0.001, // Mock marginRatioToLeverage result
        },
        fees: {
          creatorFee: 0.001,
          insuranceFee: 0.002,
          lpFee: 0.003,
          liquidationFee: 0.004,
        },
        openInterestTimeSeries: [{
          timestamp: 1000,
          value: {
            takerLongNotional: 1000000, // Raw value from mock
            takerShortNotional: 2000000, // Raw value from mock
          },
        }],
        fundingRateTimeSeries: [{
          timestamp: 1000,
          value: 100, // Raw value from mock
        }],
        totalOpenMakerPnl: 0,
        totalOpenTakerPnl: 0,
      });
    });
  });

  describe('getUserData', () => {
    it('should fetch and return complete user data', async () => {
      const mockWalletAddress = '0xuser' as Hex;

      const mockUsdcBalance = BigInt('1000000000'); // 1000 USDC
      
      const mockOpenPositions = [
        {
          perp: { id: mockPerpId },
          inContractPosId: BigInt(1),
          isLong: true,
          isMaker: false,
        }
      ];

      const mockClosedPositions = [
        {
          perp: { id: mockPerpId },
          wasMaker: false,
          wasLong: true,
          pnlAtClose: '1000000', // 1 USDC
        }
      ];

      const mockLiveDetails = {
        pnl: 50.0,
        fundingPayment: 5.0,
        effectiveMargin: 100.0,
        isLiquidatable: false,
      };

      // Mock contract reads
      (mockContext.walletClient.readContract as any)
        .mockResolvedValueOnce(mockUsdcBalance);

      // Mock GraphQL requests
      (mockContext.goldskyClient.request as any)
        .mockResolvedValueOnce({ openPositions: mockOpenPositions })
        .mockResolvedValueOnce({ closedPositions: mockClosedPositions });

      // Mock position live details
      (mockContext.walletClient.simulateContract as any)
        .mockResolvedValueOnce({
          result: [50000000, 5000000, 100000000, false]
        });

      const result = await globalContext.getUserData(mockWalletAddress);

      expect(result).toEqual({
        walletAddress: mockWalletAddress,
        usdcBalance: 1000.0,
        openPositions: [{
          perpId: mockPerpId,
          positionId: BigInt(1),
          isLong: true,
          isMaker: false,
          liveDetails: mockLiveDetails,
        }],
        closedPositions: [{
          perpId: mockPerpId,
          wasMaker: false,
          wasLong: true,
          pnlAtClose: 1000000, // Raw value from mock
        }],
        realizedPnl: 1000000, // Raw value from mock
        unrealizedPnl: 45.0, // 50 - 5
      });
    });
  });

  describe('getOpenPositionData', () => {
    it('should fetch and return position data with live details', async () => {
      const mockPositionId = BigInt(1);
      const mockLiveDetails = {
        pnl: 25.0,
        fundingPayment: 2.5,
        effectiveMargin: 50.0,
        isLiquidatable: false,
      };

      (mockContext.walletClient.simulateContract as any)
        .mockResolvedValueOnce({
          result: [25000000, 2500000, 50000000, false]
        });

      const result = await globalContext.getOpenPositionData(mockPerpId, mockPositionId);

      expect(result).toEqual({
        perpId: mockPerpId,
        positionId: mockPositionId,
        liveDetails: {
          pnl: 25.0,
          fundingPayment: 2.5,
          effectiveMargin: 50.0,
          isLiquidatable: false,
        },
      });
    });
  });

  describe('getMultiplePerpData', () => {
    it('should fetch multiple perp data in parallel', async () => {
      const perpIds = [mockPerpId, '0xanother' as Hex];
      
      // Mock the same response for both calls
      const mockResponse = {
        perp: { beacon: { id: '0xbeacon' as Hex } },
        perpSnapshots: [{
          timestamp: BigInt(1000),
          markPrice: '50000000',
          takerLongNotional: '1000000',
          takerShortNotional: '2000000',
          fundingRate: '100',
        }]
      };

      (mockContext.goldskyClient.request as any)
        .mockResolvedValueOnce(mockResponse)
        .mockResolvedValueOnce(mockResponse) // Second call for second perp
        .mockResolvedValueOnce({
          beaconSnapshots: [{
            timestamp: BigInt(1000),
            indexPrice: '50000000',
          }]
        })
        .mockResolvedValueOnce({
          beaconSnapshots: [{
            timestamp: BigInt(1000),
            indexPrice: '50000000',
          }]
        });

      (mockContext.walletClient.readContract as any)
        .mockResolvedValue(60)
        .mockResolvedValue(BigInt('50000000000000000000000'))
        .mockResolvedValue([100, 0, 0, 0, 1000, 100])
        .mockResolvedValue([1000, 2000, 3000, 4000]);

      const results = await globalContext.getMultiplePerpData(perpIds);

      expect(results).toHaveLength(2);
      expect(results[0].id).toBe(mockPerpId);
      expect(results[1].id).toBe('0xanother');
    });
  });
});
