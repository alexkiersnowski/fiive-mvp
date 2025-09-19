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
  redirect('/onboarding/account-type')
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
export async function handleOrganizationDetails(data: { email: string } | { firstName: string; lastName: string; jobTitle?: string } | { organizationName: string; organizationType: string }) {
  // Type guard to ensure we have organization data
  if (!('organizationName' in data)) {
    throw new Error('This function only handles organization data')
  }
  
  const { organizationName, organizationType } = data
  
  // Basic validation
  if (!organizationName || organizationName.trim() === '') {
    throw new Error('Organization name is required')
  }
  
  if (!organizationType || (organizationType !== 'agency' && organizationType !== 'client')) {
    throw new Error('Organization type is required')
  }
  
  // TODO: Create organization record in database
  console.log('Organization details:', { organizationName, organizationType })
  
  // Redirect to next step (dashboard or completion)
  redirect('/dashboard')
}
