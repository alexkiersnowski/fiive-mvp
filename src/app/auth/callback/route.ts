import { type EmailOtpType } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const token_hash = url.searchParams.get('token_hash')
  const rawType = url.searchParams.get('type') // may be 'invite'
  const next = url.searchParams.get('next') || ''

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (pairs) => pairs.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
      },
    }
  )

  // Handle magic link flow (admin.generateLink) - user may already be authenticated
  // Check if user is already authenticated first
  const { data: { user: existingUser } } = await supabase.auth.getUser()
  
  if (!token_hash || !rawType) {
    // If no token_hash/type but user is authenticated, they came from admin.generateLink
    if (existingUser) {
      const safeNext = next && next.startsWith('/') ? next : ''
      if (safeNext && safeNext.startsWith('/claim/')) {
        return NextResponse.redirect(new URL(safeNext, url))
      }
      // User is authenticated but no specific next - redirect to home or profile
      return NextResponse.redirect(new URL(safeNext || '/home', url))
    }
    return NextResponse.redirect(new URL('/signin?error=auth_failed', url))
  }

  // Supabase quirk: verify invites using 'signup'
  const verifyType: EmailOtpType =
    (rawType === 'invite' ? 'signup' : rawType) as EmailOtpType

  const { error } = await supabase.auth.verifyOtp({ type: verifyType, token_hash })
  if (error) {
    return NextResponse.redirect(
      new URL(`/signin?error=auth_failed&reason=${encodeURIComponent(error.message)}`, url)
    )
  }

  const safeNext = next && next.startsWith('/') ? next : ''

  if (rawType === 'invite') {
    // Don't call getUser(); just bounce the browser so cookies take effect
    const target = safeNext || '/member-invite/profile'
    return NextResponse.redirect(new URL(target, url))
  }

  // Check if user has completed onboarding (is member or owner of an organization)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(new URL('/signin?error=auth_failed', url))
  }

  // CRITICAL: Claim flow - simple check for /claim/ routes
  // No DB checks needed - claim already happened before login
  if (safeNext && safeNext.startsWith('/claim/')) {
    return NextResponse.redirect(new URL(safeNext, url))
  }

  // Check if user is a member of any organization (this is the only check we need)
  const { data: membership } = await supabase
    .from('memberships')
    .select('id')
    .eq('user_id', user.id)
    .single()

  const hasMembership = !!membership

  // Determine redirect destination
  let fallback: string
  if (verifyType === 'email_change') {
    fallback = '/settings/account/access'
  } else if (verifyType === 'signup' || verifyType === 'email') {
    // New user or email verification - always go to profile for onboarding
    fallback = '/signup/profile'
  } else if (hasMembership) {
    // User has membership - go to home
    fallback = '/home'
  } else {
    // User has no membership - go to profile to complete onboarding
    fallback = '/signup/profile'
  }

  // Use safeNext if provided and valid, otherwise use fallback
  const finalDestination = safeNext || fallback
  
  return NextResponse.redirect(new URL(finalDestination, url))
}
