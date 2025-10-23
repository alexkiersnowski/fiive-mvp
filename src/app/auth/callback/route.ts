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


  if (!token_hash || !rawType) {
    return NextResponse.redirect(new URL('/signin?error=auth_failed', url))
  }

  // Supabase quirk: verify invites using 'signup'
  const verifyType: EmailOtpType =
    (rawType === 'invite' ? 'signup' : rawType) as EmailOtpType

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

  const { error } = await supabase.auth.verifyOtp({ type: verifyType, token_hash })
  if (error) {
    return NextResponse.redirect(
      new URL(`/signin?error=auth_failed&reason=${encodeURIComponent(error.message)}`, url)
    )
  }

  const safeNext = next && next.startsWith('/') ? next : ''

  if (rawType === 'invite') {
    // Don't call getUser(); just bounce the browser so cookies take effect
    const target = safeNext || '/member-invite'
    return NextResponse.redirect(new URL(target, url))
  }

  // Check if user has completed onboarding (is member or owner of an organization)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(new URL('/signin?error=auth_failed', url))
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
    fallback = '/profile'
  } else if (hasMembership) {
    // User has membership - go to home
    fallback = '/home'
  } else {
    // User has no membership - go to profile to complete onboarding
    fallback = '/profile'
  }

  // CRITICAL: If user has no membership, always redirect to profile regardless of next parameter
  const finalDestination = hasMembership ? (safeNext || fallback) : '/profile'
  
  return NextResponse.redirect(new URL(finalDestination, url))
}
