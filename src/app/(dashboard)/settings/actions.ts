"use server"

import { z } from "zod"
import { revalidatePath } from "next/cache"
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { uploadAvatar, uploadLogo, deleteAvatarFolder, deleteLogoFolder } from '@/lib/supabase/storage'
import { randomBytes, createHash } from 'crypto'
import { escapeForILike } from '@/lib/utils'
import { SITE_URL } from '@/lib/env'

// Rate limiting configuration
const RATE_LIMITS = {
  removeMember: { limit: 5, window: 60 * 1000 }, // 5 per minute
  inviteMembers: { limit: 20, window: 60 * 1000 }, // 20 per minute per org
  // Note: resendInvitation rate limiting is handled per-email via database timestamp check (5 minutes)
  resendInvitation: { limit: 1, window: 60 * 1000 }, // Not used - kept for compatibility
} as const

// In-memory rate limiting store (upgrade to Redis in production)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

// Rate limiting helper function
function checkRateLimit(userId: string, action: keyof typeof RATE_LIMITS, orgId?: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now()
  // For inviteMembers, use orgId instead of userId for per-org rate limiting
  const key = action === 'inviteMembers' && orgId 
    ? `${orgId}:${action}` 
    : `${userId}:${action}`
  const limit = RATE_LIMITS[action]
  
  // Clean up expired entries to prevent memory leaks
  for (const [k, v] of rateLimitStore.entries()) {
    if (now > v.resetTime) {
      rateLimitStore.delete(k)
    }
  }
  
  const current = rateLimitStore.get(key)
  
  if (!current || now > current.resetTime) {
    // First request or window expired
    rateLimitStore.set(key, { count: 1, resetTime: now + limit.window })
    return { allowed: true }
  }
  
  if (current.count >= limit.limit) {
    // Rate limit exceeded
    const retryAfter = Math.ceil((current.resetTime - now) / 1000)
    return { allowed: false, retryAfter }
  }
  
  // Increment counter
  current.count++
  rateLimitStore.set(key, current)
  return { allowed: true }
}

// Helper types and utilities
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ActionResult<T = any> = {
  ok: boolean
  data?: T
  message?: string
  paywall?: boolean
}

// Helper function for organization ownership verification
async function verifyOrganizationOwnership(organizationId: string, userId: string): Promise<ActionResult> {
  const supabase = await createClient()
  
  const { data: organization, error } = await supabase
    .from("organizations")
    .select(`
      id,
      owner_id,
      memberships!inner(user_id, role)
    `)
    .eq("id", organizationId)
    .eq("memberships.user_id", userId)
    .single()

  if (error || !organization) {
    return { ok: false, message: "Organization not found or access denied" }
  }

  if (organization.owner_id !== userId) {
    return { ok: false, message: "Only organization owners can perform this action" }
  }

  return { ok: true, data: organization }
}

// Helper function for organization access verification (any member)
async function verifyOrganizationAccess(organizationId: string, userId: string): Promise<ActionResult> {
  const supabase = await createClient()
  
  const { data: organization, error } = await supabase
    .from("organizations")
    .select(`
      id,
      memberships!inner(user_id)
    `)
    .eq("id", organizationId)
    .eq("memberships.user_id", userId)
    .single()

  if (error || !organization) {
    return { ok: false, message: "Organization not found or access denied" }
  }

  return { ok: true, data: organization }
}

// Helper function for authentication
async function verifyAuth(): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  
  if (error || !user) {
    return { ok: false, message: "Unauthorized" }
  }
  
  return { ok: true, data: user }
}

// Helper function for token generation
function generateInvitationToken() {
  const rawToken = randomBytes(32).toString('hex')
  const tokenHash = createHash('sha256').update(rawToken).digest('hex')
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 7) // 7 days from now
  
  return {
    rawToken,
    tokenHash,
    expiresAt: expiresAt.toISOString()
  }
}

const ProfileSchema = z.object({
  userId: z.string().uuid(),
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().min(1, "Last name is required"),
  job_title: z.string().optional(),
  avatar_file: z.instanceof(File).optional(),
})

export async function updateProfile(data: {
  userId: string
  first_name: string
  last_name: string
  job_title?: string
  avatar_file?: File
}) {
  // Validate input data
  const parsed = ProfileSchema.safeParse(data)
  if (!parsed.success) {
    return { 
      ok: false, 
      errors: parsed.error.flatten().fieldErrors 
    }
  }

  const { userId, avatar_file, ...values } = parsed.data

  const supabase = await createClient()

  // Verify the user is authenticated and matches the userId
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user || user.id !== userId) {
    return { 
      ok: false, 
      message: "Unauthorized" 
    }
  }

  // Prepare update data
  const updateData: {
    first_name: string
    last_name: string
    job_title?: string
    updated_at: string
    avatar_url?: string
  } = {
    first_name: values.first_name,
    last_name: values.last_name,
    job_title: values.job_title,
    updated_at: new Date().toISOString()
  }

  // Handle avatar upload if provided
  if (avatar_file) {
    try {
      const avatarUrl = await uploadAvatar(avatar_file, userId)
      updateData.avatar_url = avatarUrl
    } catch (error) {
      console.error('Avatar upload error:', error)
      return {
        ok: false,
        message: `Avatar upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }

  // Update the profile
  const { error } = await supabase
    .from("profiles")
    .update(updateData)
    .eq("id", userId)

  if (error) {
    console.error('Profile update error:', error)
    return { 
      ok: false, 
      message: error.message 
    }
  }

  // Revalidate the profile page to show fresh data
  revalidatePath("/settings/account/profile")
  
  return { ok: true }
}

const EmailChangeSchema = z.object({
  userId: z.string().uuid(),
  email: z.string().email("Enter a valid email"),
})

export async function requestEmailChange(data: {
  userId: string
  email: string
}) {
  // Validate input data
  const parsed = EmailChangeSchema.safeParse(data)
  if (!parsed.success) {
    return { 
      ok: false, 
      fieldErrors: parsed.error.flatten().fieldErrors 
    }
  }

  const { userId, email } = parsed.data

  const supabase = await createClient()

  // Verify the user is authenticated and matches the userId
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user || user.id !== userId) {
    return { 
      ok: false, 
      message: "Unauthorized" 
    }
  }

  // Check if email is already the current email
  if (user.email === email) {
    return {
      ok: false,
      fieldErrors: {
        email: ["This is already your current email address"]
      }
    }
  }

  // Request email change via Supabase Auth
  const { error } = await supabase.auth.updateUser(
    { email },
    { 
      emailRedirectTo: `${SITE_URL}/auth/callback?next=/settings/account/access` 
    }
  )

  if (error) {
    console.error('Email change request error:', error)
    return { 
      ok: false, 
      message: error.message 
    }
  }

  // Revalidate the access page
  revalidatePath("/settings/account/access")
  
  return { 
    ok: true, 
    pendingEmail: email 
  }
}

const OrganizationSchema = z.object({
  organizationId: z.string().uuid(),
  name: z.string().min(1, "Organization name is required"),
  website: z.string().url("Please enter a valid website URL").optional().or(z.literal("")),
  description: z.string().optional(),
  industry: z.string().min(1, "Industry is required"),
  currency_code: z.string().min(1, "Currency is required").optional(),
  logo_file: z.instanceof(File).optional(),
})

export async function updateOrganizationDetails(data: {
  organizationId: string
  name: string
  website?: string
  description?: string
  industry: string
  currency_code?: string
  logo_file?: File
}) {
  // Validate input data
  const parsed = OrganizationSchema.safeParse(data)
  if (!parsed.success) {
    return { 
      ok: false, 
      errors: parsed.error.flatten().fieldErrors 
    }
  }

  const { organizationId, logo_file, ...values } = parsed.data

  const supabase = await createClient()

  // Verify the user is authenticated
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return { 
      ok: false, 
      message: "Unauthorized" 
    }
  }

  // Verify the user has access to this organization through memberships
  const { data: organization, error: orgError } = await supabase
    .from("organizations")
    .select(`
      id,
      memberships!inner(user_id)
    `)
    .eq("id", organizationId)
    .eq("memberships.user_id", user.id)
    .single()

  if (orgError || !organization) {
    return { 
      ok: false, 
      message: "Organization not found or access denied" 
    }
  }

  // Prepare update data
  const updateData: {
    name: string
    website?: string | null
    description?: string | null
    industry: string
    currency_code?: string
    updated_at: string
    logo_url?: string
  } = {
    name: values.name,
    website: values.website || null,
    description: values.description ? values.description.replace(/\r?\n/g, ' ').trim() || null : null,
    industry: values.industry,
    updated_at: new Date().toISOString()
  }

  // Only include currency_code if it's provided
  if (values.currency_code) {
    updateData.currency_code = values.currency_code
  }

  // Handle logo upload if provided
  if (logo_file) {
    try {
      const logoUrl = await uploadLogo(logo_file, organizationId)
      updateData.logo_url = logoUrl
    } catch (error) {
      console.error('Logo upload error:', error)
      return {
        ok: false,
        message: `Logo upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }

  // Update the organization
  const { error } = await supabase
    .from("organizations")
    .update(updateData)
    .eq("id", organizationId)

  if (error) {
    console.error('Organization update error:', error)
    return { 
      ok: false, 
      message: error.message 
    }
  }

  // Revalidate the organization details page to show fresh data
  revalidatePath("/settings/organization/details")
  
  return { ok: true }
}

export async function signOut() {
  const supabase = await createClient()
  
  const { error } = await supabase.auth.signOut()
  
  if (error) {
    console.error('Sign out error:', error)
    return { 
      ok: false, 
      message: error.message 
    }
  }
  
  return { ok: true }
}

// Delete own account - allows members (not owners) to delete their own account:
// 1. Soft delete profile (deleted_at) - using regular client (user can update own profile)
// 2. Hard delete all memberships - using admin client
// 3. Hard delete all invitations - using admin client
// 4. Hard delete auth.user - using admin client
export async function deleteOwnAccount(data: { email: string }) {
  const supabase = await createClient()

  // Verify the user is authenticated
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return { 
      ok: false, 
      message: "Unauthorized" 
    }
  }

  // Verify provided email matches user's auth email
  if (data.email !== user.email) {
    return { 
      ok: false, 
      message: "Email does not match your account email" 
    }
  }

  // Verify user is NOT an owner (owners cannot delete their own account)
  // Check if user is owner of any organization
  const { data: organizations, error: orgError } = await supabase
    .from("organizations")
    .select("id, owner_id")
    .eq("owner_id", user.id)
    .limit(1)

  if (!orgError && organizations && organizations.length > 0) {
    return { 
      ok: false, 
      message: "Organization owners cannot delete their accounts. Please transfer ownership first or delete the workspace from Plan & billing." 
    }
  }

  try {
    // Get user's email from profile (needed for invitation cleanup)
    const { data: profileEmailData } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", user.id)
      .single()

    // Step 0.5: Delete avatar folder from storage FIRST (before profile is soft-deleted)
    // This is necessary so RLS policy can verify the profile exists and user has permission
    // Storage deletion is best-effort - if it fails, we still proceed with DB deletion
    const avatarStorageResult = await deleteAvatarFolder(user.id)
    if (!avatarStorageResult.success) {
      // Log the error but don't fail the deletion - storage cleanup is best-effort
      console.warn('Failed to delete avatar folder for deleted account:', {
        userId: user.id,
        error: avatarStorageResult.error,
      })
    }

    // Step 1: Soft delete profile using regular client (user can update their own profile via RLS)
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ 
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq("id", user.id)

    if (profileError) {
      console.error('Error soft-deleting profile:', profileError)
      return { 
        ok: false, 
        message: "Failed to delete profile" 
      }
    }

    // Create admin client for operations that need to bypass RLS
    const adminSupabase = createAdminClient()

    // Step 2: Hard delete all memberships for this user using admin client
    const { error: membershipError } = await adminSupabase
      .from("memberships")
      .delete()
      .eq("user_id", user.id)

    if (membershipError) {
      console.error('Error deleting memberships:', membershipError)
      // Attempt to rollback profile soft-deletion
      await supabase
        .from("profiles")
        .update({ 
          deleted_at: null,
          updated_at: new Date().toISOString()
        })
        .eq("id", user.id)
      
      return { 
        ok: false, 
        message: "Failed to delete memberships" 
      }
    }

    // Step 3: Hard delete all invitations for this email across all orgs using admin client
    if (profileEmailData?.email) {
      const { error: invitationError } = await adminSupabase
        .from("membership_invitations")
        .delete()
        .eq("invited_email", profileEmailData.email)
      
      if (invitationError) {
        console.error('Error deleting invitations:', invitationError)
        // Log but don't fail - invitations cleanup is best-effort
      }
    }

    // Step 4: Hard delete auth.user using admin client (requires admin privileges)
    const { error: authError } = await adminSupabase.auth.admin.deleteUser(user.id)

    if (authError) {
      console.error('Error deleting auth user:', authError)
      // Note: Profile is soft-deleted and memberships are removed
      // The user won't be able to sign in, which is acceptable
      // We still proceed to sign out
    }

    // Step 5: Sign out the user after successful deletion
    const { error: signOutError } = await supabase.auth.signOut()
    
    if (signOutError) {
      console.error('Error signing out:', signOutError)
      // Account is deleted, but sign out failed - this is acceptable
    }
    
    return { ok: true }

  } catch (error) {
    console.error('Unexpected error during account deletion:', error)
    return { 
      ok: false, 
      message: "An unexpected error occurred while deleting your account" 
    }
  }
}

// Delete workspace - soft deletes organization and hard deletes all related data
export async function deleteWorkspace(data: { organizationId: string }) {
  const supabase = await createClient()

  // Verify the user is authenticated
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return { 
      ok: false, 
      message: "Unauthorized" 
    }
  }

  try {
    // Step 1: Verify user is owner of the organization
    const { data: organization, error: orgError } = await supabase
      .from("organizations")
      .select("id, owner_id, billing_status, stripe_customer_id, stripe_subscription_id")
      .eq("id", data.organizationId)
      .is("deleted_at", null)
      .single()

    if (orgError || !organization) {
      return { 
        ok: false, 
        message: "Organization not found" 
      }
    }

    if (organization.owner_id !== user.id) {
      return { 
        ok: false, 
        message: "Only the organization owner can delete the workspace" 
      }
    }

    // Step 2: Safety checks - verify no real connections and no billing footprint
    // (These should already be validated in UI, but double-check for safety)
    const { data: realConnections, error: connectionsError } = await supabase
      .from("connections")
      .select("id")
      .in("connection_status", ['invited', 'connected', 'disconnected'])
      .or(`agency_id.eq.${data.organizationId},client_id.eq.${data.organizationId}`)
      .limit(1)

    if (connectionsError) {
      console.error('Error checking for real connections:', connectionsError)
      return { 
        ok: false, 
        message: "Failed to verify workspace deletion eligibility" 
      }
    }

    if (realConnections && realConnections.length > 0) {
      return { 
        ok: false, 
        message: "Cannot delete workspace with active connections. Please contact support." 
      }
    }

    // Check billing footprint
    if (organization.billing_status !== 'free' || organization.stripe_customer_id || organization.stripe_subscription_id) {
      return { 
        ok: false, 
        message: "Cannot delete workspace with billing history. Please contact support." 
      }
    }

    // Step 3: Get all user IDs in the organization (for avatar cleanup and auth.user deletion)
    // Include owner (from organizations.owner_id) and all members (from memberships)
    const { data: memberships, error: membershipsError } = await supabase
      .from("memberships")
      .select("user_id")
      .eq("org_id", data.organizationId)

    if (membershipsError) {
      console.error('Error fetching memberships:', membershipsError)
      return { 
        ok: false, 
        message: "Failed to fetch workspace members" 
      }
    }

    // Get all user IDs from memberships, plus the owner ID
    const membershipUserIds = memberships?.map(m => m.user_id).filter(Boolean) as string[] || []
    const ownerId = organization.owner_id
    
    // Combine owner and members, remove duplicates
    const userIds = Array.from(new Set([ownerId, ...membershipUserIds])).filter(Boolean) as string[]

    // Step 4: Get draft organization IDs created by this workspace (for logo cleanup)
    const { data: draftOrgs, error: draftOrgsError } = await supabase
      .from("organizations")
      .select("id")
      .eq("created_by_org_id", data.organizationId)
      .eq("is_draft", true)

    if (draftOrgsError) {
      console.warn('Error fetching draft organizations:', draftOrgsError)
      // Continue - we'll still try to delete main org logo
    }

    const draftOrgIds = draftOrgs?.map(org => org.id).filter(Boolean) as string[] || []

    // Step 5: Delete organization logo folder from storage (best-effort)
    // Must happen BEFORE organization is soft-deleted so RLS can verify it exists
    const logoStorageResult = await deleteLogoFolder(data.organizationId)
    if (!logoStorageResult.success) {
      console.warn('Failed to delete logo folder for workspace:', {
        organizationId: data.organizationId,
        error: logoStorageResult.error,
      })
      // Continue - storage cleanup is best-effort
    }

    // Step 6: Delete logo folders for all draft organizations (best-effort, in parallel)
    // Must happen BEFORE draft orgs are deleted so RLS can verify they exist
    const draftLogoDeletionPromises = draftOrgIds.map(draftOrgId =>
      deleteLogoFolder(draftOrgId).catch(error => {
        console.warn('Failed to delete logo folder for draft org:', {
          draftOrgId,
          error: error instanceof Error ? error.message : String(error),
        })
        return { success: false, error: String(error) }
      })
    )

    await Promise.all(draftLogoDeletionPromises)
    // Continue even if some logo deletions fail - best-effort cleanup

    // Step 7: Delete avatar folders for all org members (best-effort, in parallel)
    // MVP: 1 user = 1 org, so safe to delete all avatars
    const avatarDeletionPromises = userIds.map(userId => 
      deleteAvatarFolder(userId).catch(error => {
        console.warn('Failed to delete avatar folder for user:', {
          userId,
          error: error instanceof Error ? error.message : String(error),
        })
        return { success: false, error: String(error) }
      })
    )
    
    await Promise.all(avatarDeletionPromises)
    // Continue even if some avatar deletions fail - best-effort cleanup

    // Step 8: Call RPC function to handle database deletions
    const { error: rpcError } = await supabase.rpc('delete_workspace', {
      p_org_id: data.organizationId,
      p_user_id: user.id,
    })

    if (rpcError) {
      console.error('Error deleting workspace via RPC:', rpcError)
      
      // Extract error message
      const errorMessage = 
        (rpcError && ('message' in rpcError ? rpcError.message : undefined)) ||
        (rpcError && ('details' in rpcError ? (rpcError as { details?: string }).details : undefined)) ||
        (rpcError && ('hint' in rpcError ? (rpcError as { hint?: string }).hint : undefined)) ||
        'Failed to delete workspace. Please try again.'

      return { 
        ok: false, 
        message: errorMessage 
      }
    }

    // Step 9: Hard delete all auth.users for org members using admin client
    // MVP: all users belong only to this org, so safe to delete all
    const adminSupabase = createAdminClient()
    const authDeletionPromises = userIds.map(userId =>
      adminSupabase.auth.admin.deleteUser(userId).catch(error => {
        console.error('Error deleting auth user:', {
          userId,
          error: error instanceof Error ? error.message : String(error),
        })
        // Log but continue - membership/profile already deleted
      })
    )

    await Promise.all(authDeletionPromises)
    // Continue even if some auth.user deletions fail - database cleanup is done

    // Step 10: Sign out the current user after successful deletion
    const { error: signOutError } = await supabase.auth.signOut()
    
    if (signOutError) {
      console.error('Error signing out after workspace deletion:', signOutError)
      // Workspace is deleted, but sign out failed - this is acceptable
    }

    // Revalidate paths (though user will be signed out)
    revalidatePath("/settings/organization/details")
    revalidatePath("/home")
    
    return { ok: true }

  } catch (error) {
    console.error('Unexpected error during workspace deletion:', error)
    return { 
      ok: false, 
      message: "An unexpected error occurred while deleting the workspace" 
    }
  }
}

// Member Management Types
export interface OrganizationMember {
  id: string
  membership_id: string
  first_name: string
  last_name: string
  email: string
  job_title?: string
  avatar_url?: string
  role: string
  effective_role: string
  created_at: string
  organization: {
    id: string
    name: string
    logo_url?: string
  }
}

export interface MembershipInvitation {
  id: string
  org_id: string
  invited_by_user: string
  invited_email: string
  role: 'member'
  token_hash: string
  status: 'pending' | 'accepted' | 'expired'
  expires_at: string
  accepted_at?: string
  created_at: string
  updated_at: string
}

export interface OrganizationInvitation {
  id: string
  invited_email: string
  role: 'member'
  status: 'pending'
  created_at: string
  expires_at: string
}

// Get organization members
export async function getOrganizationMembers(
  organizationId: string,
  options: { limit?: number; offset?: number; searchQuery?: string } = {}
): Promise<{
  ok: boolean
  data?: OrganizationMember[]
  hasNextPage?: boolean
  message?: string
}> {
  const { limit = 100, offset = 0, searchQuery = '' } = options
  const supabase = await createClient()

  // Verify the user is authenticated
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return { 
      ok: false, 
      message: "Unauthorized" 
    }
  }

  // Verify the user has access to this organization through memberships
  const { data: organization, error: orgError } = await supabase
    .from("organizations")
    .select(`
      id,
      memberships!inner(user_id)
    `)
    .eq("id", organizationId)
    .eq("memberships.user_id", user.id)
    .single()

  if (orgError || !organization) {
    return { 
      ok: false, 
      message: "Organization not found or access denied" 
    }
  }

  // When searching, filter by org membership FIRST, then search only those profiles
  // This dramatically reduces the search space (e.g., 10-50 profiles vs thousands)
  // Fast with idx_memberships_org_id index, then trigram indexes work on small dataset
  let matchingUserIds: string[] = []
  if (searchQuery.trim()) {
    // Step 1: Get all user_ids that belong to this organization's memberships (FAST with index)
    const { data: orgMemberships, error: membershipsError } = await supabase
      .from('memberships')
      .select('user_id')
      .eq('org_id', organizationId)
    
    if (membershipsError || !orgMemberships || orgMemberships.length === 0) {
      // No memberships found - return empty result
      matchingUserIds = []
    } else {
      const orgUserIds = orgMemberships.map(m => m.user_id).filter(Boolean) as string[]
      
      if (orgUserIds.length === 0) {
        matchingUserIds = []
      } else {
        // Step 2: Search ONLY profiles that belong to this organization (small dataset, fast)
        const trimmedQuery = searchQuery.trim()
        const escaped = escapeForILike(trimmedQuery)
        const searchPattern = `%${escaped}%`
        const searchTerms = trimmedQuery.toLowerCase().split(' ').filter(t => t.length > 0)
        
        // Search profiles table filtered by org member IDs (uses trigram indexes on small dataset)
        // Handle multi-word searches: "John Smith" should match first_name="John" AND last_name="Smith"
        // Also match if full search term appears in either first_name, last_name, or email
        let profilesQuery = supabase
          .from('profiles')
          .select('id, first_name, last_name, email')
          .is('deleted_at', null)
          .in('id', orgUserIds) // CRITICAL: Only search profiles in this organization
        
        if (searchTerms.length > 1) {
          // Multi-word search: try to match first word in first_name AND second word in last_name
          // OR vice versa, OR full term in any field
          const firstTermEscaped = escapeForILike(searchTerms[0])
          const secondTermEscaped = escapeForILike(searchTerms[1])
          const firstPattern = `%${firstTermEscaped}%`
          const secondPattern = `%${secondTermEscaped}%`
          
          // Match: (first_name contains first term AND last_name contains second term)
          // OR (first_name contains second term AND last_name contains first term)
          // OR (first_name contains full term) OR (last_name contains full term) OR (email contains full term)
          profilesQuery = profilesQuery.or(
            `and(first_name.ilike.${firstPattern},last_name.ilike.${secondPattern}),` +
            `and(first_name.ilike.${secondPattern},last_name.ilike.${firstPattern}),` +
            `first_name.ilike.${searchPattern},` +
            `last_name.ilike.${searchPattern},` +
            `email.ilike.${searchPattern}`
          )
        } else {
          // Single word search: match in first_name, last_name, or email
          profilesQuery = profilesQuery.or(
            `first_name.ilike.${searchPattern},` +
            `last_name.ilike.${searchPattern},` +
            `email.ilike.${searchPattern}`
          )
        }
        
        const { data: matchingProfiles, error: profilesError } = await profilesQuery
        
        if (!profilesError && matchingProfiles) {
          // For multi-word searches, also filter in memory to ensure all terms match
          if (searchTerms.length > 1) {
            matchingUserIds = matchingProfiles
              .filter(profile => {
                const firstName = (profile.first_name || '').toLowerCase()
                const lastName = (profile.last_name || '').toLowerCase()
                const email = (profile.email || '').toLowerCase()
                const fullName = `${firstName} ${lastName}`.trim()
                
                // Check if all search terms appear somewhere in the name or email
                return searchTerms.every(term => 
                  firstName.includes(term) || 
                  lastName.includes(term) || 
                  fullName.includes(term) ||
                  email.includes(term)
                )
              })
              .map(p => p.id)
          } else {
            matchingUserIds = matchingProfiles.map(p => p.id)
          }
        }
      }
    }
  }

  // Build query for members with their profiles and organization info
  // Filter out soft-deleted profiles (deleted_at IS NULL)
  let query = supabase
    .from("memberships")
    .select(`
      id,
      role,
      created_at,
      profiles!inner(
        id,
        first_name,
        last_name,
        email,
        job_title,
        avatar_url,
        deleted_at
      ),
      organizations!inner(
        id,
        name,
        logo_url,
        owner_id
      )
    `)
    .eq("org_id", organizationId)
    .is("profiles.deleted_at", null)

  // Apply search filter: filter memberships by matching user IDs
  if (searchQuery.trim()) {
    if (matchingUserIds.length > 0) {
      query = query.in('user_id', matchingUserIds)
    } else {
      // No matches found - return empty result by using impossible UUID
      query = query.eq('user_id', '00000000-0000-0000-0000-000000000000')
    }
  }

  // Order and paginate
  const { data: members, error: membersError } = await query
    .order("profiles(first_name)")
    .range(offset, offset + limit - 1)

  if (membersError) {
    console.error('Error fetching organization members:', membersError)
    return { 
      ok: false, 
      message: "Failed to fetch members" 
    }
  }

  // Transform the data to match our interface
  const transformedMembers: OrganizationMember[] = members?.map(member => {
    const profile = Array.isArray(member.profiles) ? member.profiles[0] : member.profiles
    const organization = Array.isArray(member.organizations) ? member.organizations[0] : member.organizations
    
    // Compute effective role: if user is owner, show 'owner', otherwise show membership role
    const effective_role = organization.owner_id === profile.id ? 'owner' : member.role
    
    return {
      id: profile.id,
      membership_id: member.id,
      first_name: profile.first_name || '',
      last_name: profile.last_name || '',
      email: profile.email || '',
      job_title: profile.job_title || undefined,
      avatar_url: profile.avatar_url || undefined,
      role: member.role,
      effective_role: effective_role,
      created_at: member.created_at,
      organization: {
        id: organization.id,
        name: organization.name || '',
        logo_url: organization.logo_url || undefined
      }
    }
  }) || []

  // Determine if there are more pages
  const hasNextPage = transformedMembers.length === limit

  return { 
    ok: true, 
    data: transformedMembers,
    hasNextPage
  }
}

// Update member role
export async function updateMemberRole(data: {
  membershipId: string
  newRole: string
  organizationId: string
}) {
  const supabase = await createClient()

  // Verify the user is authenticated
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return { 
      ok: false, 
      message: "Unauthorized" 
    }
  }

  // Verify the user has access to this organization and is an owner
  const { data: organization, error: orgError } = await supabase
    .from("organizations")
    .select(`
      id,
      owner_id,
      memberships!inner(user_id, role)
    `)
    .eq("id", data.organizationId)
    .eq("memberships.user_id", user.id)
    .single()

  if (orgError || !organization) {
    return { 
      ok: false, 
      message: "Organization not found or access denied" 
    }
  }

  // Check if user is owner (using the same logic as the UI - organizations.owner_id)
  if (organization.owner_id !== user.id) {
    return { 
      ok: false, 
      message: "Only organization owners can manage member roles" 
    }
  }

  // Handle ownership transfer
  if (data.newRole === 'owner') {
    // Get the user_id of the member being promoted
    const { data: membership, error: membershipError } = await supabase
      .from("memberships")
      .select("user_id")
      .eq("id", data.membershipId)
      .single()

    if (membershipError || !membership) {
      return { 
        ok: false, 
        message: "Member not found" 
      }
    }

    // Update organization owner
    const { error: ownerError } = await supabase
      .from("organizations")
      .update({ 
        owner_id: membership.user_id,
        updated_at: new Date().toISOString()
      })
      .eq("id", data.organizationId)

    if (ownerError) {
      console.error('Error updating organization owner:', ownerError)
      return { 
        ok: false, 
        message: "Failed to transfer ownership" 
      }
    }
  } else {
    // For non-owner role changes, update membership role
    const { error } = await supabase
      .from("memberships")
      .update({ 
        role: data.newRole,
        updated_at: new Date().toISOString()
      })
      .eq("id", data.membershipId)
      .eq("org_id", data.organizationId)

    if (error) {
      console.error('Error updating member role:', error)
      return { 
        ok: false, 
        message: "Failed to update member role" 
      }
    }
  }

  // Revalidate the members page
  revalidatePath("/settings/organization/members")
  
  return { ok: true }
}

// Remove member - performs full user deletion:
// 1. Hard delete auth.users
// 2. Soft delete profiles (deleted_at)
// 3. Hard delete memberships
// 4. Hard delete membership_invitations
export async function removeMember(data: {
  membershipId: string
  organizationId: string
}) {
  const supabase = await createClient()

  // Verify the user is authenticated
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return { 
      ok: false, 
      message: "Unauthorized" 
    }
  }

  // Check rate limit
  const rateLimit = checkRateLimit(user.id, 'removeMember')
  if (!rateLimit.allowed) {
    return {
      ok: false,
      message: `Rate limit exceeded. You can remove ${RATE_LIMITS.removeMember.limit} members per minute. Try again in ${rateLimit.retryAfter} seconds.`
    }
  }

  // Verify the user has access to this organization and is an owner
  const { data: organization, error: orgError } = await supabase
    .from("organizations")
    .select(`
      id,
      owner_id,
      memberships!inner(user_id, role)
    `)
    .eq("id", data.organizationId)
    .eq("memberships.user_id", user.id)
    .single()

  if (orgError || !organization) {
    return { 
      ok: false, 
      message: "Organization not found or access denied" 
    }
  }

  // Check if user is owner (using the same logic as the UI - organizations.owner_id)
  if (organization.owner_id !== user.id) {
    return { 
      ok: false, 
      message: "Only organization owners can remove members" 
    }
  }

  // Get the target member's user_id and verify they're not the owner
  const { data: targetMembership, error: targetError } = await supabase
    .from("memberships")
    .select("user_id, role")
    .eq("id", data.membershipId)
    .single()

  if (targetError || !targetMembership) {
    return { 
      ok: false, 
      message: "Member not found" 
    }
  }

  if (targetMembership.role === 'owner') {
    return { 
      ok: false, 
      message: "Cannot remove organization owner" 
    }
  }

  const targetUserId = targetMembership.user_id

  try {
    // Create admin client for operations that need to bypass RLS
    const adminSupabase = createAdminClient()

    // Step 0: Get the email before we null it (needed for invitation cleanup)
    const { data: profileEmailData } = await adminSupabase
      .from("profiles")
      .select("email")
      .eq("id", targetUserId)
      .single()

    // Step 0.5: Delete avatar folder from storage FIRST (before profile is soft-deleted)
    // This is necessary so RLS policy can verify the profile exists and user has permission
    // Storage deletion is best-effort - if it fails, we still proceed with DB deletion
    const avatarStorageResult = await deleteAvatarFolder(targetUserId)
    if (!avatarStorageResult.success) {
      // Log the error but don't fail the deletion - storage cleanup is best-effort
      console.warn('Failed to delete avatar folder for removed member:', {
        userId: targetUserId,
        error: avatarStorageResult.error,
      })
    }

    // Step 1: Soft-delete the profile (keep email for audit trail)
    const { error: profileError } = await adminSupabase
      .from("profiles")
      .update({ 
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq("id", targetUserId)
      .select()

    if (profileError) {
      console.error('Error soft-deleting profile:', profileError)
      return { 
        ok: false, 
        message: "Failed to remove member profile" 
      }
    }


    // Step 2: Remove the membership (if it exists)
    const { error: membershipError } = await supabase
      .from("memberships")
      .delete()
      .eq("id", data.membershipId)
      .eq("org_id", data.organizationId)

    if (membershipError) {
      console.error('Error removing membership:', membershipError)
      // For pending invitations, membership might not exist - that's okay
      // Only rollback if it's a critical error (not just "not found")
      if (membershipError.code !== 'PGRST116') { // PGRST116 = no rows returned
        // Attempt to rollback profile soft-deletion
        await supabase
          .from("profiles")
          .update({ 
            deleted_at: null,
            updated_at: new Date().toISOString()
          })
          .eq("id", targetUserId)
        
        return { 
          ok: false, 
          message: "Failed to remove member membership" 
        }
      }
      // If membership not found, continue - this is expected for pending invitations
    }

    // Step 3: Delete the auth user (hard deletion)
    const { error: authError } = await adminSupabase.auth.admin.deleteUser(targetUserId)

    if (authError) {
      console.error('Error deleting auth user:', authError)
      // Note: We don't rollback here because the membership is already removed
      // and the profile is soft-deleted, which is the desired state
      // The user just won't be able to sign in, which is what we want
    }

    // Step 4: Hard delete any invitations for this email & org
    if (profileEmailData?.email) {
      const { error: invitationError } = await adminSupabase
        .from("membership_invitations")
        .delete()
        .eq("org_id", data.organizationId)
        .eq("invited_email", profileEmailData.email)
      
      if (invitationError) {
        console.error('Error deleting invitations:', invitationError)
        // Log but don't fail - invitations cleanup is best-effort
      }
    }


    // Revalidate the members page
    revalidatePath("/settings/organization/members")
    
    return { ok: true }

  } catch (error) {
    console.error('Unexpected error during member removal:', error)
    return { 
      ok: false, 
      message: "An unexpected error occurred while removing the member" 
    }
  }
}

// Validate and invite members (MVP - single action)
export async function validateAndInviteMembers(data: {
  organizationId: string
  emails: string[]
}): Promise<ActionResult & { errors?: Record<string, string> }> {
  try {
    // Verify authentication
    const authResult = await verifyAuth()
    if (!authResult.ok) {
      return authResult
    }
    const user = authResult.data

    // Check rate limit (per org)
    const rateLimit = checkRateLimit(user.id, 'inviteMembers', data.organizationId)
    if (!rateLimit.allowed) {
      const minutesRemaining = Math.ceil((rateLimit.retryAfter || 0) / 60)
      return {
        ok: false,
        message: `Rate limit exceeded. You can send ${RATE_LIMITS.inviteMembers.limit} invitations per minute per organization. Please wait ${minutesRemaining} minute${minutesRemaining !== 1 ? 's' : ''} before sending more invitations.`
      }
    }

    // Verify organization ownership
    const orgResult = await verifyOrganizationOwnership(data.organizationId, user.id)
    if (!orgResult.ok) {
      return orgResult
    }

    const supabase = await createClient()

    // Get billing status and organization type for paywall check
    const { data: organization, error: orgError } = await supabase
      .from("organizations")
      .select("billing_status, type")
      .eq("id", data.organizationId)
      .single()

    if (orgError || !organization) {
      return {
        ok: false,
        message: "Organization not found"
      }
    }

    const billingStatus = organization.billing_status || 'free'
    const organizationType = (organization.type === 'agency' || organization.type === 'client') 
      ? organization.type 
      : 'agency' // Default to agency for safety

    // Check member limit paywall (only applies to agencies)
    const { checkMemberLimit } = await import('@/lib/paywall/checkMemberLimit')
    const memberLimitCheck = await checkMemberLimit({
      organizationId: data.organizationId,
      billingStatus,
      organizationType,
    })

    if (!memberLimitCheck.allowed) {
      return {
        ok: false,
        paywall: true,
        message: "Free organizations are limited to 2 members. Upgrade to invite more team members."
      }
    }

    // Validate emails exist
    if (!data.emails || data.emails.length === 0) {
      return {
        ok: false,
        message: "Please enter at least one email address"
      }
    }

    // Batch size limit (prevent abuse) - enforce 20 limit
    const MAX_INVITES_PER_REQUEST = 20
    if (data.emails.length > MAX_INVITES_PER_REQUEST) {
      return {
        ok: false,
        message: `You can invite up to ${MAX_INVITES_PER_REQUEST} members at once`
      }
    }

    // Email format validation and normalization
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    const normalizedEmails = data.emails.map(email => email.toLowerCase().trim())
    const currentUserEmail = user.email?.toLowerCase().trim()
    const now = new Date().toISOString()

    // Per-email validation - build error map
    const errors: Record<string, string> = {}
    const seenEmails = new Set<string>()

    // First pass: check format, duplicates, self-invite
    for (const email of normalizedEmails) {
      if (!emailRegex.test(email)) {
        errors[email] = "invalid email format"
        continue
      }

      if (seenEmails.has(email)) {
        errors[email] = "duplicate email"
        continue
      }
      seenEmails.add(email)

      if (currentUserEmail && email === currentUserEmail) {
        errors[email] = "cannot invite yourself"
        continue
      }
    }

    // Get valid emails (no format/duplicate/self-invite errors)
    const validEmails = normalizedEmails.filter(email => !errors[email])

    if (validEmails.length === 0) {
      return {
        ok: false,
        errors
      }
    }

    // Check for existing members
    const { data: existingMembers, error: membersError } = await supabase
      .from("memberships")
      .select(`
        profiles!inner(email)
      `)
      .eq("org_id", data.organizationId)
      .in("profiles.email", validEmails)

    if (!membersError && existingMembers) {
      const existingMemberEmails = new Set(
        existingMembers.map(m => {
          const profile = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles
          return profile?.email?.toLowerCase().trim()
        }).filter(Boolean) as string[]
      )

      validEmails.forEach(email => {
        if (existingMemberEmails.has(email)) {
          errors[email] = "already a member"
        }
      })
    }

    // Check for pending unexpired invitations
    const { data: existingPendingInvitations, error: invitationsError } = await supabase
      .from("membership_invitations")
      .select("invited_email, status, expires_at")
      .eq("org_id", data.organizationId)
      .in("invited_email", validEmails)

    if (!invitationsError && existingPendingInvitations) {
      existingPendingInvitations.forEach((inv: { invited_email: string; status: string; expires_at?: string }) => {
        const email = inv.invited_email.toLowerCase().trim()
        // Only block if pending and not expired
        if (inv.status === 'pending' && inv.expires_at && new Date(inv.expires_at) > new Date(now)) {
          if (!errors[email]) {
            errors[email] = "already invited"
          }
        }
      })
    }

    // Check for existing auth users (also check profiles table as fallback)
    const emailsToCheckAuth = validEmails.filter(email => !errors[email])
    
    if (emailsToCheckAuth.length > 0) {
      // Check profiles table directly (more reliable than RPC)
      const { data: existingProfiles, error: profilesError } = await supabase
        .from("profiles")
        .select("email")
        .in("email", emailsToCheckAuth)
        .is("deleted_at", null) // Only check non-deleted profiles
      
      if (!profilesError && existingProfiles) {
        const existingProfileEmails = new Set(
          existingProfiles.map(p => p.email?.toLowerCase().trim()).filter(Boolean) as string[]
        )
        
        emailsToCheckAuth.forEach(email => {
          if (existingProfileEmails.has(email)) {
            errors[email] = "This person already has an account in Fiive."
          }
        })
      }
      
      // Also check auth.users via RPC for any emails not already flagged
      const emailsStillToCheck = emailsToCheckAuth.filter(email => !errors[email])
      for (const email of emailsStillToCheck) {
        try {
          const { data: exists, error: rpcError } = await supabase.rpc('check_user_email_exists', {
            p_email: email
          })
          
          if (!rpcError && exists === true) {
            errors[email] = "This person already has an account in Fiive."
          }
        } catch (error) {
          console.error(`Error checking auth user for ${email}:`, error)
          // If RPC fails, we already checked profiles, so continue
        }
      }
    }

    // If any errors, return them
    if (Object.keys(errors).length > 0) {
      return {
        ok: false,
        errors
      }
    }

    // All emails are valid - proceed with invites
    // Get existing invitations to handle expired ones
    const { data: existingInvitations } = await supabase
      .from("membership_invitations")
      .select("invited_email, status, expires_at")
      .eq("org_id", data.organizationId)
      .in("invited_email", validEmails)

    const existingEmailsMap = new Map<string, { status: string; expires_at?: string }>()
    existingInvitations?.forEach((inv: { invited_email: string; status: string; expires_at?: string }) => {
      existingEmailsMap.set(inv.invited_email.toLowerCase().trim(), { status: inv.status, expires_at: inv.expires_at })
    })

    const pendingEmails: string[] = []
    const expiredEmails: string[] = []
    const newEmails: string[] = []

    validEmails.forEach(email => {
      const invitation = existingEmailsMap.get(email)
      if (!invitation) {
        newEmails.push(email)
      } else if (invitation.status === 'pending') {
        // Check if invitation is still valid (not expired)
        if (invitation.expires_at && new Date(invitation.expires_at) > new Date(now)) {
          pendingEmails.push(email)
        } else {
          // Pending but expired - treat as expired
          expiredEmails.push(email)
        }
      } else if (invitation.status === 'expired') {
        expiredEmails.push(email)
      } else {
        newEmails.push(email)
      }
    })

    // Check if adding new invitations would exceed member limit (for free agencies)
    if (organizationType === 'agency' && billingStatus === 'free' && newEmails.length > 0) {
      const { countOrganizationMembers, countOrganizationInvitations } = await import('@/lib/paywall/checkMemberLimit')
      const [memberCount, invitationCount] = await Promise.all([
        countOrganizationMembers(data.organizationId),
        countOrganizationInvitations(data.organizationId),
      ])
      
      const totalAfterInvites = memberCount + invitationCount + newEmails.length
      
      // Free agency organizations limited to 2 members total (including owner)
      if (totalAfterInvites > 2) {
        return {
          ok: false,
          paywall: true,
          message: "You can only invite 1 additional member on the Starter plan"
        }
      }
    }

  // Handle new emails - create new invitations
  // Store raw tokens for email links (keyed by email)
  const rawTokensMap = new Map<string, string>()
  
  const newInvitations = newEmails.map(email => {
    const { rawToken, tokenHash, expiresAt } = generateInvitationToken()
    rawTokensMap.set(email.toLowerCase().trim(), rawToken)
    const now = new Date().toISOString()

    return {
      org_id: data.organizationId,
      invited_by_user: user.id,
      invited_email: email.toLowerCase().trim(),
      role: 'member' as const,
      token_hash: tokenHash,
      status: 'pending' as const,
      expires_at: expiresAt,
      created_at: now,
      updated_at: now
    }
  })

  // Handle expired emails - reactivate existing invitations
  const expiredInvitations = expiredEmails.map(email => {
    const { rawToken, tokenHash, expiresAt } = generateInvitationToken()
    rawTokensMap.set(email.toLowerCase().trim(), rawToken)
    const now = new Date().toISOString()

    return {
      org_id: data.organizationId,
      invited_by_user: user.id,
      invited_email: email.toLowerCase().trim(),
      role: 'member' as const,
      token_hash: tokenHash,
      status: 'pending' as const,
      expires_at: expiresAt,
      created_at: now,
      updated_at: now
    }
  })

  // Handle pending emails - resend with new token (allow re-invites)
  const pendingInvitationsToUpdate = pendingEmails.map(email => {
    const { rawToken, tokenHash, expiresAt } = generateInvitationToken()
    rawTokensMap.set(email.toLowerCase().trim(), rawToken)
    const now = new Date().toISOString()

    return {
      org_id: data.organizationId,
      invited_by_user: user.id,
      invited_email: email.toLowerCase().trim(),
      role: 'member' as const,
      token_hash: tokenHash,
      status: 'pending' as const,
      expires_at: expiresAt,
      created_at: now,
      updated_at: now
    }
  })

  // Insert new invitations if any
  if (newInvitations.length > 0) {
    const { error: insertError } = await supabase
      .from("membership_invitations")
      .insert(newInvitations)

    if (insertError) {
      console.error('Error creating new invitations:', insertError)
      return { 
        ok: false, 
        message: "Failed to create new invitations" 
      }
    }
  }

  // Update expired invitations if any
  for (const expiredInvitation of expiredInvitations) {
    const { error: updateError } = await supabase
      .from("membership_invitations")
      .update({
        token_hash: expiredInvitation.token_hash,
        status: 'pending',
        expires_at: expiredInvitation.expires_at,
        updated_at: expiredInvitation.updated_at
      })
      .eq("org_id", data.organizationId)
      .eq("invited_email", expiredInvitation.invited_email)
      .eq("status", "expired")

    if (updateError) {
      console.error('Error reactivating expired invitation:', updateError)
      return { 
        ok: false, 
        message: "Failed to reactivate expired invitations" 
      }
    }
  }

  // Update pending invitations with new tokens (resend)
  for (const pendingInvitation of pendingInvitationsToUpdate) {
    const { error: updateError } = await supabase
      .from("membership_invitations")
      .update({
        token_hash: pendingInvitation.token_hash,
        expires_at: pendingInvitation.expires_at,
        updated_at: pendingInvitation.updated_at
      })
      .eq("org_id", data.organizationId)
      .eq("invited_email", pendingInvitation.invited_email)
      .eq("status", "pending")

    if (updateError) {
      console.error('Error updating pending invitation:', updateError)
      return { 
        ok: false, 
        message: "Failed to update pending invitations" 
      }
    }
  }

  // Fetch organization name for email template
  const { data: orgForEmail } = await supabase
    .from('organizations')
    .select('name')
    .eq('id', data.organizationId)
    .single()

  const orgName = orgForEmail?.name || 'our organization'

  // Send Resend invite emails using Batch API (single request for all emails)
  // This eliminates rate limiting issues and improves performance significantly
  const allProcessedEmails = [...newEmails, ...expiredEmails, ...pendingEmails]
  
  // Import batch email sending function
  const { sendMemberInviteEmailsBatch } = await import('@/app/actions/sendMemberInviteEmail')
  
  // Prepare email payloads for batch API and track emails with missing tokens
  const emailPayloads: Array<{ to: string; organizationName: string; inviteUrl: string }> = []
  const emailsWithMissingTokens: Array<{ email: string; success: boolean; error: string }> = []
  
  allProcessedEmails.forEach((email) => {
    const normalizedEmail = email.toLowerCase().trim()
    const rawToken = rawTokensMap.get(normalizedEmail)
    
    if (!rawToken) {
      console.error(`[validateAndInviteMembers] No raw token found for ${email}`)
      emailsWithMissingTokens.push({
        email,
        success: false,
        error: 'No token found',
      })
      return
    }

    const inviteUrl = `${SITE_URL}/member-invite/claim?token=${rawToken}`
    
    emailPayloads.push({
      to: email,
      organizationName: orgName,
      inviteUrl,
    })
  })

  // Send all emails in a single batch API call
  let emailResults: Array<{ email: string; success: boolean; error?: string }> = []
  
  // If we have emails to send, call batch API
  if (emailPayloads.length > 0) {
    try {
      emailResults = await sendMemberInviteEmailsBatch(emailPayloads)
    } catch (error) {
      // If batch API call fails entirely, mark all batch emails as failed
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('[validateAndInviteMembers] Batch API call failed:', errorMessage)
      emailResults = emailPayloads.map(({ to }) => ({
        email: to,
        success: false,
        error: `Batch send failed: ${errorMessage}`,
      }))
    }
  }
  
  // Combine batch results with emails that had missing tokens
  emailResults = [...emailResults, ...emailsWithMissingTokens]
  
  // Process results to track successes and failures
  const successfulEmails: string[] = []
  const failedEmails: Array<{ email: string; error: string }> = []
  
  for (const result of emailResults) {
    if (result.success) {
      successfulEmails.push(result.email)
    } else {
      failedEmails.push({ email: result.email, error: result.error || 'Unknown error' })
    }
  }

  // Log summary
  console.log(`[validateAndInviteMembers] Email send results: ${successfulEmails.length} succeeded, ${failedEmails.length} failed`)
  if (failedEmails.length > 0) {
    console.error('[validateAndInviteMembers] Failed emails:', failedEmails)
  }

  // Revalidate the members page
  revalidatePath("/settings/organization/members")
  
  // Return detailed results
  const totalSuccessful = successfulEmails.length
  const totalFailed = failedEmails.length
  
  // If all emails failed, return error
  if (totalSuccessful === 0 && totalFailed > 0) {
    return {
      ok: false,
      message: `Failed to send all ${totalFailed} invitation${totalFailed !== 1 ? 's' : ''}. Please try again.`,
      errors: failedEmails.reduce((acc, { email, error }) => {
        acc[email] = error
        return acc
      }, {} as Record<string, string>)
    }
  }
  
  // If some emails failed, return partial success with details
  if (totalFailed > 0) {
    const message = `${totalSuccessful} invitation${totalSuccessful !== 1 ? 's' : ''} sent successfully${totalFailed > 0 ? `, ${totalFailed} failed` : ''}`
    return {
      ok: true,
      message,
      errors: failedEmails.reduce((acc, { email, error }) => {
        acc[email] = error
        return acc
      }, {} as Record<string, string>)
    }
  }
  
  // All emails succeeded
  const message = totalSuccessful === 1 
    ? 'Invitation sent successfully' 
    : `${totalSuccessful} invitations sent successfully`
    
  return { 
    ok: true,
    message
  }
  } catch (error) {
    console.error('Error in inviteMembers:', error)
    return {
      ok: false,
      message: `Failed to send invitations: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}

// Get organization pending invitations
export async function getOrganizationInvitations(
  organizationId: string,
  options: { limit?: number; offset?: number; searchQuery?: string } = {}
): Promise<ActionResult<OrganizationInvitation[]> & { hasNextPage?: boolean }> {
  const { limit = 100, offset = 0, searchQuery = '' } = options
  
  // Verify authentication
  const authResult = await verifyAuth()
  if (!authResult.ok) {
    return { ok: false, message: authResult.message }
  }

  // Verify organization access
  const orgResult = await verifyOrganizationAccess(organizationId, authResult.data.id)
  if (!orgResult.ok) {
    return { ok: false, message: orgResult.message }
  }

  const supabase = await createClient()

  // Build query for pending invitations
  let query = supabase
    .from("membership_invitations")
    .select(`
      id,
      invited_email,
      role,
      status,
      created_at,
      expires_at
    `)
    .eq("org_id", organizationId)
    .eq("status", "pending")

  // Apply server-side search if searchQuery is provided
  // Uses trigram index on lower(invited_email) for fast email search
  if (searchQuery.trim()) {
    const escapedSearch = escapeForILike(searchQuery.trim())
    const searchTerm = `%${escapedSearch}%`
    // Use ilike on invited_email - trigram index will be used automatically
    query = query.ilike("invited_email", searchTerm)
  }

  // Order and paginate
  const { data: invitations, error: invitationsError } = await query
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1)

  if (invitationsError) {
    console.error('Error fetching invitations:', invitationsError)
    return { 
      ok: false, 
      message: "Failed to fetch invitations" 
    }
  }

  // Determine if there are more pages
  const hasNextPage = (invitations || []).length === limit

  return { 
    ok: true, 
    data: invitations || [],
    hasNextPage
  }
}

// Resend invitation (update same row with new token)
export async function resendInvitation(data: {
  invitationId: string
  organizationId: string
}): Promise<ActionResult> {
  // Verify authentication
  const authResult = await verifyAuth()
  if (!authResult.ok) {
    return authResult
  }
  const user = authResult.data

  // Verify organization ownership
  const orgResult = await verifyOrganizationOwnership(data.organizationId, user.id)
  if (!orgResult.ok) {
    return orgResult
  }

  const supabase = await createClient()

  // Get the invitation details first (including updated_at for rate limiting)
  const { data: invitation, error: invitationError } = await supabase
    .from("membership_invitations")
    .select("invited_email, org_id, updated_at")
    .eq("id", data.invitationId)
    .eq("org_id", data.organizationId)
    .single()

  if (invitationError || !invitation) {
    return {
      ok: false,
      message: "Invitation not found"
    }
  }

  // Rate limiting: Check if last resend was less than 5 minutes ago (per email)
  const fiveMinutesAgo = new Date()
  fiveMinutesAgo.setMinutes(fiveMinutesAgo.getMinutes() - 5)
  
  if (invitation.updated_at) {
    const lastResendDate = new Date(invitation.updated_at)
    if (lastResendDate > fiveMinutesAgo) {
      // Calculate time remaining
      const timeRemainingMs = lastResendDate.getTime() + (5 * 60 * 1000) - Date.now()
      const minutesRemaining = Math.ceil(timeRemainingMs / (60 * 1000))
      
      return {
        ok: false,
        message: `Please wait ${minutesRemaining} minute${minutesRemaining !== 1 ? 's' : ''} before resending the invitation`
      }
    }
  }

  // Get organization name for the email
  const { data: organization } = await supabase
    .from("organizations")
    .select("name")
    .eq("id", data.organizationId)
    .single()

  const orgName = organization?.name || 'our organization'

  // Generate new token for resend
  const { rawToken, tokenHash, expiresAt } = generateInvitationToken()
  const now = new Date().toISOString()

  // Update the invitation row with new token, expiry, and timestamp
  const { error: updateError } = await supabase
    .from("membership_invitations")
    .update({
      token_hash: tokenHash,
      status: 'pending', // Reactivate if it was expired
      expires_at: expiresAt,
      updated_at: now
    })
    .eq("id", data.invitationId)
    .eq("org_id", data.organizationId)

  if (updateError) {
    console.error('Error updating invitation:', updateError)
    return { 
      ok: false, 
      message: "Failed to update invitation"
    }
  }

  // Send email via Resend
  try {
    const { sendMemberInviteEmail } = await import('@/app/actions/sendMemberInviteEmail')
    const inviteUrl = `${SITE_URL}/member-invite/claim?token=${rawToken}`
    
    await sendMemberInviteEmail({
      to: invitation.invited_email,
      organizationName: orgName,
      inviteUrl
    })
  } catch (emailError) {
    console.error('Error sending resend invitation email:', emailError)
    return { 
      ok: false, 
      message: emailError instanceof Error ? emailError.message : 'Failed to send invitation email'
    }
  }

  // Revalidate the members page
  revalidatePath("/settings/organization/members")
  
  return { 
    ok: true,
    message: "Invitation resent successfully"
  }
}

// Cancel invitation (hard delete)
export async function cancelInvitation(data: {
  invitationId: string
  organizationId: string
}): Promise<ActionResult> {
  // Verify authentication
  const authResult = await verifyAuth()
  if (!authResult.ok) {
    return authResult
  }

  // Verify organization ownership
  const orgResult = await verifyOrganizationOwnership(data.organizationId, authResult.data.id)
  if (!orgResult.ok) {
    return orgResult
  }

  const supabase = await createClient()
  const adminSupabase = createAdminClient()

  try {
    // First, get the invitation details
    const { data: invitation, error: invitationError } = await supabase
      .from("membership_invitations")
      .select("*")
      .eq("id", data.invitationId)
      .eq("org_id", data.organizationId)
      .single()

    if (invitationError) {
      console.error('Error fetching invitation:', invitationError)
      console.error('Invitation error details:', {
        code: invitationError.code,
        message: invitationError.message,
        details: invitationError.details
      })
      return { 
        ok: false, 
        message: `Invitation not found: ${invitationError.message}` 
      }
    }

    if (!invitation) {
      console.error('No invitation found with ID:', data.invitationId)
      return { 
        ok: false, 
        message: "Invitation not found" 
      }
    }

    // Clean up auth user and profile created by inviteUserByEmail
    // MVP: 1 user = 1 org, so safe to delete everything when canceling invitation
    const invitationEmail = invitation.invited_email
    
    try {
      const { data: authUsers, error: authUsersError } = await adminSupabase.auth.admin.listUsers()
      
      if (!authUsersError && authUsers) {
        const targetAuthUser = authUsers.users.find(user => 
          user.email?.toLowerCase() === invitationEmail.toLowerCase()
        )
        
        if (targetAuthUser) {
          // Delete profile first (foreign key constraint)
          const { error: profileError } = await adminSupabase
            .from("profiles")
            .delete()
            .eq("id", targetAuthUser.id)
          
          if (profileError) {
            console.error('Error deleting profile:', profileError)
            // Continue with auth user deletion even if profile deletion fails
          }
          
          // Delete auth user
          const { error: authDeleteError } = await adminSupabase.auth.admin.deleteUser(targetAuthUser.id)
          
          if (authDeleteError) {
            console.error('Error deleting auth user:', authDeleteError)
            // Don't fail the whole operation - invitation deletion is more important
          }
        }
      } else if (authUsersError) {
        console.error('Error listing auth users:', authUsersError)
        // Continue with invitation deletion even if we can't check auth users
      }
    } catch (error) {
      console.error('Error during auth user cleanup:', error)
      // Continue with invitation deletion even if cleanup fails
    }

    // Hard delete the invitation
    const { error } = await supabase
      .from("membership_invitations")
      .delete()
      .eq("id", data.invitationId)
      .eq("org_id", data.organizationId)

    if (error) {
      console.error('Error canceling invitation:', error)
      return { 
        ok: false, 
        message: "Failed to cancel invitation" 
      }
    }

    // Revalidate the members page
    revalidatePath("/settings/organization/members")
    
    return { 
      ok: true,
      message: "Invitation canceled successfully"
    }

  } catch (error) {
    console.error('Unexpected error canceling invitation:', error)
    console.error('Error details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    })
    return { 
      ok: false, 
      message: `An unexpected error occurred while canceling the invitation: ${error instanceof Error ? error.message : String(error)}` 
    }
  }
}
