import type { Metadata } from 'next';
import { redirect } from "next/navigation"
import OnboardingLayout from '@/components/layouts/OnboardingLayout'
import { handleAccountTypeSelection } from '../../actions'
import { getAuthenticatedUser } from '@/lib/onboarding/auth'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Fiive | Create Account',
};

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

