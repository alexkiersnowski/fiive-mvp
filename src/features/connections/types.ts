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
    isDraft: boolean;
    engagementStatus?: string | null;
    health?: string;
    contractEnd?: string;
    contractValue?: string | null;
    invitedEmail?: string | null;
    accountManager: {
      name: string;
      avatar?: string;
    };
    clientPrimaryContact?: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      avatarUrl?: string;
      jobTitle?: string;
    } | null;
    agencyPrimaryContact?: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      avatarUrl?: string;
      jobTitle?: string;
    } | null;
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
    name: string;
    logo?: string;
    currencyCode: 'EUR' | 'USD' | 'GBP';
  };
  currentUserType: 'agency' | 'client';
  clientMembers: Array<{
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    avatarUrl?: string;
    jobTitle?: string;
  }>;
  agencyMembers: Array<{
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    avatarUrl?: string;
    jobTitle?: string;
  }>;
  newRequestsCount?: number;
  // Client view metrics
  liveProjectsCount?: number;
  nextDeliveryDate?: string | null;
  requestsInReviewCount?: number;
  tasksAssignedCount?: number;
};

// Card configuration type (following home pattern)
export type CardConfig = {
  key: string;
  Component: React.ComponentType<{
    snapshot: ConnectionSnapshot;
    context: EnhancedModeContext;
  }>;
};
