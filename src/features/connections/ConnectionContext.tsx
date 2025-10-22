'use client'

import { createContext, useContext } from 'react';
import type { EnhancedModeContext } from '@/lib/mode/getActiveContext';
import type { ConnectionSnapshot } from './types';

interface ConnectionContextValue {
  snapshot: ConnectionSnapshot;
  context: EnhancedModeContext;
}

const ConnectionContext = createContext<ConnectionContextValue | null>(null);

export function ConnectionProvider({ 
  snapshot, 
  context, 
  children 
}: ConnectionContextValue & { children: React.ReactNode }) {
  return (
    <ConnectionContext.Provider value={{ snapshot, context }}>
      {children}
    </ConnectionContext.Provider>
  );
}

export function useConnection() {
  const value = useContext(ConnectionContext);
  if (!value) {
    throw new Error('useConnection must be used within ConnectionProvider');
  }
  return value;
}

