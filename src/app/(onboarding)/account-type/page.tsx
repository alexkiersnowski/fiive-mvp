import OnboardingLayout from '@/components/layouts/OnboardingLayout'
import { handleAccountTypeSelection } from '../actions'
import { getAuthenticatedUser } from '@/lib/onboarding/auth'

// Force fresh data on every request to ensure updated user data is shown immediately
export const revalidate = 0

export default async function AccountTypePage({ 
  searchParams 
}: { 
  searchParams: Promise<{ type?: string }> 
}) {
  const resolvedSearchParams = await searchParams
  const urlType = resolvedSearchParams.type // 'agency' or 'client' from URL
  
  // Check authentication (centralized, DRY)
  await getAuthenticatedUser()

  return (
    <OnboardingLayout
      title="Choose your account type"
      buttonText="Continue"
      onSubmit={handleAccountTypeSelection}
      formKey="account-type-form"
      showForm={true}
      formType="accountType"
      showBackButton={true}
      initialData={{
        accountType: urlType || ''
      }}
      // Pass the URL type to be stored in session storage
      urlAccountType={urlType}
    />
  )
}
