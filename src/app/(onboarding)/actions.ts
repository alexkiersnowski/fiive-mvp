'use server'

import { redirect } from "next/navigation"
import { createClient } from '@/app/utils/supabase/server'

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
  
  // Basic validation
  if (!firstName || firstName.trim() === '') {
    throw new Error('First name is required')
  }
  
  if (!lastName || lastName.trim() === '') {
    throw new Error('Last name is required')
  }
  
  // Create Supabase client
  const supabase = await createClient()
  
  // Get the current user
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  
  if (userError || !user) {
    console.error('User authentication error:', userError)
    throw new Error('You must be logged in to create a profile')
  }
  
  console.log('User authenticated:', { id: user.id, email: user.email })
  
  // Update the existing user profile (profile was created during signup)
  const profileData = {
    first_name: firstName.trim(),
    last_name: lastName.trim(),
    job_title: jobTitle?.trim() || null,
    updated_at: new Date().toISOString()
  }
  
  console.log('Attempting to update profile for user:', user.id, 'with data:', profileData)
  
  const { data: result, error: profileError } = await supabase
    .from('profiles')
    .update(profileData)
    .eq('id', user.id)
    .select()
  
  if (profileError) {
    console.error('Profile update error details:', {
      error: profileError,
      user: user.id,
      email: user.email,
      firstName,
      lastName,
      jobTitle
    })
    throw new Error(`Failed to update profile: ${profileError.message}`)
  }
  
  console.log('Profile updated successfully:', result)
  
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
  console.log('=== ACTION STARTED ===')
  console.log('Action received data:', data)
  
  // Type guard to ensure we have organization data
  if (!('name' in data)) {
    console.log('Type guard failed - not organization data')
    throw new Error('This function only handles organization data')
  }
  
  const { name, agencyType, industry, logoUrl } = data
  
  // Basic validation
  if (!name || name.trim() === '') {
    throw new Error('Organization name is required')
  }
  
  // Determine organization type based on which field is present
  const organizationType = agencyType ? 'agency' : 'client'
  
  // Validate required fields based on type
  if (organizationType === 'agency' && (!agencyType || agencyType.trim() === '')) {
    throw new Error('Agency type is required')
  }
  
  if (organizationType === 'client' && (!industry || industry.trim() === '')) {
    throw new Error('Industry is required')
  }
  
  // Create Supabase client
  const supabase = await createClient()
  
  // Get the current user
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  
  if (userError || !user) {
    console.error('User authentication error:', userError)
    throw new Error('You must be logged in to create an organization')
  }
  
  console.log('Creating organization for user:', user.id, 'with data:', { name, organizationType, agencyType, industry, logoUrl })
  
  // Step 1: Create organization first (without logo URL) to get the ID
  console.log('=== CALLING CREATE_ORGANIZATION RPC ===')
  console.log('RPC Parameters:', {
    p_name: name.trim(),
    p_type: organizationType,
    p_industry: (organizationType === 'client' ? industry?.trim() : agencyType?.trim()) || null,
    p_logo_url: null
  })
  
  const { data: organizationId, error: rpcError } = await supabase.rpc('create_organization', {
    p_name: name.trim(),
    p_type: organizationType,
    p_industry: (organizationType === 'client' ? industry?.trim() : agencyType?.trim()) || null,
    p_logo_url: null // Create org first without logo
  })
  
  console.log('RPC Result:', { organizationId, rpcError })
  
  if (rpcError) {
    console.error('Organization creation RPC error:', {
      error: rpcError,
      user: user.id,
      name: name.trim(),
      type: organizationType,
      industry: organizationType === 'client' ? industry?.trim() : agencyType?.trim()
    })
    throw new Error(`Failed to create organization: ${rpcError.message}`)
  }
  
  console.log('Organization created successfully, org ID:', organizationId)
  
  // Step 2: If logo is provided, upload it using the organization ID
  if (logoUrl && logoUrl instanceof File) {
    try {
      console.log('Uploading new logo file:', { fileName: logoUrl.name, fileSize: logoUrl.size, fileType: logoUrl.type })
      
      const { uploadLogo } = await import('@/lib/supabase/storage')
      const logoUrlString = await uploadLogo(logoUrl, organizationId)
      
      console.log('Logo uploaded successfully, URL:', logoUrlString)
      
      // Step 3: Update organization with logo URL
      const { error: updateError } = await supabase
        .from('organizations')
        .update({ logo_url: logoUrlString })
        .eq('id', organizationId)
      
      if (updateError) {
        console.error('Failed to update organization with logo URL:', updateError)
        throw new Error(`Failed to update organization with logo: ${updateError.message}`)
      }
      
      console.log('Organization updated with logo URL successfully')
      
    } catch (logoError) {
      console.error('Failed to upload logo:', logoError)
      const errorMessage = logoError instanceof Error ? logoError.message : String(logoError)
      throw new Error(`Failed to upload logo: ${errorMessage}`)
    }
  } else if (logoUrl && typeof logoUrl === 'string') {
    // logoUrl is already a URL string (existing logo), just update the organization
    console.log('Using existing logo URL:', logoUrl)
    
    const { error: updateError } = await supabase
      .from('organizations')
      .update({ logo_url: logoUrl })
      .eq('id', organizationId)
    
    if (updateError) {
      console.error('Failed to update organization with existing logo URL:', updateError)
      throw new Error(`Failed to update organization with logo: ${updateError.message}`)
    }
    
    console.log('Organization updated with existing logo URL successfully')
  } else {
    console.log('No logo provided')
  }
  
  console.log('Organization creation/update completed successfully, org ID:', organizationId)
  
  // Redirect to next step (dashboard or completion)
  redirect('/dashboard')
}
