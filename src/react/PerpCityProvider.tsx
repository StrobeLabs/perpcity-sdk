import React, { createContext, useContext, ReactNode } from 'react';
import { PerpCityContext, PerpCityContextConfig } from '../context';
import { PerpManager } from '../entities/perp-manager';
import { Perp } from '../entities/perp';
import { Position } from '../entities/position';

// Context type
interface PerpCityContextValue {
  context: PerpCityContext;
  perpManager: PerpManager;
}

// Create the context
const PerpCityContext = createContext<PerpCityContextValue | null>(null);

// Provider component
interface PerpCityProviderProps {
  config: PerpCityContextConfig;
  children: ReactNode;
}

export function PerpCityProvider({ config, children }: PerpCityProviderProps) {
  const context = new PerpCityContext(config);
  const perpManager = new PerpManager(context);

  const value: PerpCityContextValue = {
    context,
    perpManager,
  };

  return (
    <PerpCityContext.Provider value={value}>
      {children}
    </PerpCityContext.Provider>
  );
}

// Hook to use the context
export function usePerpCity() {
  const context = useContext(PerpCityContext);
  if (!context) {
    throw new Error('usePerpCity must be used within a PerpCityProvider');
  }
  return context;
}

// Convenience hooks for common operations
export function usePerpManager() {
  const { perpManager } = usePerpCity();
  return perpManager;
}

export function usePerp(id: string) {
  const { context } = usePerpCity();
  return new Perp(context, id as `0x${string}`);
}

export function usePosition(perpId: string, positionId: bigint) {
  const { context } = usePerpCity();
  return new Position(context, perpId as `0x${string}`, positionId);
}
