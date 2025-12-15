'use server'

import { createClient } from '@/lib/supabase/server'

export interface PaywallCheckParams {
  billingStatus: string
  isAgencyInitiated: boolean
  isClientInitiated: boolean
  isInternal?: boolean // True for internal connections (agency creates client)
  internalCount: number
  clientInitiatedCount: number
}

export interface PaywallCheckResult {
  allowed: boolean
  reason?: 'client_limit' | 'agency_initiated_blocked' | 'internal_limit'
}

/**
 * Simple MVP paywall check for free agencies
 * 
 * Rules:
 * - Paid agencies → always allowed
 * - Client-initiated → allow only if <= 1
 * - Agency-initiated → block (free cannot initiate)
 * - Internal → allow only if <= 1
 */
export async function checkPaywall({
  billingStatus,
  isAgencyInitiated,
  isClientInitiated,
  isInternal = false,
  internalCount,
  clientInitiatedCount,
}: PaywallCheckParams): Promise<PaywallCheckResult> {
  // 1. Paid → always allowed
  if (billingStatus !== 'free') {
    return { allowed: true }
  }

  // 2. Client-initiated → allow only if <= 1
  if (isClientInitiated) {
    if (clientInitiatedCount >= 1) {
      return { allowed: false, reason: 'client_limit' }
    }
    return { allowed: true }
  }

  // 3. Internal (agency creates client) → allow only if <= 1
  if (isInternal) {
    if (internalCount >= 1) {
      return { allowed: false, reason: 'internal_limit' }
    }
    return { allowed: true }
  }

  // 4. Agency-initiated (invite/code) → block (free cannot initiate)
  if (isAgencyInitiated) {
    return { allowed: false, reason: 'agency_initiated_blocked' }
  }

  return { allowed: true }
}

/**
 * Count internal connections for an agency
 */
export async function countInternalConnections(agencyId: string): Promise<number> {
  const supabase = await createClient()
  
  const { count, error } = await supabase
    .from('connections')
    .select('id', { count: 'exact', head: true })
    .eq('agency_id', agencyId)
    .eq('connection_status', 'internal')

  if (error) {
    console.error('Error counting internal connections:', error)
    return 0
  }

  return count || 0
}

/**
 * Count client-initiated connections for an agency
 */
export async function countClientInitiatedConnections(agencyId: string): Promise<number> {
  const supabase = await createClient()
  
  // Get all connections for this agency
  const { data: connections, error } = await supabase
    .from('connections')
    .select('client_id, created_by_org_id')
    .eq('agency_id', agencyId)

  if (error) {
    console.error('Error counting client-initiated connections:', error)
    return 0
  }

  if (!connections) {
    return 0
  }

  // Count connections where created_by_org_id matches the client_id (client-initiated)
  return connections.filter(conn => 
    conn.created_by_org_id && 
    conn.client_id && 
    conn.created_by_org_id === conn.client_id
  ).length
}

/**
 * Count client-initiated connections for a specific agency
 * Client-initiated = where created_by_org_id equals the client_id
 * Uses admin client to bypass RLS for server-side validation
 */
export async function countClientInitiatedConnectionsForAgency(agencyId: string): Promise<number> {
  const { createAdminClient } = await import('@/lib/supabase/server');
  const supabase = createAdminClient();
  
  const { data: connections, error } = await supabase
    .from('connections')
    .select('client_id, created_by_org_id')
    .eq('agency_id', agencyId);

  if (error) {
    console.error('Error counting client-initiated connections for agency:', error);
    return 0;
  }

  if (!connections) {
    return 0;
  }

  // Count connections where created_by_org_id matches the client_id (client-initiated)
  return connections.filter(conn => 
    conn.created_by_org_id && 
    conn.client_id && 
    conn.created_by_org_id === conn.client_id
  ).length;
}

