import type { Metadata } from 'next';
import { redirect } from "next/navigation"
import OnboardingLayout from '@/components/layouts/OnboardingLayout'
import { handleProfileCreation } from '../../actions'
import { getAuthenticatedUser } from '@/lib/onboarding/auth'
import { getProfileData } from '@/lib/onboarding/data'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Fiive | Create Account',
};

// Force fresh data on every request to ensure updated user data is shown immediately
export const revalidate = 0

export default async function ProfilePage() {
  // Check authentication (centralized, DRY)
  const user = await getAuthenticatedUser()
  
  // Protect signup flow - if user already owns an org OR has membership, redirect to home
  const supabase = await createClient()
  const [orgResult, membershipResult] = await Promise.all([
    supabase
      .from('organizations')
      .select('id')
      .eq('owner_id', user.id)
      .is('is_draft', false)
      .maybeSingle(),
    supabase
      .from('memberships')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()
  ])
  
  if (orgResult.data || membershipResult.data) {
    redirect('/home') // Already belongs to an org
  }
  
  // Load existing profile data (optimized query)
  const profile = await getProfileData(user.id)
  
  // If profile doesn't exist, redirect to signup
  if (!profile) {
    redirect('/signup')
  }
  
  return (
    <OnboardingLayout
      title="Create your account"
      buttonText="Continue"
      onSubmit={handleProfileCreation}
      showForm={true}
      formType="profile"
      showBackButton={false}
      initialData={{
        email: '', // Included for form state management, but won't display (empty string)
        firstName: profile.first_name || '',
        lastName: profile.last_name || '',
        jobTitle: profile.job_title || ''
      }}
    />
  )
}

