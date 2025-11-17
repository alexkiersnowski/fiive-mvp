import { redirect } from "next/navigation"
import OnboardingLayout from '@/components/layouts/OnboardingLayout'
import { handleClaimProfileUpdate } from '../../actions'
import { getAuthenticatedUser } from '@/lib/onboarding/auth'
import { getProfileData, getPartnerOrgNameForClaimedOrg } from '@/lib/onboarding/data'
import { verifyInviteToken } from '@/lib/tokens/verifyInviteToken'
import { createClient } from '@/lib/supabase/server'

// Force fresh data on every request to ensure updated user data is shown immediately
export const revalidate = 0

interface ClaimProfilePageProps {
  searchParams: Promise<{ token?: string }>
}

export default async function ClaimProfilePage({ searchParams }: ClaimProfilePageProps) {
  const resolvedSearchParams = await searchParams
  const token = resolvedSearchParams.token

  // Get authenticated user - account already created via claim flow
  const user = await getAuthenticatedUser()

  // Protect claim flow - require valid token OR user must own a claimed org
  if (token) {
    // Verify token if provided
    const tokenResult = await verifyInviteToken(token)
    if (!tokenResult.success) {
      redirect('/home') // Invalid/expired token = not allowed
    }
  } else {
    // No token - check if user owns a claimed org (continuing flow after auth)
    const supabase = await createClient()
    const { data: org } = await supabase
      .from('organizations')
      .select('id, claimed_at')
      .eq('owner_id', user.id)
      .is('is_draft', false)
      .maybeSingle()
    
    if (!org || !org.claimed_at) {
      redirect('/home') // No token and doesn't own claimed org = not allowed
    }
  }
  
  // Load existing profile data (profile was auto-created via database trigger)
  // The user is updating their existing profile, not creating a new one
  const profile = await getProfileData(user.id)
  
  // Profile should exist (created automatically), but if it doesn't, redirect to signup
  if (!profile) {
    redirect('/signup')
  }

  // Fetch partner organization name for the claimed organization
  // Works for both clients claiming (shows agency name) and agencies claiming (shows client name)
  const partnerOrgName = await getPartnerOrgNameForClaimedOrg(user.id)
  
  // Set title based on whether we have a partner org name
  const title = partnerOrgName 
    ? `You've been invited by\n${partnerOrgName}`
    : "Create your account"

  // Get email from authenticated user (email is stored in auth.users, not profiles table)
  // This is the email that was entered by the agency when inviting the client
  // The user account was already created in the claim flow, so email should always be present
  const userEmail = user.email

  if (!userEmail) {
    // This shouldn't happen, but handle gracefully
    console.error('User email not found for authenticated user:', user.id)
  }

  return (
    <OnboardingLayout
      title={title}
      buttonText="Continue"
      onSubmit={handleClaimProfileUpdate}
      showForm={true}
      formType="profile"
      showBackButton={false}
      initialData={{
        email: userEmail || '',
        firstName: profile.first_name || '',
        lastName: profile.last_name || '',
        jobTitle: profile.job_title || ''
      }}
    />
  )
}
