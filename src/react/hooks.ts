import { useState, useEffect, useCallback } from 'react';
import { usePerpCity } from './context';
import { Perp, CreatePerpParams, OpenMakerPositionParams, OpenTakerPositionParams, ClosePositionParams, Position } from '../index';

// Data fetching hooks
export function usePerps() {
  const { perpManager } = usePerpCity();
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
      const error = err instanceof Error ? err : new Error('Failed to fetch perps');
      setError(error);
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

export function useCreatePerp() {
  const { perpManager } = usePerpCity();
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

// Action hooks
export function usePerpOperations(perpId: string) {
  const { context } = usePerpCity();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const perp = new Perp(context, perpId as `0x${string}`);

  const openMakerPosition = useCallback(async (params: OpenMakerPositionParams) => {
    try {
      setLoading(true);
      setError(null);
      const position = await perp.openMakerPosition(params);
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
      const position = await perp.openTakerPosition(params);
      return position;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to open taker position');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [perp]);

  const approveAndOpenMakerPosition = useCallback(async (params: OpenMakerPositionParams) => {
    try {
      setLoading(true);
      setError(null);
      const position = await perp.approveAndOpenMakerPosition(params);
      return position;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to approve and open maker position');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [perp]);

  const approveAndOpenTakerPosition = useCallback(async (params: OpenTakerPositionParams) => {
    try {
      setLoading(true);
      setError(null);
      const position = await perp.approveAndOpenTakerPosition(params);
      return position;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to approve and open taker position');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [perp]);

  return {
    openMakerPosition,
    openTakerPosition,
    approveAndOpenMakerPosition,
    approveAndOpenTakerPosition,
    loading,
    error,
  };
}

export function usePositionOperations(perpId: string, positionId: bigint) {
  const { context } = usePerpCity();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const position = new Position(context, perpId as `0x${string}`, positionId);

  const closePosition = useCallback(async (params: ClosePositionParams) => {
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
    closePosition,
    loading,
    error,
  };
}
