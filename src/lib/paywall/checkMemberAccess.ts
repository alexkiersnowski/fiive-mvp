'use server'

import { createClient } from '@/lib/supabase/server'

export interface MemberAccessResult {
  hasAccess: boolean
  isRestricted: boolean
}

/**
 * Check if a specific user has access to the organization based on member limit
 * 
 * Rules:
 * - Client organizations → always has access
 * - Paid agency organizations → always has access
 * - Free agency organizations → only first 2 members (by created_at) have access
 * - Owner always has access regardless of position
 * 
 * @param organizationId - The organization ID
 * @param userId - The user ID to check access for
 * @param billingStatus - The organization's billing status
 * @param organizationType - The organization type ('agency' | 'client')
 * @param ownerId - The organization owner's user ID
 */
export async function checkMemberAccess({
  organizationId,
  userId,
  billingStatus,
  organizationType,
  ownerId,
}: {
  organizationId: string
  userId: string
  billingStatus: string
  organizationType: 'agency' | 'client'
  ownerId: string
}): Promise<MemberAccessResult> {
  // Client organizations → always has access
  if (organizationType === 'client') {
    return { hasAccess: true, isRestricted: false }
  }

  // Paid agency organizations → always has access
  if (billingStatus !== 'free') {
    return { hasAccess: true, isRestricted: false }
  }

  // Owner always has access regardless of position
  if (userId === ownerId) {
    return { hasAccess: true, isRestricted: false }
  }

  // For free agency organizations, check if user is the first non-owner member
  // Allowed: Owner (always) + First non-owner member (by created_at) = 2 total
  const supabase = await createClient()

  // Get all memberships ordered by created_at ASC
  const { data: allMemberships, error } = await supabase
    .from('memberships')
    .select('user_id, created_at, id')
    .eq('org_id', organizationId)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true }) // Tiebreaker for same created_at

  if (error) {
    console.error('Error checking member access:', error)
    // Fail open - allow access if we can't determine
    return { hasAccess: true, isRestricted: false }
  }

  if (!allMemberships || allMemberships.length === 0) {
    // No memberships found - should not happen, but allow access
    return { hasAccess: true, isRestricted: false }
  }

  // Find the first non-owner member (by created_at)
  // Owner is always allowed, so we need to find the first member that is NOT the owner
  const firstNonOwnerMember = allMemberships.find(m => m.user_id !== ownerId)

  if (!firstNonOwnerMember) {
    // Only owner exists - allow access (shouldn't happen in practice)
    return { hasAccess: true, isRestricted: false }
  }

  // Allowed users: Owner + First non-owner member
  const allowedUserIds = [ownerId, firstNonOwnerMember.user_id]
  const hasAccess = allowedUserIds.includes(userId)

  return {
    hasAccess,
    isRestricted: !hasAccess,
  }
}

