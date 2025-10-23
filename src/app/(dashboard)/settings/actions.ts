"use server"

import { z } from "zod"
import { revalidatePath } from "next/cache"
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { uploadAvatar, uploadLogo } from '@/lib/supabase/storage'
import { randomBytes, createHash } from 'crypto'

// Rate limiting configuration
const RATE_LIMITS = {
  removeMember: { limit: 5, window: 60 * 1000 }, // 5 per minute
  cancelInvitation: { limit: 10, window: 60 * 1000 }, // 10 per minute
  inviteMembers: { limit: 20, window: 60 * 1000 }, // 20 per minute
  resendInvitation: { limit: 1, window: 60 * 1000 }, // 1 per minute (60 second cooldown)
} as const

// In-memory rate limiting store (upgrade to Redis in production)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

// Rate limiting helper function
function checkRateLimit(userId: string, action: keyof typeof RATE_LIMITS): { allowed: boolean; retryAfter?: number } {
  const now = Date.now()
  const key = `${userId}:${action}`
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
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/auth/callback?next=/settings/account/access` 
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
    description: values.description || null,
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
export async function getOrganizationMembers(organizationId: string): Promise<{
  ok: boolean
  data?: OrganizationMember[]
  message?: string
}> {
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

  // Fetch members with their profiles and organization info
  // Filter out soft-deleted profiles (deleted_at IS NULL)
  const { data: members, error: membersError } = await supabase
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
    .order("profiles(first_name)")

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

  return { 
    ok: true, 
    data: transformedMembers 
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

// Remove member (consistent soft-delete approach for both active members and pending invitations)
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

    // Step 1: Soft-delete the profile (clear email for reuse, keep other data for historical attribution)
    const { error: profileError, data: profileUpdateData } = await adminSupabase
      .from("profiles")
      .update({ 
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        email: null  // Only clear email to allow reuse
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

    // Step 4: Clean up any invitations for this email (pending or accepted)
    if (profileEmailData?.email) {
      // Cancel any invitations for this email (both pending and accepted)
      const { error: invitationError } = await adminSupabase
        .from("membership_invitations")
        .update({ 
          status: 'expired',
          updated_at: new Date().toISOString()
        })
        .eq("org_id", data.organizationId)
        .eq("invited_email", profileEmailData.email)
        .in("status", ["pending", "accepted"])
      
      if (invitationError) {
        console.error('Error cleaning up invitations:', invitationError)
      } else {
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

// Invite members
export async function inviteMembers(data: {
  organizationId: string
  emails: string[]
}): Promise<ActionResult> {
  try {
    
    // Verify authentication
    const authResult = await verifyAuth()
    if (!authResult.ok) {
      return authResult
    }
    const user = authResult.data

    // Check rate limit
    const rateLimit = checkRateLimit(user.id, 'inviteMembers')
    if (!rateLimit.allowed) {
      return {
        ok: false,
        message: `Rate limit exceeded. You can send ${RATE_LIMITS.inviteMembers.limit} invitations per minute. Try again in ${rateLimit.retryAfter} seconds.`
      }
    }

    // Verify organization ownership
    const orgResult = await verifyOrganizationOwnership(data.organizationId, user.id)
    if (!orgResult.ok) {
      return orgResult
    }

    const supabase = await createClient()

  // Validate emails
  if (!data.emails || data.emails.length === 0) {
    return {
      ok: false,
      message: "Please enter at least one email address"
    }
  }

  // Check for existing invitations and handle them appropriately
  const { data: existingInvitations, error: existingError } = await supabase
    .from("membership_invitations")
    .select("invited_email, status")
    .eq("org_id", data.organizationId)
    .in("invited_email", data.emails)

  if (existingError) {
    console.error('Error checking existing invitations:', existingError)
    return { 
      ok: false, 
      message: "Failed to check existing invitations" 
    }
  }

  // Separate emails by status
  const existingEmailsMap = new Map<string, string>()
  existingInvitations?.forEach((inv: { invited_email: string; status: string }) => {
    existingEmailsMap.set(inv.invited_email, inv.status)
  })

  const pendingEmails: string[] = []
  const expiredEmails: string[] = []
  const acceptedEmails: string[] = []
  const newEmails: string[] = []

  data.emails.forEach(email => {
    const status = existingEmailsMap.get(email)
    if (status === 'pending') {
      pendingEmails.push(email)
    } else if (status === 'expired') {
      expiredEmails.push(email)
    } else if (status === 'accepted') {
      acceptedEmails.push(email)
    } else {
      newEmails.push(email)
    }
  })

  // Note: Client-side validation now handles checking for active members

  // Handle new emails - create new invitations
  const newInvitations = newEmails.map(email => {
    const { tokenHash, expiresAt } = generateInvitationToken()
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
    const { tokenHash, expiresAt } = generateInvitationToken()
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

  // Fetch organization name for email template
  const { data: organization, error: orgError } = await supabase
    .from('organizations')
    .select('name')
    .eq('id', data.organizationId)
    .single()

  const orgName = organization?.name || 'our organization'

  // Send Supabase invite emails for all processed emails
  const allProcessedEmails = [...newEmails, ...expiredEmails]
  
  
  // Create admin client for invite operations
  const adminSupabase = createAdminClient()
  
  for (const email of allProcessedEmails) {
    try {
      
      const { error: inviteError, data: inviteData } = await adminSupabase.auth.admin.inviteUserByEmail(
        email,
        {
          redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/member-invite-test`,
          data: {
            organization_name: orgName,
            organization_id: data.organizationId
          }
        }
      )
      
      if (inviteError) {
        console.error(`Failed to send invite email to ${email}:`, inviteError)
        // Continue with other emails even if one fails
      } else {
      }
    } catch (error) {
      console.error(`Error sending invite email to ${email}:`, error)
      // Continue with other emails even if one fails
    }
  }

  // Revalidate the members page
  revalidatePath("/settings/organization/members")
  
  const totalProcessed = newEmails.length + expiredEmails.length
  const message = totalProcessed === 1 
    ? 'Invitation sent successfully' 
    : `${totalProcessed} invitations sent successfully`
    
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
export async function getOrganizationInvitations(organizationId: string): Promise<ActionResult<OrganizationInvitation[]>> {
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

  // Fetch pending invitations
  const { data: invitations, error: invitationsError } = await supabase
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
    .order("created_at", { ascending: false })

  if (invitationsError) {
    console.error('Error fetching invitations:', invitationsError)
    return { 
      ok: false, 
      message: "Failed to fetch invitations" 
    }
  }

  return { 
    ok: true, 
    data: invitations || [] 
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

  // Check rate limit (60 second cooldown)
  const rateLimit = checkRateLimit(user.id, 'resendInvitation')
  if (!rateLimit.allowed) {
    return {
      ok: false,
      message: `For security purposes, you can only request this after ${rateLimit.retryAfter} seconds.`
    }
  }

  // Verify organization ownership
  const orgResult = await verifyOrganizationOwnership(data.organizationId, user.id)
  if (!orgResult.ok) {
    return orgResult
  }

  const supabase = await createClient()
  const adminSupabase = createAdminClient()

  // Get the invitation details first
  const { data: invitation, error: invitationError } = await supabase
    .from("membership_invitations")
    .select("invited_email, org_id")
    .eq("id", data.invitationId)
    .eq("org_id", data.organizationId)
    .single()

  if (invitationError || !invitation) {
    return {
      ok: false,
      message: "Invitation not found"
    }
  }

  // Get organization name for the email
  const { data: organization } = await supabase
    .from("organizations")
    .select("name")
    .eq("id", data.organizationId)
    .single()

  const orgName = organization?.name || 'our organization'

  // Resend the invitation email through Supabase Auth (this will trigger built-in rate limiting)
  const { error: inviteError } = await adminSupabase.auth.admin.inviteUserByEmail(
    invitation.invited_email,
    {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/member-invite-test`,
      data: {
        organization_name: orgName,
        organization_id: data.organizationId,
        invitation_id: data.invitationId
      }
    }
  )

  if (inviteError) {
    console.error('Error resending invitation email:', inviteError)
    return { 
      ok: false, 
      message: inviteError.message // This will include Supabase's rate limiting message
    }
  }

  // Update the invitation row with new timestamp
  const now = new Date().toISOString()
  const { error: updateError } = await supabase
    .from("membership_invitations")
    .update({
      status: 'pending', // Reactivate if it was expired
      updated_at: now
    })
    .eq("id", data.invitationId)
    .eq("org_id", data.organizationId)

  if (updateError) {
    console.error('Error updating invitation:', updateError)
    // Don't fail the whole operation if database update fails
  }

  // Revalidate the members page
  revalidatePath("/settings/organization/members")
  
  return { 
    ok: true,
    message: "Invitation resent successfully"
  }
}

// Cancel invitation (set status to expired)
export async function cancelInvitation(data: {
  invitationId: string
  organizationId: string
}): Promise<ActionResult> {
  // Verify authentication
  const authResult = await verifyAuth()
  if (!authResult.ok) {
    return authResult
  }

  // Check rate limit
  const rateLimit = checkRateLimit(authResult.data.id, 'cancelInvitation')
  if (!rateLimit.allowed) {
    return {
      ok: false,
      message: `Rate limit exceeded. You can cancel ${RATE_LIMITS.cancelInvitation.limit} invitations per minute. Try again in ${rateLimit.retryAfter} seconds.`
    }
  }

  // Verify organization ownership
  const orgResult = await verifyOrganizationOwnership(data.organizationId, authResult.data.id)
  if (!orgResult.ok) {
    return orgResult
  }

  const supabase = await createClient()
  const adminSupabase = createAdminClient()
  const now = new Date().toISOString()

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

    // Find auth user by email and delete if no active memberships
    const invitationEmail = invitation.invited_email
    const { data: authUsers, error: authUsersError } = await adminSupabase.auth.admin.listUsers()
    
    if (!authUsersError) {
      const targetAuthUser = authUsers.users.find(user => 
        user.email === invitationEmail
      )
      
      if (targetAuthUser) {
        // Check for active memberships
        const { data: memberships } = await adminSupabase
          .from("memberships")
          .select("id, role, org_id, deleted_at")
          .eq("user_id", targetAuthUser.id)
        
        // Filter for active memberships (not deleted)
        const activeMemberships = memberships?.filter(m => !m.deleted_at) || []
        
        if (activeMemberships.length === 0) {
          // Delete profile first (foreign key constraint)
          await adminSupabase
            .from("profiles")
            .delete()
            .eq("id", targetAuthUser.id)
          
          // Delete auth user
          await adminSupabase.auth.admin.deleteUser(targetAuthUser.id)
        }
      }
    }

    // Update the invitation status to expired
    const { error } = await supabase
      .from("membership_invitations")
      .update({
        status: 'expired',
        updated_at: now
      })
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
