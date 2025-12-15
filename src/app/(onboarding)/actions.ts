'use server'

import { redirect } from "next/navigation"
import { createClient, createAdminClient } from '@/lib/supabase/server'

// Timeout wrapper for server actions
async function withTimeout<T>(query: Promise<T> | T, timeoutMs: number = 5000): Promise<T> {
  const promise = query instanceof Promise ? query : Promise.resolve(query)
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Request timeout')), timeoutMs)
  })
  
  return Promise.race([promise, timeoutPromise])
}

// Input sanitization utility
function sanitizeInput(input: string): string {
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
    .slice(0, 255) // Limit length to prevent buffer overflow
}

// Sanitization utility for description fields (no length limit)
function sanitizeDescription(input: string): string {
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
    // No length limit - descriptions can be longer
}

// Profile actions
export async function handleProfileCreation(data: { email?: string; firstName: string; lastName: string; jobTitle?: string; avatarFile?: File } | { email: string } | { name: string; agencyType?: string; industry?: string } | { accountType: string }) {
  // Type guard to ensure we have profile data
  // Note: email may be present in data (read-only field), but we ignore it
  if (!('firstName' in data)) {
    throw new Error('This function only handles profile data')
  }
  
  // Extract profile fields, ignoring email if present (it's read-only)
  const { firstName, lastName, jobTitle, avatarFile } = data as { firstName: string; lastName: string; jobTitle?: string; avatarFile?: File; email?: string }
  
  // Sanitize inputs
  const sanitizedFirstName = sanitizeInput(firstName)
  const sanitizedLastName = sanitizeInput(lastName)
  const sanitizedJobTitle = jobTitle ? sanitizeInput(jobTitle) : null
  
  // Basic validation
  if (!sanitizedFirstName) {
    throw new Error('First name is required')
  }
  
  if (!sanitizedLastName) {
    throw new Error('Last name is required')
  }
  
  // Create Supabase client
  const supabase = await createClient()
  
  // Get the current user (centralized auth)
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  
  if (userError || !user) {
    console.error('User authentication error:', userError)
    throw new Error('You must be logged in to create a profile')
  }
  
  // Update the existing user profile (profile was created during signup)
  const profileUpdateData = {
    first_name: sanitizedFirstName,
    last_name: sanitizedLastName,
    job_title: sanitizedJobTitle,
    updated_at: new Date().toISOString()
  }
  
  const result = await withTimeout(
    supabase
      .from('profiles')
      .update(profileUpdateData)
      .eq('id', user.id)
      .select(),
    3000 // 3 second timeout for profile updates
  )
  
  const { data: _profileData, error: profileError } = result as { data: unknown; error: unknown }
  
  if (profileError) {
    console.error('Profile update error details:', {
      error: profileError,
      user: user.id,
      email: user.email,
      firstName,
      lastName,
      jobTitle
    })
    throw new Error(`Failed to update profile: ${profileError instanceof Error ? profileError.message : String(profileError)}`)
  }
  
  // Upload avatar if provided
  if (avatarFile) {
    try {
      const { uploadAvatar } = await import('@/lib/supabase/storage')
      const avatarUrl = await uploadAvatar(avatarFile, user.id)
      
      // Update profile with avatar URL
      const avatarResult = await withTimeout(
        supabase
          .from('profiles')
          .update({ avatar_url: avatarUrl })
          .eq('id', user.id),
        3000
      )
      
      const { error: avatarError } = avatarResult as { error: unknown }
      
      if (avatarError) {
        console.error('Failed to update profile with avatar URL:', avatarError)
        // Don't throw error here - profile was updated successfully, avatar is optional
      }
    } catch (avatarUploadError) {
      console.error('Failed to upload avatar:', avatarUploadError)
      // Don't throw error here - profile was updated successfully, avatar is optional
    }
  }
  
  // Redirect to next step (account type selection)
  redirect('/signup/account-type')
}

// Member invite completion action
export async function handleMemberInviteCompletion(data: { email?: string; firstName: string; lastName: string; jobTitle?: string; avatarFile?: File } | { email: string } | { name: string; agencyType?: string; industry?: string } | { accountType: string }) {
  // Type guard to ensure we have profile data
  // Note: email may be present in data (read-only field), but we ignore it
  if (!('firstName' in data)) {
    throw new Error('This function only handles profile data')
  }
  
  // Extract profile fields, ignoring email if present (it's read-only)
  const { firstName, lastName, jobTitle } = data as { firstName: string; lastName: string; jobTitle?: string; email?: string }
  
  // Sanitize inputs
  const sanitizedFirstName = sanitizeInput(firstName)
  const sanitizedLastName = sanitizeInput(lastName)
  const sanitizedJobTitle = jobTitle ? sanitizeInput(jobTitle) : null
  
  // Basic validation
  if (!sanitizedFirstName) {
    throw new Error('First name is required')
  }
  
  if (!sanitizedLastName) {
    throw new Error('Last name is required')
  }
  
  // Create Supabase client
  const supabase = await createClient()
  
  // Get the current user (centralized auth)
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  
  if (userError || !user) {
    console.error('User authentication error:', userError)
    throw new Error('You must be logged in to complete the invitation')
  }
  
  const userEmail = user.email
  
  if (!userEmail) {
    throw new Error('Invalid user: email information missing')
  }
  
  // Get organization ID from membership (user is already a member from claim flow)
  const { data: membership, error: membershipError } = await supabase
    .from('memberships')
    .select('org_id')
    .eq('user_id', user.id)
    .single()
  
  if (membershipError || !membership) {
    console.error('Membership lookup error:', membershipError)
    throw new Error('You must be a member of an organization to complete the invitation')
  }
  
  const organizationId = membership.org_id
  
  console.log('[handleMemberInviteCompletion] Processing invitation for:', {
    userId: user.id,
    userEmail,
    organizationId,
    firstName: sanitizedFirstName,
    lastName: sanitizedLastName,
    jobTitle: sanitizedJobTitle
  })
  
  // Step 1: Update the user profile
  const profileUpdateData = {
    first_name: sanitizedFirstName,
    last_name: sanitizedLastName,
    job_title: sanitizedJobTitle,
    updated_at: new Date().toISOString()
  }
  
  const profileResult = await withTimeout(
    supabase
      .from('profiles')
      .update(profileUpdateData)
      .eq('id', user.id)
      .select(),
    3000
  )
  
  const { data: _profileData, error: profileError } = profileResult as { data: unknown; error: unknown }
  
  if (profileError) {
    console.error('Profile update error details:', {
      error: profileError,
      user: user.id,
      email: user.email,
      firstName: sanitizedFirstName,
      lastName: sanitizedLastName,
      jobTitle: sanitizedJobTitle
    })
    throw new Error(`Failed to update profile: ${profileError instanceof Error ? profileError.message : String(profileError)}`)
  }
  
  console.log('[handleMemberInviteCompletion] Profile updated successfully')
  
  // Step 2: Verify invitation exists and update status if needed
  // Note: In the new flow, membership and invitation status are already handled in the claim flow
  // But we check here to ensure consistency and handle edge cases
  const adminSupabase = createAdminClient()
  
  const { data: validInvitation, error: invitationError } = await adminSupabase
    .from('membership_invitations')
    .select('id, org_id, invited_email, status, expires_at')
    .eq('org_id', organizationId)
    .eq('invited_email', userEmail)
    .in('status', ['pending', 'accepted'])
    .single()
  
  if (!invitationError && validInvitation) {
    // If invitation is still pending, update it to accepted (shouldn't happen in normal flow, but handle it)
    if (validInvitation.status === 'pending') {
      const invitationUpdateResult = await withTimeout(
        adminSupabase
          .from('membership_invitations')
          .update({ 
            status: 'accepted',
            accepted_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', validInvitation.id)
          .select(),
        3000
      )
      
      const { error: invitationUpdateError } = invitationUpdateResult as { data: unknown; error: unknown }
      
      if (invitationUpdateError) {
        console.warn('[handleMemberInviteCompletion] Warning: Failed to update invitation status, but profile was updated')
      } else {
        console.log('[handleMemberInviteCompletion] Invitation status updated to accepted')
      }
    }
  } else {
    // Invitation not found - this is okay, user might have been added directly or invitation was already cleaned up
    console.warn('[handleMemberInviteCompletion] Warning: No invitation found, but continuing with profile update')
  }
  
  console.log('[handleMemberInviteCompletion] Member invite completion successful, redirecting to dashboard')
  
  // Step 5: Redirect to dashboard home
  redirect('/home')
}

// Account type actions
export async function handleAccountTypeSelection(data: { email: string } | { firstName: string; lastName: string; jobTitle?: string } | { name: string; agencyType?: string; industry?: string } | { accountType: string }) {
  // Type guard to ensure we have account type data
  if (!('accountType' in data)) {
    throw new Error('This function only handles account type data')
  }
  
  const { accountType } = data
  
  // Basic validation
  if (!accountType || (accountType !== 'agency' && accountType !== 'client')) {
    throw new Error('Please select an account type')
  }
  
  // Redirect to organization details with the selected type
  redirect(`/signup/organization-details?type=${accountType}`)
}

// Organization actions
export async function handleOrganizationDetails(data: { email: string } | { firstName: string; lastName: string; jobTitle?: string } | { name: string; agencyType?: string; industry?: string; website?: string; logoUrl?: string | File } | { accountType: string }) {
  // Type guard to ensure we have organization data
  if (!('name' in data)) {
    throw new Error('This function only handles organization data')
  }
  
  const { name, agencyType, industry, website, logoUrl } = data as { name: string; agencyType?: string; industry?: string; website?: string; logoUrl?: string | File }
  
  // Sanitize inputs
  const sanitizedName = sanitizeInput(name)
  const sanitizedAgencyType = agencyType ? sanitizeInput(agencyType) : null
  const sanitizedIndustry = industry ? sanitizeInput(industry) : null
  
  // Normalize website URL for storage (adds https://, removes www.)
  const normalizeWebsiteForStorage = (url: string | undefined): string | undefined => {
    if (!url || url.trim() === '') return undefined
    
    const trimmed = url.trim()
    let cleanDomain = trimmed
    
    // Remove protocol if present
    if (cleanDomain.startsWith('http://')) {
      cleanDomain = cleanDomain.replace('http://', '')
    } else if (cleanDomain.startsWith('https://')) {
      cleanDomain = cleanDomain.replace('https://', '')
    }
    
    // Remove www. if present
    if (cleanDomain.startsWith('www.')) {
      cleanDomain = cleanDomain.replace('www.', '')
    }
    
    // Return standardized format: https://domain.com
    return `https://${cleanDomain}`
  }
  
  const normalizedWebsite = website ? normalizeWebsiteForStorage(website) : undefined
  
  // Basic validation
  if (!sanitizedName) {
    throw new Error('Organization name is required')
  }
  
  // Determine organization type based on which field is present
  const organizationType = sanitizedAgencyType ? 'agency' : 'client'
  
  // Validate required fields based on type
  if (organizationType === 'agency' && !sanitizedAgencyType) {
    throw new Error('Agency type is required')
  }
  
  if (organizationType === 'client' && !sanitizedIndustry) {
    throw new Error('Industry is required')
  }
  
  // Create Supabase client
  const supabase = await createClient()
  
  // Get the current user (centralized auth)
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  
  if (userError || !user) {
    console.error('User authentication error:', userError)
    throw new Error('You must be logged in to create an organization')
  }
  
  // Step 1: Create organization first (without logo URL) to get the ID
  
  const rpcResult = await withTimeout(
    supabase.rpc('create_organization', {
      p_name: sanitizedName,
      p_type: organizationType,
      p_industry: (organizationType === 'client' ? sanitizedIndustry : sanitizedAgencyType) || null,
      p_logo_url: null // Create org first without logo
    }),
    5000 // 5 second timeout for organization creation
  )
  
  const { data: organizationId, error: rpcError } = rpcResult as { data: string; error: unknown }
  
  
  if (rpcError) {
    console.error('Organization creation RPC error:', {
      error: rpcError,
      user: user.id,
      name: name.trim(),
      type: organizationType,
      industry: organizationType === 'client' ? industry?.trim() : agencyType?.trim()
    })
    throw new Error(`Failed to create organization: ${rpcError instanceof Error ? rpcError.message : String(rpcError)}`)
  }
  
  
  // Step 2: Prepare update data for website and logo
  const updateData: { logo_url?: string; website?: string } = {}
  
  // Add website if provided
  if (normalizedWebsite !== undefined) {
    updateData.website = normalizedWebsite
  }
  
  // Step 3: If logo is provided, upload it using the organization ID
  if (logoUrl && logoUrl instanceof File) {
    try {
      
      const { uploadLogo } = await import('@/lib/supabase/storage')
      const logoUrlString = await uploadLogo(logoUrl, organizationId)
      updateData.logo_url = logoUrlString
      
    } catch (logoError) {
      console.error('Failed to upload logo:', logoError)
      const errorMessage = logoError instanceof Error ? logoError.message : String(logoError)
      throw new Error(`Failed to upload logo: ${errorMessage}`)
    }
  } else if (logoUrl && typeof logoUrl === 'string') {
    // logoUrl is already a URL string (existing logo)
    updateData.logo_url = logoUrl
  }
  
  // Step 4: Update organization with logo URL and/or website if any updates are needed
  if (Object.keys(updateData).length > 0) {
    const updateResult = await withTimeout(
      supabase
        .from('organizations')
        .update(updateData)
        .eq('id', organizationId),
      3000 // 3 second timeout for organization updates
    )
    
    const { error: updateError } = updateResult as { error: unknown }
    
    if (updateError) {
      console.error('Failed to update organization:', updateError)
      throw new Error(`Failed to update organization: ${updateError instanceof Error ? updateError.message : String(updateError)}`)
    }
  }
  
  // Redirect to next step (dashboard home)
  redirect('/home')
}

// Claim profile update action
export async function handleClaimProfileUpdate(data: { email?: string; firstName: string; lastName: string; jobTitle?: string; avatarFile?: File } | { email: string } | { name: string; agencyType?: string; industry?: string } | { accountType: string }) {
  // Type guard to ensure we have profile data
  // Note: email may be present in data (read-only field), but we ignore it
  if (!('firstName' in data)) {
    throw new Error('This function only handles profile data')
  }
  
  // Extract profile fields, ignoring email if present (it's read-only)
  const { firstName, lastName, jobTitle, avatarFile } = data as { firstName: string; lastName: string; jobTitle?: string; avatarFile?: File; email?: string }
  
  // Sanitize inputs
  const sanitizedFirstName = sanitizeInput(firstName)
  const sanitizedLastName = sanitizeInput(lastName)
  const sanitizedJobTitle = jobTitle ? sanitizeInput(jobTitle) : null
  
  // Basic validation
  if (!sanitizedFirstName) {
    throw new Error('First name is required')
  }
  
  if (!sanitizedLastName) {
    throw new Error('Last name is required')
  }
  
  // Create Supabase client
  const supabase = await createClient()
  
  // Get the current user (centralized auth)
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  
  if (userError || !user) {
    console.error('User authentication error:', userError)
    throw new Error('You must be logged in to update your profile')
  }
  
  // Update the existing user profile (profile was created via trigger)
  const profileUpdateData = {
    first_name: sanitizedFirstName,
    last_name: sanitizedLastName,
    job_title: sanitizedJobTitle,
    updated_at: new Date().toISOString()
  }
  
  const result = await withTimeout(
    supabase
      .from('profiles')
      .update(profileUpdateData)
      .eq('id', user.id)
      .select(),
    3000 // 3 second timeout for profile updates
  )
  
  const { data: _profileData, error: profileError } = result as { data: unknown; error: unknown }
  
  if (profileError) {
    // Extract error message from Supabase error object
    const supabaseError = profileError as { message?: string; code?: string; details?: string; hint?: string }
    const errorMessage = supabaseError.message 
      || supabaseError.details
      || (profileError instanceof Error ? profileError.message : JSON.stringify(profileError))
    
    console.error('Profile update error details:', {
      error: profileError,
      errorMessage,
      errorCode: supabaseError.code,
      user: user.id,
      email: user.email,
      firstName,
      lastName,
      jobTitle
    })
    throw new Error(`Failed to update profile: ${errorMessage}`)
  }
  
  // Upload avatar if provided
  if (avatarFile) {
    try {
      const { uploadAvatar } = await import('@/lib/supabase/storage')
      const avatarUrl = await uploadAvatar(avatarFile, user.id)
      
      // Update profile with avatar URL
      const avatarResult = await withTimeout(
        supabase
          .from('profiles')
          .update({ avatar_url: avatarUrl })
          .eq('id', user.id),
        3000
      )
      
      const { error: avatarError } = avatarResult as { error: unknown }
      
      if (avatarError) {
        console.error('Failed to update profile with avatar URL:', avatarError)
        // Don't throw error here - profile was updated successfully, avatar is optional
      }
    } catch (avatarUploadError) {
      console.error('Failed to upload avatar:', avatarUploadError)
      // Don't throw error here - profile was updated successfully, avatar is optional
    }
  }
  
  // Redirect to organization details (no token)
  redirect('/claim/organization-details')
}

// Claim organization update action
export async function handleClaimOrganizationUpdate(data: { email: string } | { firstName: string; lastName: string; jobTitle?: string } | { name: string; agencyType?: string; industry?: string; logoUrl?: string | File } | { accountType: string }) {
  // Type guard to ensure we have organization data
  if (!('name' in data)) {
    throw new Error('This function only handles organization data')
  }
  
  const { name, agencyType, industry, website, description, logoUrl } = data as { name: string; agencyType?: string; industry?: string; website?: string; description?: string; logoUrl?: string | File }
  
  // Sanitize inputs
  const sanitizedName = sanitizeInput(name)
  const sanitizedAgencyType = agencyType ? sanitizeInput(agencyType) : null
  const sanitizedIndustry = industry ? sanitizeInput(industry) : null
  // Normalize description: remove line breaks, sanitize (no length limit)
  const sanitizedDescription = description 
    ? sanitizeDescription(description.replace(/\r?\n/g, ' ')) || null
    : null
  
  // Normalize website URL for storage (adds https://, removes www.)
  const normalizeWebsiteForStorage = (url: string | undefined): string | undefined => {
    if (!url || url.trim() === '') return undefined
    
    const trimmed = url.trim()
    let cleanDomain = trimmed
    
    // Remove protocol if present
    if (cleanDomain.startsWith('http://')) {
      cleanDomain = cleanDomain.replace('http://', '')
    } else if (cleanDomain.startsWith('https://')) {
      cleanDomain = cleanDomain.replace('https://', '')
    }
    
    // Remove www. if present
    if (cleanDomain.startsWith('www.')) {
      cleanDomain = cleanDomain.replace('www.', '')
    }
    
    // Return standardized format: https://domain.com
    return `https://${cleanDomain}`
  }
  
  const normalizedWebsite = website ? normalizeWebsiteForStorage(website) : undefined
  
  // Basic validation
  if (!sanitizedName) {
    throw new Error('Organization name is required')
  }
  
  // Create Supabase client
  const supabase = await createClient()
  
  // Get the current user (centralized auth)
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  
  if (userError || !user) {
    console.error('User authentication error:', userError)
    throw new Error('You must be logged in to update the organization')
  }

  // Load organization via owner_id (ownership is tracked in organizations.owner_id, not memberships.role)
  // Claimed organizations set owner_id to the claiming user's ID
  const { data: organization, error: orgLoadError } = await supabase
    .from('organizations')
    .select('id, type')
    .eq('owner_id', user.id)
    .is('is_draft', false)
    .maybeSingle()

  if (orgLoadError || !organization) {
    console.error('Error loading organization:', orgLoadError)
    throw new Error('Organization not found')
  }

  // Determine organization type and validate appropriate field
  const isAgency = organization.type === 'agency'
  
  if (isAgency && !sanitizedAgencyType) {
    throw new Error('Agency type is required')
  }
  
  if (!isAgency && !sanitizedIndustry) {
    throw new Error('Industry is required')
  }

  // Use the appropriate field value (both are stored in the industry column)
  const industryValue = isAgency ? sanitizedAgencyType : sanitizedIndustry

  // Prepare organization update data (only update name, industry, website, description, logo - claim already done)
  const organizationUpdateData: {
    name: string
    industry: string
    website?: string
    description?: string
    updated_at: string
    logo_url?: string
  } = {
    name: sanitizedName,
    industry: industryValue!,
    updated_at: new Date().toISOString()
  }
  
  // Add website and description if provided
  if (normalizedWebsite !== undefined) {
    organizationUpdateData.website = normalizedWebsite
  }
  if (sanitizedDescription !== null) {
    organizationUpdateData.description = sanitizedDescription || undefined
  }

  // Handle logo upload if provided
  if (logoUrl && logoUrl instanceof File) {
    try {
      const { uploadLogo } = await import('@/lib/supabase/storage')
      const logoUrlString = await uploadLogo(logoUrl, organization.id)
      organizationUpdateData.logo_url = logoUrlString
    } catch (logoError) {
      console.error('Failed to upload logo:', logoError)
      throw new Error(`Failed to upload logo: ${logoError instanceof Error ? logoError.message : String(logoError)}`)
    }
  } else if (logoUrl && typeof logoUrl === 'string') {
    // logoUrl is already a URL string (existing logo)
    organizationUpdateData.logo_url = logoUrl
  }

  // Update organization
  const orgUpdateResult = await withTimeout(
    supabase
      .from('organizations')
      .update(organizationUpdateData)
      .eq('id', organization.id)
      .select(),
    3000
  )

  const { error: orgUpdateError } = orgUpdateResult as { error: unknown }

  if (orgUpdateError) {
    console.error('Organization update error:', {
      error: orgUpdateError,
      orgId: organization.id,
      userId: user.id
    })
    throw new Error(`Failed to update organization: ${orgUpdateError instanceof Error ? orgUpdateError.message : String(orgUpdateError)}`)
  }

  // Redirect to dashboard home
  redirect('/home')
}

