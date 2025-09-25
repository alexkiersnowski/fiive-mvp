'use server'

import { redirect } from "next/navigation"
import { createClient } from '@/lib/supabase/server'

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

// Profile actions
export async function handleProfileCreation(data: { email: string } | { firstName: string; lastName: string; jobTitle?: string } | { name: string; agencyType?: string; industry?: string } | { accountType: string }) {
  // Type guard to ensure we have profile data
  if ('email' in data) {
    throw new Error('This function only handles profile data, not auth data')
  }
  
  // Add this type guard for profile data
  if (!('firstName' in data)) {
    throw new Error('This function only handles profile data')
  }
  
  const { firstName, lastName, jobTitle } = data
  
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
  
  const { data: profileData, error: profileError } = result as { data: unknown; error: unknown }
  
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
  
  
  // Redirect to next step (account type selection)
  redirect('/account-type')
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
  redirect(`/organization-details?type=${accountType}`)
}

// Organization actions
export async function handleOrganizationDetails(data: { email: string } | { firstName: string; lastName: string; jobTitle?: string } | { name: string; agencyType?: string; industry?: string; logoUrl?: string | File } | { accountType: string }) {
  // Type guard to ensure we have organization data
  if (!('name' in data)) {
    throw new Error('This function only handles organization data')
  }
  
  const { name, agencyType, industry, logoUrl } = data
  
  // Sanitize inputs
  const sanitizedName = sanitizeInput(name)
  const sanitizedAgencyType = agencyType ? sanitizeInput(agencyType) : null
  const sanitizedIndustry = industry ? sanitizeInput(industry) : null
  
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
  
  
  // Step 2: If logo is provided, upload it using the organization ID
  if (logoUrl && logoUrl instanceof File) {
    try {
      
      const { uploadLogo } = await import('@/lib/supabase/storage')
      const logoUrlString = await uploadLogo(logoUrl, organizationId)
      
      
      // Step 3: Update organization with logo URL
      const updateResult = await withTimeout(
        supabase
          .from('organizations')
          .update({ logo_url: logoUrlString })
          .eq('id', organizationId),
        3000 // 3 second timeout for organization updates
      )
      
      const { error: updateError } = updateResult as { error: unknown }
      
      if (updateError) {
        console.error('Failed to update organization with logo URL:', updateError)
        throw new Error(`Failed to update organization with logo: ${updateError instanceof Error ? updateError.message : String(updateError)}`)
      }
      
      
    } catch (logoError) {
      console.error('Failed to upload logo:', logoError)
      const errorMessage = logoError instanceof Error ? logoError.message : String(logoError)
      throw new Error(`Failed to upload logo: ${errorMessage}`)
    }
  } else if (logoUrl && typeof logoUrl === 'string') {
    // logoUrl is already a URL string (existing logo), just update the organization
    
    const updateResult = await withTimeout(
      supabase
        .from('organizations')
        .update({ logo_url: logoUrl })
        .eq('id', organizationId),
      3000 // 3 second timeout for organization updates
    )
    
    const { error: updateError } = updateResult as { error: unknown }
    
    if (updateError) {
      console.error('Failed to update organization with existing logo URL:', updateError)
      throw new Error(`Failed to update organization with logo: ${updateError instanceof Error ? updateError.message : String(updateError)}`)
    }
    
  }
  
  // Redirect to next step (dashboard home)
  redirect('/home')
}
