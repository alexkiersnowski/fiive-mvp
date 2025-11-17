import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/server'
import { verifyMemberInviteToken } from '@/lib/tokens/verifyMemberInviteToken'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface MemberInviteClaimPageProps {
  searchParams: Promise<{ token?: string }>
}

export default async function MemberInviteClaimPage({ searchParams }: MemberInviteClaimPageProps) {
  const resolvedSearchParams = await searchParams
  const token = resolvedSearchParams.token

  // 1. Validate token exists
  if (!token) {
    redirect('/signin?error=invalid_token')
  }

  // Create admin client
  const adminSupabase = createAdminClient()

  // 2. Verify token via RPC
  const tokenResult = await verifyMemberInviteToken(token)
  
  if (!tokenResult.success) {
    redirect(`/signin?error=invalid_token&details=${encodeURIComponent(tokenResult.error || 'Token verification failed')}`)
  }

  const { invitationId, orgId, invitedEmail, role } = tokenResult

  // 3. Check if user already exists
  const { data: emailExists, error: userCheckError } = await adminSupabase.rpc('check_user_email_exists', {
    p_email: invitedEmail
  })
  
  if (userCheckError) {
    redirect('/signin?error=user_lookup_failed')
  }

  let userId: string

  if (emailExists === true) {
    // User already exists - get their user ID
    const { data: existingUser, error: getUserError } = await adminSupabase.auth.admin.getUserByEmail(invitedEmail)
    
    if (getUserError || !existingUser?.user) {
      redirect('/signin?error=user_lookup_failed')
    }

    userId = existingUser.user.id

    // Check if user is already a member of this organization
    const { data: existingMembership } = await adminSupabase
      .from('memberships')
      .select('id')
      .eq('org_id', orgId)
      .eq('user_id', userId)
      .single()

    if (existingMembership) {
      // Already a member - update invitation status and redirect to home
      await adminSupabase
        .from('membership_invitations')
        .update({
          status: 'accepted',
          accepted_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', invitationId)

      // Already a member - generate sign-in link and redirect to home
      const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
      const redirectTo = `${baseUrl}/auth/callback/client?next=/home`
      
      const { data: linkData, error: linkError } = await adminSupabase.auth.admin.generateLink({
        type: 'magiclink',
        email: invitedEmail,
        options: {
          redirectTo
        }
      })

      if (linkError || !linkData?.properties?.action_link) {
        redirect('/signin?error=signin_link_failed')
      }

      redirect(linkData.properties.action_link)
    }
  } else {
    // 4. Create new user
    try {
      const { data: createResult, error: createError } = await adminSupabase.auth.admin.createUser({
        email: invitedEmail,
        email_confirm: true
      })

      if (createError) {
        if (process.env.NODE_ENV !== 'production') {
          console.error('User creation error:', createError.message)
        }
        redirect('/signin?error=user_creation_failed')
      }

      if (!createResult?.user) {
        redirect('/signin?error=user_creation_failed')
      }

      userId = createResult.user.id
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Unexpected error creating user:', error instanceof Error ? error.message : String(error))
      }
      redirect('/signin?error=user_creation_failed')
    }
  }

  // Profile auto-created via database trigger

  // 5. Create membership entry linking user to organization
  const membershipData = {
    org_id: orgId,
    user_id: userId,
    role: role,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }

  const { error: membershipError } = await adminSupabase
    .from('memberships')
    .insert(membershipData)

  if (membershipError) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Membership creation error:', membershipError.message)
    }
    // Check if membership already exists (race condition)
    if (membershipError.code === '23505') { // Unique violation
      // Membership already exists, continue
    } else {
      redirect('/signin?error=membership_creation_failed')
    }
  }

  // 6. Update invitation status to 'accepted' with accepted_at timestamp
  const { error: invitationUpdateError } = await adminSupabase
    .from('membership_invitations')
    .update({
      status: 'accepted',
      accepted_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', invitationId)

  if (invitationUpdateError) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Invitation status update error:', invitationUpdateError.message)
    }
    // Don't fail here - membership was created successfully
  }

  // 7. Generate sign-in link and redirect to profile completion
  // IMPORTANT: Preserve the token in the redirect URL so it's available on the profile page
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  const redirectTo = `${baseUrl}/auth/callback/client?next=/member-invite/profile&token=${encodeURIComponent(token)}`
  
  const { data: linkData, error: linkError } = await adminSupabase.auth.admin.generateLink({
    type: 'magiclink',
    email: invitedEmail,
    options: {
      redirectTo
    }
  })

  if (linkError || !linkData?.properties?.action_link) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Error generating sign-in link:', linkError?.message || 'No action_link returned')
    }
    redirect('/signin?error=signin_link_failed')
  }

  // 8. Redirect to action_link (Supabase handles auto-login via callback, then redirects to /member-invite/profile)
  redirect(linkData.properties.action_link)
}

