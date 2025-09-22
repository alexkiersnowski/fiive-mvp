import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  // Validate required environment variables
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    throw new Error('Missing required Supabase environment variables')
  }

  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
}

// Function to check if a user is verified using a database function
export async function isUserVerified(email: string) {
  const supabase = await createClient()
  
  // Call a database function that checks verification status
  const { data, error } = await supabase.rpc('check_user_verification', {
    user_email: email
  })
  
  if (error) {
    console.error('Error checking user verification:', error)
    // Fallback: assume user doesn't exist if function fails
    return { exists: false, is_verified: false }
  }
  
  return data
}