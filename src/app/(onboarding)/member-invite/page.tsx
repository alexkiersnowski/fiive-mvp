import { redirect } from "next/navigation"
import OnboardingLayout from '@/components/layouts/OnboardingLayout'
import { handleProfileCreation } from '../actions'
import { getAuthenticatedUser } from '@/lib/onboarding/auth'
import { getProfileData } from '@/lib/onboarding/data'
import { createClient } from '@/lib/supabase/server'

// Force fresh data on every request to ensure updated user data is shown immediately
export const revalidate = 0

interface MemberInvitePageProps {
  searchParams: { org_id?: string }
}

export default async function MemberInvitePage({ searchParams }: MemberInvitePageProps) {
  console.log('[member-invite] Page loading...')
  
  // Check authentication (centralized, DRY)
  const user = await getAuthenticatedUser()
  console.log('[member-invite] User authenticated:', user.email)
  
  // Load existing profile data (optimized query)
  const profile = await getProfileData(user.id)
  console.log('[member-invite] Profile exists:', !!profile)
  
  // For invited users, profile might not exist yet or RLS might block access
  // This is normal - they'll create their profile through this form

  // Get organization name from user metadata or URL params
  let organizationName = "[Org Name]"
  
  // First try to get from user metadata (from Supabase invite)
  if (user.user_metadata?.organization_name) {
    organizationName = user.user_metadata.organization_name
  }
  // Fallback to URL param lookup if no metadata
  else if (searchParams.org_id) {
    try {
      const supabase = await createClient()
      const { data: organization, error } = await supabase
        .from('organizations')
        .select('name')
        .eq('id', searchParams.org_id)
        .single()

      if (!error && organization?.name) {
        organizationName = organization.name
      }
    } catch (error) {
      console.error('Error fetching organization name:', error)
      // Fall back to placeholder if there's an error
    }
  }
  
  return (
    <OnboardingLayout
      title={`${organizationName} has invited you to join their team`}
      buttonText="Join organization"
      onSubmit={handleProfileCreation}
      showForm={true}
      formType="profile"
      showBackButton={false}
      initialData={{
        firstName: profile?.first_name || '',
        lastName: profile?.last_name || '',
        jobTitle: profile?.job_title || ''
      }}
    />
  )
}
