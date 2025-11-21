'use client'

import { createContext, useContext, useState, useEffect, useMemo, Dispatch, SetStateAction } from 'react';
import type { EnhancedModeContext } from '@/lib/mode/getActiveContext';
import type { ConnectionSnapshot } from './types';

interface ConnectionContextValue {
  snapshot: ConnectionSnapshot;
  context: EnhancedModeContext;
  isEmpty: boolean;
  setIsEmpty: Dispatch<SetStateAction<boolean>>;
  newRequestsCount: number | undefined;
  setNewRequestsCount: Dispatch<SetStateAction<number | undefined>>;
  isDisconnected: boolean;
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
  
  // Compute isDisconnected based on connection status
  const isDisconnected = snapshot.connection.status === 'disconnected';
  
  // Memoize context value to prevent unnecessary re-renders
  // Only recreate when snapshot, context, isEmpty, or newRequestsCount actually change
  const contextValue = useMemo(() => ({
    snapshot,
    context,
    isEmpty,
    setIsEmpty,
    newRequestsCount,
    setNewRequestsCount,
    isDisconnected,
  }), [snapshot, context, isEmpty, newRequestsCount, isDisconnected]);
  
  return (
    <ConnectionContext.Provider value={contextValue}>
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

