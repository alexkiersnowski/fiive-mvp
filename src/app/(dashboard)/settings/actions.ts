"use server"

import { z } from "zod"
import { revalidatePath } from "next/cache"
import { createClient } from '@/lib/supabase/server'
import { uploadAvatar, uploadLogo } from '@/lib/supabase/storage'

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
  currency_code: z.string().min(1, "Currency is required"),
  logo_file: z.instanceof(File).optional(),
})

export async function updateOrganizationDetails(data: {
  organizationId: string
  name: string
  website?: string
  description?: string
  industry: string
  currency_code: string
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
    currency_code: string
    updated_at: string
    logo_url?: string
  } = {
    name: values.name,
    website: values.website || null,
    description: values.description || null,
    industry: values.industry,
    currency_code: values.currency_code,
    updated_at: new Date().toISOString()
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
        avatar_url
      ),
      organizations!inner(
        id,
        name,
        logo_url,
        owner_id
      )
    `)
    .eq("org_id", organizationId)
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

  // Check if user is owner
  const userMembership = organization.memberships.find(m => m.user_id === user.id)
  if (!userMembership || userMembership.role !== 'owner') {
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

// Remove member
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

  // Check if user is owner
  const userMembership = organization.memberships.find(m => m.user_id === user.id)
  if (!userMembership || userMembership.role !== 'owner') {
    return { 
      ok: false, 
      message: "Only organization owners can remove members" 
    }
  }

  // Prevent removing the owner
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

  // Remove the member
  const { error } = await supabase
    .from("memberships")
    .delete()
    .eq("id", data.membershipId)
    .eq("org_id", data.organizationId)

  if (error) {
    console.error('Error removing member:', error)
    return { 
      ok: false, 
      message: "Failed to remove member" 
    }
  }

  // Revalidate the members page
  revalidatePath("/settings/organization/members")
  
  return { ok: true }
}
