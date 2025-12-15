import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/server'
import { verifyInviteToken } from '@/lib/tokens/verifyInviteToken'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface ClaimPageProps {
  searchParams: Promise<{ token?: string }>
}

export default async function ClaimPage({ searchParams }: ClaimPageProps) {
  const resolvedSearchParams = await searchParams
  const token = resolvedSearchParams.token

  // 1. Validate token exists
  if (!token) {
    redirect('/signin?error=invalid_token')
  }

  // Create admin client
  const adminSupabase = createAdminClient()

  // 2. Verify token via RPC
  const tokenResult = await verifyInviteToken(token)
  
  if (!tokenResult.success) {
    redirect(`/signin?error=invalid_token&details=${encodeURIComponent(tokenResult.error || 'Token verification failed')}`)
  }

  const { connectionId, clientId, invitedEmail } = tokenResult

  // 3. Double-claim prevention - check claimed_at (not owner_id, as owner_id may be set during draft creation)
  const { data: org, error: orgError } = await adminSupabase
    .from('organizations')
    .select('claimed_at')
    .eq('id', clientId)
    .single()

  if (!orgError && org && org.claimed_at) {
    // Already claimed - redirect to home (they already claimed it)
    redirect('/home')
  }

  // 4. Validate user doesn't exist (MVP: only new users can claim)
  // Use efficient RPC function instead of listing all users
  const { data: emailExists, error: userCheckError } = await adminSupabase.rpc('check_user_email_exists', {
    p_email: invitedEmail
  })
  
  if (userCheckError) {
    redirect('/signin?error=user_lookup_failed')
  }

  if (emailExists === true) {
    redirect('/signin?error=existing_user_cannot_claim')
  }

  // 5. Create new user (only new users can claim in MVP)
  let user
  
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

    user = createResult.user
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Unexpected error creating user:', error instanceof Error ? error.message : String(error))
    }
    redirect('/signin?error=user_creation_failed')
  }

  // Profile auto-created via database trigger

  // 6. Atomic claim via Postgres function
  // Note: clientId is actually the draft org ID (could be agency or client)
  const { error: claimError } = await adminSupabase.rpc('claim_organization', {
    p_connection_id: connectionId,
    p_draft_org_id: clientId,
    p_user_id: user.id
  })

  if (claimError) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Claim error:', claimError.message)
    }
    
    // Check if already claimed
    if (claimError.message?.includes('already claimed')) {
      redirect('/home')
    }
    redirect('/signin?error=claim_failed')
  }

  // 7. Generate sign-in link (NO EMAIL SENT)
  // Use client-side callback to handle hash fragment tokens from Supabase hosted auth
  // Note: 'magiclink' type is correct here - user already exists (created above),
  // so we generate a magic link to sign them in, not sign them up
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  const redirectTo = `${baseUrl}/auth/callback/client?next=/claim/profile`
  
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

  // 8. Redirect to action_link (Supabase handles auto-login via callback, then redirects to /claim/profile)
  redirect(linkData.properties.action_link)
}
