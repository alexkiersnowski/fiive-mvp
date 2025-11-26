'use server'

import { createClient } from '@/lib/supabase/server'

/**
 * Gets the agency organization ID for the current authenticated user.
 * 
 * Checks if the user is a member of an agency organization (via membership or ownership).
 * Returns the agency organization ID if found, or null if the user is not part of an agency.
 * 
 * @returns Agency organization ID or null if not found/invalid
 */
export async function getAgencyOrgId(): Promise<{ success: true; agencyOrgId: string } | { success: false; error: string }> {
  const supabase = await createClient()

  // Verify the user is authenticated
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return {
      success: false,
      error: 'Unauthorized'
    }
  }

  // Try to get organization via membership first
  const { data: membership, error: membershipError } = await supabase
    .from('memberships')
    .select(`
      id,
      org_id,
      role,
      organizations!inner(
        id,
        type,
        owner_id
      )
    `)
    .eq('user_id', user.id)
    .is('organizations.is_draft', false)
    .single()

  let agencyOrgId: string | null = null

  if (membershipError || !membership) {
    // Try fallback: check if user is owner
    const { data: ownerOrg, error: ownerError } = await supabase
      .from('organizations')
      .select('id, type, owner_id')
      .eq('owner_id', user.id)
      .is('is_draft', false)
      .single()

    if (ownerError || !ownerOrg || ownerOrg.type !== 'agency') {
      return {
        success: false,
        error: 'You must be a member of an agency organization'
      }
    }

    agencyOrgId = ownerOrg.id
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const org = (membership as any).organizations
    if (!org || org.type !== 'agency') {
      return {
        success: false,
        error: 'You must be a member of an agency organization'
      }
    }

    agencyOrgId = org.id
  }

  if (!agencyOrgId) {
    return {
      success: false,
      error: 'Agency organization not found'
    }
  }

  return {
    success: true,
    agencyOrgId
  }
}

