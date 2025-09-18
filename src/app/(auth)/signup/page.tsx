import { redirect } from "next/navigation"
import AuthLayout from '@/components/layouts/AuthLayout'
import { createClient } from '@/app/utils/supabase/server'

async function handleSignUp(data: { email: string }) {
  'use server'
  
  const { email } = data
  
  // Basic validation
  if (!email || email.trim() === '') {
    throw new Error('Please enter your work email')
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    throw new Error('Please enter a valid email address')
  }
  
  // Create Supabase client
  const supabase = await createClient()
  
  // First, check if user already exists by trying to sign them in
  const signinResult = await supabase.auth.signInWithOtp({
    email: email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/auth/callback`
    }
  })
  
  if (!signinResult.error) {
    // User exists - they'll get magic link email
    // Redirect with mode=signin so check-email page shows correct message
    redirect(`/check-email?mode=signin&email=${encodeURIComponent(email)}&existing=true`)
  }
  
  // User doesn't exist, try signup
  const randomPassword = Math.random().toString(36).slice(-12) + Math.random().toString(36).slice(-12)
  
  const signupResult = await supabase.auth.signUp({
    email: email,
    password: randomPassword,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/auth/callback`
    }
  })
  
  if (signupResult.error) {
    throw new Error(signupResult.error.message)
  }
  
  // Signup succeeded - new user will get confirm email
  redirect(`/check-email?mode=signup&email=${encodeURIComponent(email)}`)
}

export default function SignUpPage() {
  return (
    <AuthLayout
      title="Create your account"
      subtitle="Enter your work email. It's free to get started."
      linkText="Already have an account?"
      linkHref="/signin"
      linkLabel="Sign in"
      buttonText="Continue"
      onSubmit={handleSignUp}
      formKey="signup-form"
    />
  )
}
