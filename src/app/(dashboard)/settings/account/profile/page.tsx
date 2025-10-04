import { createClient } from '@/lib/supabase/server'
import { getActiveContext } from '@/lib/mode/getActiveContext'
import ProfileForm from "./ProfileForm"

export default async function ProfilePage() {
  const supabase = await createClient()
  const context = await getActiveContext()

  if (!context) {
    return null // Layout will handle redirect
  }

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser()
  
  if (userErr || !user) {
    return null // Layout will handle redirect
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("first_name, last_name, job_title, avatar_url")
    .eq("id", user.id)
    .single()

  if (error) {
    console.error('Error fetching profile:', error)
    // Render empty form or error state
  }

  return (
    <ProfileForm
      initialValues={{
        first_name: profile?.first_name ?? "",
        last_name: profile?.last_name ?? "",
        job_title: profile?.job_title ?? "",
        email: user.email ?? "",
        avatar_url: profile?.avatar_url ?? "",
      }}
      userId={user.id}
      context={context}
    />
  )
}