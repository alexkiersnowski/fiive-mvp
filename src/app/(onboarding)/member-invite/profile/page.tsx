import type { Metadata } from 'next';
import { redirect } from "next/navigation"
import OnboardingLayout from '@/components/layouts/OnboardingLayout'
import { handleMemberInviteCompletion } from '../../actions'
import { getAuthenticatedUser } from '@/lib/onboarding/auth'
import { getProfileData } from '@/lib/onboarding/data'
import { createClient } from '@/lib/supabase/server'
import { verifyMemberInviteToken } from '@/lib/tokens/verifyMemberInviteToken'

export const metadata: Metadata = {
  title: 'Fiive | Join Team',
};

// Force fresh data on every request to ensure updated user data is shown immediately
export const revalidate = 0

interface MemberInvitePageProps {
  searchParams: Promise<{ token?: string }>
}

export default async function MemberInvitePage({ searchParams }: MemberInvitePageProps) {
  const resolvedSearchParams = await searchParams
  const token = resolvedSearchParams.token

  console.log('[member-invite] Page loading...')
  
  // Check authentication (centralized, DRY)
  const user = await getAuthenticatedUser()

  // Protect member-invite flow - token ALWAYS required
  if (!token) {
    redirect('/home') // Token always required
  }

  // Verify token
  const tokenResult = await verifyMemberInviteToken(token)
  if (!tokenResult.success) {
    redirect('/home') // Invalid/expired token = not allowed
  }

  // Extra protection: if user is owner, redirect (owners can't access member-invite)
  const supabase = await createClient()
  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('owner_id', user.id)
    .is('is_draft', false)
    .maybeSingle()
  
  if (org) {
    redirect('/home') // Owners can't access member-invite
  }

  console.log('[member-invite] User authenticated:', user.email)
  
  // Load existing profile data (optimized query)
  const profile = await getProfileData(user.id)
  console.log('[member-invite] Profile exists:', !!profile)
  
  // For invited users, profile might not exist yet or RLS might block access
  // This is normal - they'll create their profile through this form

  // Get email from authenticated user (email is stored in auth.users, not profiles table)
  // This is the email that was used when the user account was created via member invite claim flow
  const userEmail = user.email

  if (!userEmail) {
    // This shouldn't happen, but handle gracefully
    console.error('User email not found for authenticated user:', user.id)
  }

  // Get organization name from membership (user is already a member from claim flow)
  let organizationName = "[Org Name]"
  
  try {
    const { data: membership, error: membershipError } = await supabase
      .from('memberships')
      .select(`
        org_id,
        organizations!inner(
          name
        )
      `)
      .eq('user_id', user.id)
      .single()

    if (!membershipError && membership) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const org = (membership as any).organizations
      if (org?.name) {
        organizationName = org.name
      }
    }
  } catch (error) {
    console.error('Error fetching organization name from membership:', error)
    // Fall back to placeholder if there's an error
  }
  
  return (
    <OnboardingLayout
      title={`${organizationName} has invited you to join their team`}
      buttonText="Join team"
      onSubmit={handleMemberInviteCompletion}
      showForm={true}
      formType="profile"
      showBackButton={false}
      initialData={{
        email: userEmail || '',
        firstName: profile?.first_name || '',
        lastName: profile?.last_name || '',
        jobTitle: profile?.job_title || '',
      }}
    />
  )
}

