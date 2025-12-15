'use client';

import { createContext, useContext, useEffect } from 'react';
import type { ModeContext as ModeContextType } from './types';

const ModeContext = createContext<ModeContextType | null>(null);

// Simple in-memory cache for context data
let contextCache: { data: ModeContextType; timestamp: number } | null = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export const useMode = () => {
  const context = useContext(ModeContext);
  if (!context) {
    throw new Error('useMode must be used within a ModeProvider');
  }
  return context;
};

// Cache management functions
export const getCachedContext = (): ModeContextType | null => {
  if (!contextCache) return null;
  
  const now = Date.now();
  if (now - contextCache.timestamp > CACHE_DURATION) {
    contextCache = null;
    return null;
  }
  
  return contextCache.data;
};

export const setCachedContext = (data: ModeContextType): void => {
  contextCache = {
    data,
    timestamp: Date.now()
  };
};

export const clearContextCache = (): void => {
  contextCache = null;
};

export function ModeProvider({ 
  value, 
  children 
}: { 
  value: ModeContextType; 
  children: React.ReactNode;
}) {
  // Cache the context data on the client side
  useEffect(() => {
    setCachedContext(value);
  }, [value]);

  return (
    <ModeContext.Provider value={value}>
      {children}
    </ModeContext.Provider>
  );
}

