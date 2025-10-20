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

  // Helpful local debugging (shows in your dev terminal)
  console.log('[auth/callback] params:', {
    rawType,
    has_token_hash: !!token_hash,
    next,
    full: url.toString(),
  })

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
    console.log('[auth/callback] verifyOtp failed:', error.message)
    return NextResponse.redirect(
      new URL(`/signin?error=auth_failed&reason=${encodeURIComponent(error.message)}`, url)
    )
  }

  console.log('[auth/callback] verifyOtp success, redirecting...')

  const safeNext = next && next.startsWith('/') ? next : ''

  if (rawType === 'invite') {
    // Don't call getUser(); just bounce the browser so cookies take effect
    const target = safeNext || '/member-invite'
    console.log('[auth/callback] Redirecting invite user to:', target)
    return NextResponse.redirect(new URL(target, url))
  }

  const fallback =
    verifyType === 'email_change' ? '/settings/account/access'
    : verifyType === 'signup' || verifyType === 'email' ? '/profile'
    : '/home'

  return NextResponse.redirect(new URL(safeNext || fallback, url))
}
