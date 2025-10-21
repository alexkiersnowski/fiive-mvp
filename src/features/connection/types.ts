import { z } from 'zod';
import type { EnhancedModeContext } from '@/lib/mode/getActiveContext';

// Connection workspace types
export type ConnectionWorkspace = {
  connection: {
    id: string;
    status: string;
    health: string;
    contractEnd?: string;
    accountManager: {
      name: string;
      avatar?: string;
    };
  };
  client: {
    id: string;
    name: string;
    logo?: string;
  };
};

export type AgencyConnectionWorkspace = {
  connection: {
    id: string;
    status: string;
    accountManager: {
      name: string;
      avatar?: string;
    };
  };
  agency: {
    id: string;
    name: string;
    logo?: string;
    industry?: string;
  };
};

// Unified connection snapshot type
export type ConnectionSnapshot = {
  connection: {
    id: string;
    status: string;
    engagementStatus?: string | null;
    health?: string;
    contractEnd?: string;
    contractValue?: string | null;
    accountManager: {
      name: string;
      avatar?: string;
    };
  };
  partner: {
    id: string;
    name: string;
    logo?: string;
    description?: string;
    website?: string;
    industry?: string;
    type: 'agency' | 'client';
  };
  agency: {
    id: string;
    currencyCode: 'EUR' | 'USD' | 'GBP';
  };
  currentUserType: 'agency' | 'client';
};

// Card configuration type (following home pattern)
export type CardConfig = {
  key: string;
  Component: React.ComponentType<{
    snapshot: ConnectionSnapshot;
    context: EnhancedModeContext;
  }>;
};
