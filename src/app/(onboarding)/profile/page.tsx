import { redirect } from "next/navigation"
import OnboardingLayout from '@/components/layouts/OnboardingLayout'
import { handleProfileCreation } from '../actions'
import { createClient } from '@/app/utils/supabase/server'

export default async function ProfilePage() {
  // Check authentication
  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  
  if (userError || !user) {
    redirect('/signin')
  }
  
  // Load existing profile data
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('first_name, last_name, job_title')
    .eq('id', user.id)
    .single()
  
  if (profileError) {
    console.error('Error loading profile:', profileError)
    // If profile doesn't exist, redirect to signup
    redirect('/signup')
  }
  
  return (
    <div>
      {/* TEMP: Quick sign out for development */}
      <div className="fixed top-2 right-2 z-50">
        <form action={async () => {
          'use server'
          const supabase = await createClient()
          await supabase.auth.signOut()
          redirect('/signin')
        }}>
          <button 
            type="submit"
            className="px-2 py-1 text-xs bg-red-100 hover:bg-red-200 text-red-700 rounded border"
            title="Temporary sign out for development"
          >
            TEMP: Sign Out
          </button>
        </form>
      </div>
      
      <OnboardingLayout
        title="Create your account"
        buttonText="Continue"
        onSubmit={handleProfileCreation}
        showForm={true}
        formType="profile"
        showBackButton={true}
        initialData={{
          firstName: profile.first_name || '',
          lastName: profile.last_name || '',
          jobTitle: profile.job_title || ''
        }}
      />
    </div>
  )
}
