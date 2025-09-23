import React, { createContext, useContext, ReactNode } from 'react';
import { PerpCityContext as PerpCityContextClass, PerpCityContextConfig, PerpManager } from '../index';

interface PerpCityContextValue {
  context: PerpCityContextClass;
  perpManager: PerpManager;
}

const PerpCityReactContext = createContext<PerpCityContextValue | null>(null);

interface PerpCityProviderProps {
  config: PerpCityContextConfig;
  children: ReactNode;
}

export function PerpCityProvider({ config, children }: PerpCityProviderProps) {
  const context = new PerpCityContextClass(config);
  const perpManager = new PerpManager(context);

  const value: PerpCityContextValue = {
    context,
    perpManager,
  };

  return (
    <PerpCityReactContext.Provider value={value}>
      {children}
    </PerpCityReactContext.Provider>
  );
}

export function usePerpCity() {
  const context = useContext(PerpCityReactContext);
  if (!context) {
    throw new Error('usePerpCity must be used within a PerpCityProvider');
  }
  return context;
}

export function usePerpManager() {
  const { perpManager } = usePerpCity();
  return perpManager;
}
