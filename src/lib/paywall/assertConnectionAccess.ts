'use server'

import { checkWorkspaceAccessOrThrow } from './checkWorkspaceAccess'

/**
 * Asserts that an agency can access a specific connection.
 * Throws Error("workspace_limit") if access is blocked.
 * Only checks for agencies (clients don't have connection limits).
 */
export async function assertConnectionAccessOrThrow(
  connectionId: string,
  agencyId: string,
  billingStatus: string
): Promise<void> {
  // Only check for agencies (clients don't have connection limits)
  // We need to determine if this is an agency context - if agencyId is provided, it's an agency
  // For now, we'll check if billingStatus indicates a limited plan
  // The caller should only call this for agency contexts
  
  await checkWorkspaceAccessOrThrow({
    agencyId,
    connectionId,
    billingStatus,
  })
}

