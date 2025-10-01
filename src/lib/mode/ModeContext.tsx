'use client';

import { createContext, useContext } from 'react';
import type { ModeContext as ModeContextType } from './types';

const ModeContext = createContext<ModeContextType | null>(null);

export const useMode = () => {
  const context = useContext(ModeContext);
  if (!context) {
    throw new Error('useMode must be used within a ModeProvider');
  }
  return context;
};

export function ModeProvider({ 
  value, 
  children 
}: { 
  value: ModeContextType; 
  children: React.ReactNode;
}) {
  return (
    <ModeContext.Provider value={value}>
      {children}
    </ModeContext.Provider>
  );
}

