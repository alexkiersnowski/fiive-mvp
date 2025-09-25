import { redirect } from "next/navigation"
import OnboardingLayout from '@/components/layouts/OnboardingLayout'
import { handleProfileCreation } from '../actions'
import { getAuthenticatedUser } from '@/lib/onboarding/auth'
import { getProfileData } from '@/lib/onboarding/data'

export default async function ProfilePage() {
  // Check authentication (centralized, DRY)
  const user = await getAuthenticatedUser()
  
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
        firstName: profile.first_name || '',
        lastName: profile.last_name || '',
        jobTitle: profile.job_title || ''
      }}
    />
  )
}
