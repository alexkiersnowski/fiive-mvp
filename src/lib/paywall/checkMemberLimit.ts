'use server'

import { createClient } from '@/lib/supabase/server'

export interface MemberLimitCheckResult {
  allowed: boolean
  reason?: 'member_limit'
}

/**
 * Count organization members (includes owner)
 * Counts all memberships for an organization
 */
export async function countOrganizationMembers(organizationId: string): Promise<number> {
  const supabase = await createClient()
  
  const { count, error } = await supabase
    .from('memberships')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', organizationId)

  if (error) {
    console.error('Error counting organization members:', error)
    return 0
  }

  return count || 0
}

/**
 * Count pending organization invitations
 * Counts all pending (non-expired) invitations for an organization
 */
export async function countOrganizationInvitations(organizationId: string): Promise<number> {
  const supabase = await createClient()
  
  const now = new Date().toISOString()
  
  const { count, error } = await supabase
    .from('membership_invitations')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', organizationId)
    .eq('status', 'pending')
    .gt('expires_at', now) // Only count non-expired invitations

  if (error) {
    console.error('Error counting organization invitations:', error)
    return 0
  }

  return count || 0
}

/**
 * Check if organization can invite more members based on billing status and organization type
 * 
 * Rules:
 * - Client organizations → always allowed (no limits)
 * - Paid agency organizations → always allowed
 * - Free agency organizations → allow only if (members + invitations) < 2
 * 
 * Note: Owner is included in the member count (they have a membership)
 */
export async function checkMemberLimit({
  organizationId,
  billingStatus,
  organizationType,
}: {
  organizationId: string
  billingStatus: string
  organizationType: 'agency' | 'client'
}): Promise<MemberLimitCheckResult> {
  // Client organizations → always allowed (no member limits)
  if (organizationType === 'client') {
    return { allowed: true }
  }

  // Paid agency organizations → always allowed
  if (billingStatus !== 'free') {
    return { allowed: true }
  }

  // For free agency organizations, check if limit reached
  const [memberCount, invitationCount] = await Promise.all([
    countOrganizationMembers(organizationId),
    countOrganizationInvitations(organizationId),
  ])

  const totalCount = memberCount + invitationCount

  // Free agency organizations limited to 2 members total (including owner)
  if (totalCount >= 2) {
    return { allowed: false, reason: 'member_limit' }
  }

  return { allowed: true }
}

