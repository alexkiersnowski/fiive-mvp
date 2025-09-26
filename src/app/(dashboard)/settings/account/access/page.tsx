import { createClient } from '@/lib/supabase/server'
import AccessForm from './AccessForm'

// Force fresh data on every request to ensure updated email is shown immediately
export const revalidate = 0

export default async function AccessPage() {
  const supabase = await createClient()

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  
  if (userError || !user) {
    return null // Layout will handle redirect
  }

  return (
    <AccessForm
      userId={user.id}
      currentEmail={user.email ?? ""}
    />
  )
}