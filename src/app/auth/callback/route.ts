import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type')
  const next = searchParams.get('next') ?? '/'

  if (token_hash && type) {
    const cookieStore = await cookies()
    // Validate required environment variables
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
      return NextResponse.redirect(`${origin}/signin?error=config_error`)
    }

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          },
        },
      }
    )

    // Validate the type parameter for security
    const validTypes = ['email', 'sms', 'phone_change']
    if (!type || !validTypes.includes(type)) {
      return NextResponse.redirect(`${origin}/signin?error=invalid_token`)
    }

    const { error } = await supabase.auth.verifyOtp({
      token_hash,
      type: type as 'email'
    })
    
    if (!error) {
      // For passwordless users, we can optionally disable password auth
      // This ensures they can only use magic links in the future
      // Note: This requires additional Supabase configuration
      const forwardedHost = request.headers.get('x-forwarded-host')
      const isLocalEnv = process.env.NODE_ENV === 'development'
      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${next}`)
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`)
      } else {
        return NextResponse.redirect(`${origin}${next}`)
      }
    } else {
      // Log the error for debugging
      console.error('Auth callback error:', error)
      return NextResponse.redirect(`${origin}/signin?error=auth_failed&message=${encodeURIComponent(error.message)}`)
    }
  }

  // return the user to signin page with error
  return NextResponse.redirect(`${origin}/signin?error=auth_failed`)
}
