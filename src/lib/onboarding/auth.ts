import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { User } from '@supabase/supabase-js'

/**
 * Shared authentication wrapper for onboarding pages
 * Eliminates DRY violations by centralizing auth logic
 */
export async function getAuthenticatedUser(): Promise<User> {
  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  
  if (userError || !user) {
    redirect('/signup')
  }
  
  return user
}
