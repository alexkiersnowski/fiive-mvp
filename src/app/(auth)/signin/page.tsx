import { redirect } from "next/navigation"
import AuthLayout from '@/components/layouts/AuthLayout'
import { createClient, isUserVerified } from '@/lib/supabase/server'

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
  
  // Check if user exists and their verification status
  const userStatus = await isUserVerified(email)
  
  if (userStatus?.exists) {
    if (userStatus.is_verified) {
      // User exists and is verified - send magic link
      const signinResult = await supabase.auth.signInWithOtp({
        email: email,
        options: {
          shouldCreateUser: false,
          emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/auth/callback`
        }
      })
      
      if (!signinResult.error) {
        redirect(`/check-email?mode=signin&email=${encodeURIComponent(email)}&from=signin`)
      } else {
        // Handle rate limiting or other errors
        if (signinResult.error.message.includes('rate limit') || 
            signinResult.error.message.includes('too many requests') ||
            signinResult.error.message.includes('security purposes') ||
            signinResult.error.message.includes('21 seconds') ||
            signinResult.error.message.includes('54 seconds') ||
            signinResult.error.message.includes('55 seconds')) {
          // For signin rate limits, redirect to check-email page
          // User will see "Sign in with email" messaging
          redirect(`/check-email?mode=signin&email=${encodeURIComponent(email)}&from=signin`)
        } else {
          throw new Error(signinResult.error.message)
        }
      }
    } else {
      // User exists but is unverified - resend confirmation
      const resendResult = await supabase.auth.resend({
        type: 'signup',
        email: email,
        options: {
          emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/auth/callback`
        }
      })
      
      if (!resendResult.error) {
        redirect(`/check-email?mode=signup&email=${encodeURIComponent(email)}&resend=true&from=signin`)
      } else {
        // Handle rate limiting or other errors
        if (resendResult.error.message.includes('rate limit') || 
            resendResult.error.message.includes('too many requests') ||
            resendResult.error.message.includes('security purposes') ||
            resendResult.error.message.includes('55 seconds')) {
          // Redirect to check-email with resend state (same as successful resend)
          redirect(`/check-email?mode=signup&email=${encodeURIComponent(email)}&resend=true&from=signin`)
        } else {
          throw new Error(resendResult.error.message)
        }
      }
    }
  } else {
    // User doesn't exist - create new account
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
    redirect(`/check-email?mode=signup&email=${encodeURIComponent(email)}&new=true&from=signin`)
  }
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
