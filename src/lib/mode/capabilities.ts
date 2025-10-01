import type { Variant } from './types';

/**
 * Capability derivation - single source of truth for all permissions
 * 
 * Each capability is derived from:
 * - variant: 'agency' | 'client'
 * - isOwner: boolean (from membership.role)
 * 
 * To add a new capability:
 * 1. Add it to this object with derivation logic
 * 2. TypeScript will automatically infer the type
 */
export function deriveCapabilities(variant: Variant, isOwner: boolean) {
  const isAgency = variant === 'agency';
  const isClient = variant === 'client';

  return {
    // Nav / IA
    canSeeClients: isAgency,
    canSeeAgencies: isClient,

    // Requests
    canViewAllRequests: isAgency,
    canSubmitRequests: isClient,
    canAssignRequests: isAgency && isOwner,
    canCloseRequests: isAgency && isOwner,

    // Tasks
    canViewAllTasks: isAgency,
    canCreateTasks: isAgency && isOwner,
    canAssignTasks: isAgency && isOwner,
    canViewOwnTasks: true,

    // Budgets/Billing
    canSeeBudgets: isOwner,
    canManageBilling: isAgency && isOwner,

    // People
    canInviteMembers: isOwner,
    canManageMembers: isOwner,

    // Connections
    canManageConnections: isOwner,
  } as const;
}

// Infer the Capabilities type from the return value
export type Capabilities = ReturnType<typeof deriveCapabilities>;

