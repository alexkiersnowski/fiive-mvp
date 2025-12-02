'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { uploadLogo } from '@/lib/supabase/storage'
import { getAgencyOrgId } from '@/lib/connections/agency-validation'
import { z } from 'zod'
import { SITE_URL } from '@/lib/env'

export async function updateClientPrimaryContact(
  connectionId: string,
  clientPrimaryContactId: string | null
) {
  const supabase = await createClient()
  
  try {
    const { data, error } = await supabase
      .from('connections')
      .update({ client_primary_contact_id: clientPrimaryContactId })
      .eq('id', connectionId)
      .select('id')
      .maybeSingle()
    
    if (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Error updating client primary contact:', error)
      }
      return { success: false, error: error.message }
    }
    
    // Check if any rows were actually updated (RLS might block silently)
    if (!data) {
      return { success: false, error: 'You do not have permission to update this connection.' }
    }
    
    // Revalidate the connection pages to reflect the changes
    revalidatePath(`/clients/${connectionId}`)
    revalidatePath(`/agencies/${connectionId}`)
    revalidatePath('/clients')
    revalidatePath('/agencies')
    
    return { success: true }
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Unexpected error updating client primary contact:', error)
    }
    return { success: false, error: 'An unexpected error occurred' }
  }
}

export async function updateEngagementStatus(
  connectionId: string,
  engagementStatus: string | null
) {
  const supabase = await createClient()
  
  try {
    const { data, error } = await supabase
      .from('connections')
      .update({ engagement_status: engagementStatus })
      .eq('id', connectionId)
      .select('id')
      .maybeSingle()
    
    if (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Error updating engagement status:', error)
      }
      return { success: false, error: error.message }
    }
    
    // Check if any rows were actually updated (RLS might block silently)
    if (!data) {
      return { success: false, error: 'You do not have permission to update this connection.' }
    }
    
    // Revalidate the connection pages to reflect the changes
    revalidatePath(`/clients/${connectionId}`)
    revalidatePath(`/agencies/${connectionId}`)
    revalidatePath('/clients')
    revalidatePath('/agencies')
    
    return { success: true }
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Unexpected error updating engagement status:', error)
    }
    return { success: false, error: 'An unexpected error occurred' }
  }
}

export async function updateContractValue(
  connectionId: string,
  contractValue: string | null
) {
  const supabase = await createClient()
  
  try {
    // Parse the formatted value (e.g., "1,000,000.50") to a numeric string for the database
    let numericValue: string | null = null
    
    if (contractValue) {
      // Remove commas and convert to numeric
      const cleanValue = contractValue.replace(/,/g, '')
      const parsed = parseFloat(cleanValue)
      
      if (isNaN(parsed)) {
        return { success: false, error: 'Invalid contract value provided.' }
      }
      
      // Store as string representation of the number (DB will handle numeric(12,2))
      numericValue = cleanValue
    }

    const { data, error } = await supabase
      .from('connections')
      .update({ contract_value: numericValue })
      .eq('id', connectionId)
      .select('id')
      .maybeSingle()

    if (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Error updating contract value:', error)
      }
      return { success: false, error: error.message }
    }

    // Check if any rows were actually updated (RLS might block silently)
    if (!data) {
      return { success: false, error: 'You do not have permission to update this connection.' }
    }

    // Revalidate the connection pages to reflect the changes
    revalidatePath(`/clients/${connectionId}`)
    revalidatePath(`/agencies/${connectionId}`)
    revalidatePath('/clients')
    revalidatePath('/agencies')

    return { success: true }
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Unexpected error updating contract value:', error)
    }
    return { success: false, error: 'An unexpected error occurred' }
  }
}

export async function updateContractEndDate(
  connectionId: string,
  contractEndDate: string | null
) {
  const supabase = await createClient()
  
  try {
    // Parse the formatted date (e.g., "30 Jul 2027") to ISO format for the database
    let isoDate: string | null = null
    
    if (contractEndDate) {
      const parsedDate = new Date(contractEndDate)
      
      if (isNaN(parsedDate.getTime())) {
        return { success: false, error: 'Invalid date provided.' }
      }
      
      // Convert to ISO date string (YYYY-MM-DD) using local date to avoid timezone shifts
      const year = parsedDate.getFullYear()
      const month = String(parsedDate.getMonth() + 1).padStart(2, '0')
      const day = String(parsedDate.getDate()).padStart(2, '0')
      isoDate = `${year}-${month}-${day}`
    }

    const { data, error } = await supabase
      .from('connections')
      .update({ contract_end_on: isoDate })
      .eq('id', connectionId)
      .select('id')
      .maybeSingle()

    if (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Error updating contract end date:', error)
      }
      return { success: false, error: error.message }
    }

    // Check if any rows were actually updated (RLS might block silently)
    if (!data) {
      return { success: false, error: 'You do not have permission to update this connection.' }
    }

    // Revalidate the connection pages to reflect the changes
    revalidatePath(`/clients/${connectionId}`)
    revalidatePath(`/agencies/${connectionId}`)
    revalidatePath('/clients')
    revalidatePath('/agencies')

    return { success: true }
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Unexpected error updating contract end date:', error)
    }
    return { success: false, error: 'An unexpected error occurred' }
  }
}

export async function updateHealthStatus(
  connectionId: string,
  healthStatus: string | null
) {
  const supabase = await createClient()
  
  try {
    const { data, error } = await supabase
      .from('connections')
      .update({ health_status: healthStatus })
      .eq('id', connectionId)
      .select('id')
      .maybeSingle()
    
    if (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Error updating health status:', error)
      }
      return { success: false, error: error.message }
    }
    
    // Check if any rows were actually updated (RLS might block silently)
    if (!data) {
      return { success: false, error: 'You do not have permission to update this connection.' }
    }
    
    // Revalidate the connection pages to reflect the changes
    revalidatePath(`/clients/${connectionId}`)
    revalidatePath(`/agencies/${connectionId}`)
    revalidatePath('/clients')
    revalidatePath('/agencies')
    revalidatePath('/home')
    
    return { success: true }
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Unexpected error updating health status:', error)
    }
    return { success: false, error: 'An unexpected error occurred' }
  }
}

export async function updateAgencyPrimaryContact(
  connectionId: string,
  memberId: string | null
) {
  const supabase = await createClient()
  
  try {
    const { data, error } = await supabase
      .from('connections')
      .update({ agency_primary_contact_id: memberId })
      .eq('id', connectionId)
      .select('id')
      .maybeSingle()
    
    if (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Error updating agency primary contact:', error)
      }
      return { success: false, error: error.message }
    }
    
    // Check if any rows were actually updated (RLS might block silently)
    if (!data) {
      return { success: false, error: 'You do not have permission to update this connection.' }
    }
    
    // Revalidate the connection pages to reflect the changes
    revalidatePath(`/clients/${connectionId}`)
    revalidatePath(`/agencies/${connectionId}`)
    revalidatePath('/clients')
    revalidatePath('/agencies')
    
    return { success: true }
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Unexpected error updating agency primary contact:', error)
    }
    return { success: false, error: 'An unexpected error occurred' }
  }
}

const DraftClientOrganizationSchema = z.object({
  connectionId: z.string().uuid(),
  name: z.string().min(1, "Organization name is required").optional(),
  website: z.string().url("Please enter a valid website URL").optional().or(z.literal("")),
  description: z.string().optional(),
  industry: z.string().optional(),
  logo_file: z.instanceof(File).optional(),
})

export async function updateDraftClientOrganization(data: {
  connectionId: string
  name?: string
  website?: string
  description?: string
  industry?: string
  logo_file?: File
}) {
  const supabase = await createClient()
  
  try {
    // Validate input data
    const parsed = DraftClientOrganizationSchema.safeParse({
      ...data,
      connectionId: data.connectionId
    })
    
    if (!parsed.success) {
      return { 
        success: false, 
        error: parsed.error.issues[0]?.message || 'Invalid input data' 
      }
    }

    // Verify the user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { 
        success: false, 
        error: "Unauthorized" 
      }
    }

    // Get user's organization and verify it's an agency
    const agencyResult = await getAgencyOrgId()
    if (!agencyResult.success) {
      return {
        success: false,
        error: agencyResult.error
      }
    }
    const agencyOrgId = agencyResult.agencyOrgId

    // Validate connection exists, belongs to agency, and is in internal state
    const { data: connection, error: connectionError } = await supabase
      .from('connections')
      .select('id, connection_status, client_id, agency_id')
      .eq('id', data.connectionId)
      .eq('agency_id', agencyOrgId)
      .single()

    if (connectionError || !connection) {
      return { 
        success: false, 
        error: "Connection not found or access denied" 
      }
    }

    // CRITICAL: Only allow updates if connection is in internal state
    if (connection.connection_status !== 'internal') {
      return { 
        success: false, 
        error: "Organization details can only be updated for internal connections" 
      }
    }

    // Get client organization ID
    const clientOrgId = connection.client_id
    if (!clientOrgId) {
      return { 
        success: false, 
        error: "Client organization not found" 
      }
    }

    // Prepare update data - only include fields that are provided
    const updateData: {
      name?: string
      website?: string | null
      description?: string | null
      industry?: string
      updated_at: string
      logo_url?: string
    } = {
      updated_at: new Date().toISOString()
    }

    // Only include fields that are provided (not undefined)
    if (data.name !== undefined) {
      updateData.name = data.name
    }
    if (data.website !== undefined) {
      updateData.website = data.website || null
    }
    if (data.description !== undefined) {
      updateData.description = data.description || null
    }
    if (data.industry !== undefined) {
      updateData.industry = data.industry
    }

    // Handle logo upload if provided
    if (data.logo_file) {
      try {
        const logoUrl = await uploadLogo(data.logo_file, clientOrgId)
        updateData.logo_url = logoUrl
      } catch (error) {
        if (process.env.NODE_ENV !== 'production') {
          console.error('Logo upload error:', error)
        }
        return {
          success: false,
          error: `Logo upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      }
    }

    // Update the client organization
    const { error: updateError } = await supabase
      .from('organizations')
      .update(updateData)
      .eq('id', clientOrgId)

    if (updateError) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Organization update error:', updateError)
      }
      return { 
        success: false, 
        error: updateError.message 
      }
    }

    // Revalidate the connection pages to reflect the changes
    revalidatePath(`/clients/${data.connectionId}`)
    revalidatePath(`/agencies/${data.connectionId}`)
    revalidatePath('/clients')
    revalidatePath('/agencies')
    
    return { success: true }
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Unexpected error updating draft client organization:', error)
    }
    return { success: false, error: 'An unexpected error occurred' }
  }
}

export async function inviteClientToConnection(data: {
  connectionId: string
  email: string
}) {
  const supabase = await createClient()
  
  try {
    // Verify the user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { 
        success: false, 
        error: "Unauthorized" 
      }
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(data.email)) {
      return {
        success: false,
        error: "Please enter a valid email address"
      }
    }

    // Get user's organization and verify it's an agency
    const agencyResult = await getAgencyOrgId()
    if (!agencyResult.success) {
      return {
        success: false,
        error: agencyResult.error
      }
    }
    const agencyOrgId = agencyResult.agencyOrgId

    // Validate connection exists, belongs to agency, and is in internal or invited state
    const { data: connection, error: connectionError } = await supabase
      .from('connections')
      .select('id, connection_status, client_id, agency_id')
      .eq('id', data.connectionId)
      .eq('agency_id', agencyOrgId)
      .single()

    if (connectionError || !connection) {
      return { 
        success: false, 
        error: "Connection not found or access denied" 
      }
    }

    // CRITICAL: Only allow invites if connection is in internal or invited state
    // (invited allows re-invites after 7 days)
    if (connection.connection_status !== 'internal' && connection.connection_status !== 'invited') {
      return { 
        success: false, 
        error: "Client can only be invited for internal or invited connections" 
      }
    }

    // Rate limiting: Check if last invite was less than 10 minutes ago (same as resend)
    if (connection.connection_status === 'invited') {
      // Get the connection with invite details to check rate limit
      const { data: connectionWithInvite, error: inviteDetailsError } = await supabase
        .from('connections')
        .select('invited_at')
        .eq('id', data.connectionId)
        .single()

      if (!inviteDetailsError && connectionWithInvite?.invited_at) {
        const tenMinutesAgo = new Date()
        tenMinutesAgo.setMinutes(tenMinutesAgo.getMinutes() - 10)
        
        const lastInviteDate = new Date(connectionWithInvite.invited_at)
        if (lastInviteDate > tenMinutesAgo) {
          // Calculate time remaining
          const timeRemainingMs = lastInviteDate.getTime() + (10 * 60 * 1000) - Date.now()
          const minutesRemaining = Math.ceil(timeRemainingMs / (60 * 1000))
          
          return {
            success: false,
            error: `Please wait ${minutesRemaining} minute${minutesRemaining !== 1 ? 's' : ''} before sending another invitation`
          }
        }
      }
    }

    // Get client organization ID
    const clientOrgId = connection.client_id
    if (!clientOrgId) {
      return { 
        success: false, 
        error: "Client organization not found" 
      }
    }

    // Validation 4: Client org must be a draft (is_draft = TRUE)
    const { data: clientOrg, error: clientOrgError } = await supabase
      .from('organizations')
      .select('id, is_draft')
      .eq('id', clientOrgId)
      .single()

    if (clientOrgError || !clientOrg) {
      return {
        success: false,
        error: "Client organization not found"
      }
    }

    if (clientOrg.is_draft !== true) {
      return {
        success: false,
        error: "Client organization is no longer a draft"
      }
    }

    // Validation 5: Client org must have zero memberships
    const { count: membershipCount, error: membershipCountError } = await supabase
      .from('memberships')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', clientOrgId)

    if (membershipCountError) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Error checking client org memberships:', membershipCountError)
      }
      return {
        success: false,
        error: "Failed to validate client organization"
      }
    }

    if (membershipCount && membershipCount > 0) {
      return {
        success: false,
        error: "Client organization already has members"
      }
    }

    // Validation 6: Email must NOT already exist in auth.users
    // Use efficient RPC function instead of listing all users
    const { data: emailExists, error: userCheckError } = await supabase.rpc('check_user_email_exists', {
      p_email: data.email
    })
    
    if (userCheckError) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Error checking existing users:', userCheckError)
      }
      return {
        success: false,
        error: "Failed to validate email address"
      }
    }

    if (emailExists === true) {
      return {
        success: false,
        error: "This email already has a Fiive account"
      }
    }

    // Validation 7: No active invite within the last 7 days for this email
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    
    const { data: existingInvite, error: inviteCheckError } = await supabase
      .from('connections')
      .select('id, invited_at, invite_token, invited_email')
      .eq('id', data.connectionId)
      .eq('invited_email', data.email.toLowerCase())
      .not('invite_token', 'is', null)
      .not('invited_at', 'is', null)
      .gte('invited_at', sevenDaysAgo.toISOString())
      .single()

    if (inviteCheckError && inviteCheckError.code !== 'PGRST116') {
      // PGRST116 = no rows returned, which is fine
      if (process.env.NODE_ENV !== 'production') {
        console.error('Error checking existing invite:', inviteCheckError)
      }
      return {
        success: false,
        error: "Failed to validate existing invitations"
      }
    }

    if (existingInvite) {
      return {
        success: false,
        error: "An active invitation was sent less than 7 days ago"
      }
    }

    // Validation 8: Email cannot belong to the agency
    const { data: agencyMembers, error: agencyMembersError } = await supabase
      .from('memberships')
      .select(`
        profiles!inner(
          email
        )
      `)
      .eq('org_id', agencyOrgId)

    if (agencyMembersError) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Error checking agency members:', agencyMembersError)
      }
      return {
        success: false,
        error: "Failed to validate email address"
      }
    }

    const agencyEmails = (agencyMembers || []).map((m: { profiles: { email: string } | { email: string }[] }) => {
      const profile = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
      return profile?.email?.toLowerCase();
    }).filter(Boolean) as string[]

    if (agencyEmails.includes(data.email.toLowerCase())) {
      return {
        success: false,
        error: "This email belongs to your agency"
      }
    }

    // Import token creation and email sending functions
    const { createInviteToken } = await import('@/lib/tokens/createInviteToken')
    const { sendClientInviteEmail } = await import('@/app/actions/sendClientInviteEmail')

    // Generate and store invite token
    const tokenResult = await createInviteToken(data.connectionId, data.email)
    if (!tokenResult.success) {
      return {
        success: false,
        error: tokenResult.error || 'Failed to create invite token'
      }
    }

    // Get agency organization name for email
    const { data: agencyOrg, error: agencyOrgError } = await supabase
      .from('organizations')
      .select('name')
      .eq('id', agencyOrgId)
      .single()

    if (agencyOrgError || !agencyOrg) {
      return {
        success: false,
        error: 'Failed to retrieve agency information'
      }
    }

    // Build invite URL
    const inviteUrl = `${SITE_URL}/claim?token=${tokenResult.token}`

    // Send invitation email via Resend
    try {
      await sendClientInviteEmail({
        to: data.email,
        agencyName: agencyOrg.name,
        inviteUrl
      })
    } catch (emailError) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Error sending invitation email:', emailError)
      }
      return {
        success: false,
        error: emailError instanceof Error ? emailError.message : 'Failed to send invitation email'
      }
    }

    // Revalidate connection pages to reflect the changes
    revalidatePath(`/clients/${data.connectionId}`)
    revalidatePath(`/agencies/${data.connectionId}`)
    revalidatePath('/clients')
    revalidatePath('/agencies')

    return {
      success: true
    }
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Unexpected error inviting client:', error)
    }
    return { success: false, error: 'An unexpected error occurred' }
  }
}

export async function resendInviteEmail(data: {
  connectionId: string
}) {
  const supabase = await createClient()
  
  try {
    // Verify the user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { 
        success: false, 
        error: "Unauthorized" 
      }
    }

    // Get user's organization ID and type
    const { data: membership, error: membershipError } = await supabase
      .from('memberships')
      .select(`
        org_id,
        organizations!inner(id, type, owner_id)
      `)
      .eq('user_id', user.id)
      .is('organizations.is_draft', false)
      .single()

    let userOrgId: string | null = null
    let userOrgType: string | null = null

    if (membershipError || !membership) {
      // Fallback: check if user is owner
      const { data: ownerOrg, error: ownerError } = await supabase
        .from('organizations')
        .select('id, type')
        .eq('owner_id', user.id)
        .is('is_draft', false)
        .single()

      if (ownerError || !ownerOrg) {
        return {
          success: false,
          error: 'You must be a member of an organization'
        }
      }

      userOrgId = ownerOrg.id
      userOrgType = ownerOrg.type
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const org = (membership as any).organizations
      userOrgId = org.id
      userOrgType = org.type
    }

    if (!userOrgId || !userOrgType) {
      return {
        success: false,
        error: 'Organization not found'
      }
    }

    // Validate connection exists and belongs to user's org
    const { data: connection, error: connectionError } = await supabase
      .from('connections')
      .select('id, connection_status, client_id, agency_id, invited_email, invited_at, invite_token')
      .eq('id', data.connectionId)
      .or(userOrgType === 'agency' 
        ? `agency_id.eq.${userOrgId}` 
        : `client_id.eq.${userOrgId}`)
      .single()

    if (connectionError || !connection) {
      return { 
        success: false, 
        error: "Connection not found or access denied" 
      }
    }

    // CRITICAL: Only allow resend for invited connections
    if (connection.connection_status !== 'invited') {
      return { 
        success: false, 
        error: "Can only resend invitations for invited connections" 
      }
    }

    // Validate invite fields exist
    if (!connection.invited_email || !connection.invited_at || !connection.invite_token) {
      return {
        success: false,
        error: "Invitation details not found"
      }
    }

    // Rate limiting: Check if last invite was less than 10 minutes ago
    const tenMinutesAgo = new Date()
    tenMinutesAgo.setMinutes(tenMinutesAgo.getMinutes() - 10)
    
    const lastInviteDate = new Date(connection.invited_at)
    if (lastInviteDate > tenMinutesAgo) {
      // Calculate time remaining
      const timeRemainingMs = lastInviteDate.getTime() + (10 * 60 * 1000) - Date.now()
      const minutesRemaining = Math.ceil(timeRemainingMs / (60 * 1000))
      
      return {
        success: false,
        error: `Please wait ${minutesRemaining} minute${minutesRemaining !== 1 ? 's' : ''} before resending the invitation`
      }
    }

    // Check if token is still valid (within 7 days)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    
    if (lastInviteDate < sevenDaysAgo) {
      return {
        success: false,
        error: "Invitation has expired. Please send a new invitation."
      }
    }

    // Import token creation and email sending functions
    const { createInviteToken } = await import('@/lib/tokens/createInviteToken')

    // Invalidate old token before creating new one (security: only one valid token at a time)
    const { error: clearTokenError } = await supabase
      .from('connections')
      .update({ invite_token: null })
      .eq('id', data.connectionId)

    if (clearTokenError) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Error clearing old token:', clearTokenError)
      }
      return {
        success: false,
        error: 'Failed to invalidate previous invitation'
      }
    }

    // Generate new token (old one is now invalid)
    const tokenResult = await createInviteToken(data.connectionId, connection.invited_email)
    if (!tokenResult.success) {
      return {
        success: false,
        error: tokenResult.error || 'Failed to create invite token'
      }
    }

    // Get inviter organization name for email (the organization sending the invite)
    // When agency invites client: show agency name (inviter)
    // When client invites agency: show client name (inviter)
    const { data: inviterOrg, error: inviterOrgError } = await supabase
      .from('organizations')
      .select('name')
      .eq('id', userOrgId)
      .single()

    if (inviterOrgError || !inviterOrg) {
      return {
        success: false,
        error: 'Failed to retrieve organization information'
      }
    }

    // Build invite URL
    const inviteUrl = `${SITE_URL}/claim?token=${tokenResult.token}`

    // Send invitation email via Resend (use appropriate template based on context)
    try {
      if (userOrgType === 'agency') {
        // Agency inviting client - use client invite template, show agency name (inviter)
        const { sendClientInviteEmail } = await import('@/app/actions/sendClientInviteEmail')
        await sendClientInviteEmail({
          to: connection.invited_email,
          agencyName: inviterOrg.name,
          inviteUrl
        })
      } else {
        // Client inviting agency - use agency invite template, show client name (inviter)
        const { sendAgencyInviteEmail } = await import('@/app/actions/sendAgencyInviteEmail')
        await sendAgencyInviteEmail({
          to: connection.invited_email,
          clientName: inviterOrg.name,
          inviteUrl
        })
      }
    } catch (emailError) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Error sending invitation email:', emailError)
      }
      return {
        success: false,
        error: emailError instanceof Error ? emailError.message : 'Failed to send invitation email'
      }
    }

    // Revalidate connection pages to reflect the changes
    revalidatePath(`/clients/${data.connectionId}`)
    revalidatePath(`/agencies/${data.connectionId}`)
    revalidatePath('/clients')
    revalidatePath('/agencies')

    return {
      success: true
    }
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Unexpected error resending invitation:', error)
    }
    return { success: false, error: 'An unexpected error occurred' }
  }
}

export async function cancelInvitation(data: {
  connectionId: string
}) {
  const supabase = await createClient()
  
  try {
    // Verify the user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { 
        success: false, 
        error: "Unauthorized" 
      }
    }

    // Get user's organization ID and type
    const { data: membership, error: membershipError } = await supabase
      .from('memberships')
      .select(`
        org_id,
        organizations!inner(id, type, owner_id)
      `)
      .eq('user_id', user.id)
      .is('organizations.is_draft', false)
      .single()

    let userOrgId: string | null = null
    let userOrgType: string | null = null

    if (membershipError || !membership) {
      // Fallback: check if user is owner
      const { data: ownerOrg, error: ownerError } = await supabase
        .from('organizations')
        .select('id, type')
        .eq('owner_id', user.id)
        .is('is_draft', false)
        .single()

      if (ownerError || !ownerOrg) {
        return {
          success: false,
          error: 'You must be a member of an organization'
        }
      }

      userOrgId = ownerOrg.id
      userOrgType = ownerOrg.type
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const org = (membership as any).organizations
      userOrgId = org.id
      userOrgType = org.type
    }

    if (!userOrgId || !userOrgType) {
      return {
        success: false,
        error: 'Organization not found'
      }
    }

    // Validate connection exists and belongs to user's org
    const { data: connection, error: connectionError } = await supabase
      .from('connections')
      .select('id, connection_status, agency_id, client_id')
      .eq('id', data.connectionId)
      .or(userOrgType === 'agency' 
        ? `agency_id.eq.${userOrgId}` 
        : `client_id.eq.${userOrgId}`)
      .single()

    if (connectionError || !connection) {
      return { 
        success: false, 
        error: "Connection not found or access denied" 
      }
    }

    // CRITICAL: Only allow cancel for invited connections
    if (connection.connection_status !== 'invited') {
      return { 
        success: false, 
        error: "Can only cancel invitations for invited connections" 
      }
    }

    // Clear invite fields
    // For agency-invited clients: set status back to internal (agency can edit internal)
    // For client-invited agencies: keep status as 'invited' (clients can't edit internal)
    const newStatus = userOrgType === 'agency' ? 'internal' : 'invited'
    
    const { error: updateError } = await supabase
      .from('connections')
      .update({
        invite_token: null,
        invited_email: null,
        invited_at: null,
        connection_status: newStatus
      })
      .eq('id', data.connectionId)

    if (updateError) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Error canceling invitation:', updateError)
      }
      return {
        success: false,
        error: 'Failed to cancel invitation'
      }
    }

    // Revalidate connection pages to reflect the changes
    revalidatePath(`/clients/${data.connectionId}`)
    revalidatePath(`/agencies/${data.connectionId}`)
    revalidatePath('/clients')
    revalidatePath('/agencies')

    return {
      success: true
    }
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Unexpected error canceling invitation:', error)
    }
    return { success: false, error: 'An unexpected error occurred' }
  }
}

export async function disconnectConnection(data: {
  connectionId: string
}) {
  const supabase = await createClient()
  
  try {
    // Verify the user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { 
        success: false, 
        error: "Unauthorized" 
      }
    }

    // Get user's organization ID and type
    const { data: membership, error: membershipError } = await supabase
      .from('memberships')
      .select(`
        org_id,
        organizations!inner(id, type, owner_id)
      `)
      .eq('user_id', user.id)
      .is('organizations.is_draft', false)
      .single()

    let userOrgId: string | null = null
    let userOrgType: string | null = null

    if (membershipError || !membership) {
      // Fallback: check if user is owner
      const { data: ownerOrg, error: ownerError } = await supabase
        .from('organizations')
        .select('id, type')
        .eq('owner_id', user.id)
        .is('is_draft', false)
        .single()

      if (ownerError || !ownerOrg) {
        return {
          success: false,
          error: 'You must be a member of an organization'
        }
      }

      userOrgId = ownerOrg.id
      userOrgType = ownerOrg.type
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const org = (membership as any).organizations
      userOrgId = org.id
      userOrgType = org.type
    }

    if (!userOrgId || !userOrgType) {
      return {
        success: false,
        error: 'Organization not found'
      }
    }

    // Validate connection exists and belongs to user's org
    const { data: connection, error: connectionError } = await supabase
      .from('connections')
      .select('id, connection_status, agency_id, client_id')
      .eq('id', data.connectionId)
      .or(userOrgType === 'agency' 
        ? `agency_id.eq.${userOrgId}` 
        : `client_id.eq.${userOrgId}`)
      .single()

    if (connectionError || !connection) {
      return { 
        success: false, 
        error: "Connection not found or access denied" 
      }
    }

    // CRITICAL: Only allow disconnect for connected connections
    if (connection.connection_status !== 'connected') {
      return { 
        success: false, 
        error: "Can only disconnect connected connections" 
      }
    }

    // Update connection status to disconnected
    const { error: updateError } = await supabase
      .from('connections')
      .update({
        connection_status: 'disconnected',
        disconnected_at: new Date().toISOString()
      })
      .eq('id', data.connectionId)

    if (updateError) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Error disconnecting connection:', updateError)
      }
      return {
        success: false,
        error: 'Failed to disconnect connection'
      }
    }

    // Revalidate connection pages to reflect the changes
    revalidatePath(`/clients/${data.connectionId}`)
    revalidatePath(`/agencies/${data.connectionId}`)
    revalidatePath(`/clients/${data.connectionId}/settings`)
    revalidatePath(`/agencies/${data.connectionId}/settings`)
    revalidatePath('/clients')
    revalidatePath('/agencies')

    return {
      success: true
    }
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Unexpected error disconnecting connection:', error)
    }
    return { success: false, error: 'An unexpected error occurred' }
  }
}

export async function reconnectConnection(data: {
  connectionId: string
  connectionCode: string
}) {
  const supabase = await createClient()
  
  try {
    // Verify the user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { 
        success: false, 
        error: "Unauthorized" 
      }
    }

    // Get user's organization ID and type
    const { data: membership, error: membershipError } = await supabase
      .from('memberships')
      .select(`
        org_id,
        organizations!inner(id, type, owner_id)
      `)
      .eq('user_id', user.id)
      .is('organizations.is_draft', false)
      .single()

    let userOrgId: string | null = null
    let userOrgType: string | null = null

    if (membershipError || !membership) {
      // Fallback: check if user is owner
      const { data: ownerOrg, error: ownerError } = await supabase
        .from('organizations')
        .select('id, type')
        .eq('owner_id', user.id)
        .is('is_draft', false)
        .single()

      if (ownerError || !ownerOrg) {
        return {
          success: false,
          error: 'You must be a member of an organization'
        }
      }

      userOrgId = ownerOrg.id
      userOrgType = ownerOrg.type
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const org = (membership as any).organizations
      userOrgId = org.id
      userOrgType = org.type
    }

    if (!userOrgId || !userOrgType) {
      return {
        success: false,
        error: 'Organization not found'
      }
    }

    // Validate connection exists and belongs to user's org
    const { data: connection, error: connectionError } = await supabase
      .from('connections')
      .select('id, connection_status, agency_id, client_id')
      .eq('id', data.connectionId)
      .or(userOrgType === 'agency' 
        ? `agency_id.eq.${userOrgId}` 
        : `client_id.eq.${userOrgId}`)
      .single()

    if (connectionError || !connection) {
      return { 
        success: false, 
        error: "Connection not found or access denied" 
      }
    }

    // CRITICAL: Only allow reconnect for disconnected connections
    if (connection.connection_status !== 'disconnected') {
      return { 
        success: false, 
        error: "Can only reconnect disconnected connections" 
      }
    }

    // Validate connection code matches partner organization's connection code
    const partnerOrgId = userOrgType === 'agency' ? connection.client_id : connection.agency_id
    const { data: partnerOrg, error: partnerOrgError } = await supabase
      .from('organizations')
      .select('connection_code')
      .eq('id', partnerOrgId)
      .single()

    if (partnerOrgError || !partnerOrg) {
      return {
        success: false,
        error: 'Partner organization not found'
      }
    }

    if (data.connectionCode.trim() !== partnerOrg.connection_code) {
      return {
        success: false,
        error: 'Invalid code. Please check and try again.'
      }
    }

    // Update connection status to connected
    const { data: updatedConnection, error: updateError } = await supabase
      .from('connections')
      .update({
        connection_status: 'connected',
        connected_at: new Date().toISOString(),
        disconnected_at: null
      })
      .eq('id', data.connectionId)
      .select('id')
      .maybeSingle()

    if (updateError) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Error reconnecting connection:', updateError)
      }
      return {
        success: false,
        error: 'Failed to reconnect connection'
      }
    }

    // Check if any rows were actually updated (RLS might block silently)
    if (!updatedConnection) {
      return {
        success: false,
        error: 'You do not have permission to reconnect this connection.'
      }
    }

    // Revalidate connection pages to reflect the changes
    revalidatePath(`/clients/${data.connectionId}`)
    revalidatePath(`/agencies/${data.connectionId}`)
    revalidatePath(`/clients/${data.connectionId}/settings`)
    revalidatePath(`/agencies/${data.connectionId}/settings`)
    revalidatePath('/clients')
    revalidatePath('/agencies')

    return {
      success: true
    }
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Unexpected error reconnecting connection:', error)
    }
    return { success: false, error: 'An unexpected error occurred' }
  }
}
