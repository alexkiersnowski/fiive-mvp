'use client'

import { createContext, useContext, useState, useEffect, Dispatch, SetStateAction } from 'react';
import type { EnhancedModeContext } from '@/lib/mode/getActiveContext';
import type { ConnectionSnapshot } from './types';

interface ConnectionContextValue {
  snapshot: ConnectionSnapshot;
  context: EnhancedModeContext;
  isEmpty: boolean;
  setIsEmpty: Dispatch<SetStateAction<boolean>>;
  newRequestsCount: number | undefined;
  setNewRequestsCount: Dispatch<SetStateAction<number | undefined>>;
}

const ConnectionContext = createContext<ConnectionContextValue | null>(null);

export function ConnectionProvider({ 
  snapshot, 
  context, 
  children 
}: { snapshot: ConnectionSnapshot; context: EnhancedModeContext; children: React.ReactNode }) {
  const [isEmpty, setIsEmpty] = useState(false);
  const [newRequestsCount, setNewRequestsCount] = useState(snapshot.newRequestsCount);
  
  // Sync newRequestsCount with snapshot when it changes (e.g., on navigation)
  // Always sync from snapshot on mount and when snapshot changes
  useEffect(() => {
    if (snapshot.newRequestsCount !== undefined) {
      setNewRequestsCount(snapshot.newRequestsCount);
    }
  }, [snapshot.newRequestsCount]);
  
  return (
    <ConnectionContext.Provider value={{ snapshot, context, isEmpty, setIsEmpty, newRequestsCount, setNewRequestsCount }}>
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

