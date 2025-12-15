'use server'

import { createClient } from '@/lib/supabase/server'

/**
 * Determines if a billing status is a workspace-limited plan
 * MVP: Only 'free' is limited. Can extend for Starter+ tiers later.
 */
export async function isWorkspaceLimitedPlan(billingStatus: string): Promise<boolean> {
  return billingStatus === "free"; // MVP only - can extend for Starter+ tiers later
}

/**
 * Fetches the first internal connection ID for an agency (by created_at)
 */
async function getFirstInternalConnectionId(agencyId: string): Promise<string | null> {
  const supabase = await createClient();
  
  const { data } = await supabase
    .from('connections')
    .select('id')
    .eq('agency_id', agencyId)
    .eq('connection_status', 'internal')
    .order('created_at', { ascending: true })
    .limit(1)
    .single();
  
  return data?.id || null;
}

/**
 * Fetches the first connected connection ID for an agency (by created_at)
 */
async function getFirstConnectedConnectionId(agencyId: string): Promise<string | null> {
  const supabase = await createClient();
  
  const { data } = await supabase
    .from('connections')
    .select('id')
    .eq('agency_id', agencyId)
    .eq('connection_status', 'connected')
    .order('created_at', { ascending: true })
    .limit(1)
    .single();
  
  return data?.id || null;
}

/**
 * Checks if an agency can access a specific client workspace.
 * Throws an error if access is blocked (caller handles redirect).
 * Returns void if access is allowed.
 * 
 * Rules:
 * - Non-limited plans (paid) → always allowed
 * - Limited plans (free) → allow first internal AND first connected (by created_at)
 */
export async function checkWorkspaceAccessOrThrow({
  agencyId,
  connectionId,
  billingStatus,
}: {
  agencyId: string;
  connectionId: string;
  billingStatus: string;
}) {
  if (!(await isWorkspaceLimitedPlan(billingStatus))) return;

  const [firstInternal, firstConnected] = await Promise.all([
    getFirstInternalConnectionId(agencyId),
    getFirstConnectedConnectionId(agencyId),
  ]);

  const allowedIds: string[] = [];
  if (firstInternal) allowedIds.push(firstInternal);
  if (firstConnected) allowedIds.push(firstConnected);

  if (!allowedIds.includes(connectionId)) {
    throw new Error("workspace_limit");
  }
}

/**
 * Returns allowed connection IDs for an agency
 * Used by ClientsContent to pass down to ClientsTable for client-side checks
 * 
 * Returns:
 * - null if no limit (paid plans)
 * - Array of allowed connection IDs (first internal + first connected)
 */
export async function getAllowedConnectionIds(agencyId: string, billingStatus: string): Promise<string[] | null> {
  if (!(await isWorkspaceLimitedPlan(billingStatus))) {
    return null; // No limit for paid plans
  }

  const [firstInternal, firstConnected] = await Promise.all([
    getFirstInternalConnectionId(agencyId),
    getFirstConnectedConnectionId(agencyId),
  ]);

  const allowedIds: string[] = [];
  if (firstInternal) allowedIds.push(firstInternal);
  if (firstConnected) allowedIds.push(firstConnected);

  return allowedIds;
}

