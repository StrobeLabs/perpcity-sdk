import { useState, useEffect, useCallback } from 'react';
import { usePerpCity, usePerpManager, usePerp } from './PerpCityProvider';
import { Perp, Position } from '../entities';
import type { CreatePerpParams, OpenMakerPositionParams, OpenTakerPositionParams } from '../entities/perp';

// Hook for managing perps collection
export function usePerps() {
  const perpManager = usePerpManager();
  const [perps, setPerps] = useState<Perp[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchPerps = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const perpCollection = await perpManager.getPerps();
      setPerps(perpCollection.perps);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch perps'));
    } finally {
      setLoading(false);
    }
  }, [perpManager]);

  useEffect(() => {
    fetchPerps();
  }, [fetchPerps]);

  return {
    perps,
    loading,
    error,
    refetch: fetchPerps,
  };
}

// Hook for creating a new perp
export function useCreatePerp() {
  const perpManager = usePerpManager();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const createPerp = useCallback(async (params: CreatePerpParams) => {
    try {
      setLoading(true);
      setError(null);
      const perp = await perpManager.createPerp(params);
      return perp;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to create perp');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [perpManager]);

  return {
    createPerp,
    loading,
    error,
  };
}

// Hook for perp operations
export function usePerpOperations(perpId: string) {
  const perp = usePerp(perpId);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const openMakerPosition = useCallback(async (params: OpenMakerPositionParams) => {
    try {
      setLoading(true);
      setError(null);
      const position = await perp.approveAndOpenMakerPosition(params);
      return position;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to open maker position');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [perp]);

  const openTakerPosition = useCallback(async (params: OpenTakerPositionParams) => {
    try {
      setLoading(true);
      setError(null);
      const position = await perp.approveAndOpenTakerPosition(params);
      return position;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to open taker position');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [perp]);

  const getTickSpacing = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      return await perp.getTickSpacing();
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to get tick spacing');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [perp]);

  return {
    perp,
    openMakerPosition,
    openTakerPosition,
    getTickSpacing,
    loading,
    error,
  };
}

// Hook for position operations
export function usePositionOperations(perpId: string, positionId: bigint) {
  const { context } = usePerpCity();
  const position = new Position(context, perpId as `0x${string}`, positionId);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const closePosition = useCallback(async (params: { minAmt0Out: number; minAmt1Out: number; maxAmt1In: number }) => {
    try {
      setLoading(true);
      setError(null);
      const result = await position.closePosition(params);
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to close position');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [position]);

  return {
    position,
    closePosition,
    loading,
    error,
  };
}
