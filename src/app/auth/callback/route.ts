import { type EmailOtpType } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const token_hash = url.searchParams.get('token_hash')
  const type = url.searchParams.get('type') as EmailOtpType | null
  const next = url.searchParams.get('next') || ''

  // Helpful local debugging (shows in your dev terminal)
  console.log('[auth/callback] params:', {
    type,
    has_token_hash: !!token_hash,
    next,
    full: url.toString(),
  })

  if (!token_hash || !type) {
    redirect(`/signin?error=auth_failed`)
  }

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

  const { error } = await supabase.auth.verifyOtp({ type, token_hash })
  if (error) {
    console.log('[auth/callback] verifyOtp failed:', error.message)
    redirect(`/signin?error=auth_failed&reason=${encodeURIComponent(error.message)}`)
  }

  console.log('[auth/callback] verifyOtp success, redirecting...')

  // Safe redirect
  const safeNext = next.startsWith('/') ? next : ''
  const fallback = type === 'email_change' ? '/settings/account/access'
                 : type === 'signup' || type === 'invite' || type === 'email' ? '/profile'
                 : '/home'

  redirect(safeNext || fallback)
}
