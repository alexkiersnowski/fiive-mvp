import { redirect } from "next/navigation"
import AuthLayout from '@/components/layouts/AuthLayout'
import { createClient } from '@/app/utils/supabase/server'

async function handleSignIn(data: { email: string }) {
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
  
  // Try signin first (user's intent)
  const signinResult = await supabase.auth.signInWithOtp({
    email: email,
    options: {
      shouldCreateUser: false, // Only existing users can sign in
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/auth/callback`
    }
  })
  
  if (!signinResult.error) {
    // User exists - they'll get magic link email
    redirect(`/check-email?mode=signin&email=${encodeURIComponent(email)}`)
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
  
  // New user - they'll get confirm email
  // Redirect with mode=signup so check-email page shows correct message
  redirect(`/check-email?mode=signup&email=${encodeURIComponent(email)}&new=true`)
}

export default function SignInPage() {
  return (
    <AuthLayout
      title="Sign in to your account"
      subtitle="Enter your work email to receive a secure sign-in link"
      linkText="Don't have an account yet?"
      linkHref="/signup"
      linkLabel="Sign up"
      buttonText="Sign in"
      onSubmit={handleSignIn}
      formKey="signin-form"
    />
  )
}
