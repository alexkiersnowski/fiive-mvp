import type { Metadata } from 'next';
import { redirect } from "next/navigation"
import AuthLayout from '@/components/layouts/AuthLayout'
import { createClient, isUserVerified } from '@/lib/supabase/server'
import { SignupHashHandler } from './SignupHashHandler'
import { getActiveContext } from '@/lib/mode/getActiveContext'

export const metadata: Metadata = {
  title: 'Create your Fiive account | Client management software',
  description: 'Create your Fiive account to manage agency–client work in one connected system. Requests, tasks, projects, and shared visibility in one place.',
};

async function handleSignUp(data: { email: string }) {
  'use server'
  
  const { email } = data
  
  // Normalize email to lowercase before any processing
  const normalizedEmail = email.trim().toLowerCase()
  
  // Basic validation
  if (!normalizedEmail || normalizedEmail === '') {
    throw new Error('Please enter your work email')
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(normalizedEmail)) {
    throw new Error('Please enter a valid email address')
  }
  
  // Create Supabase client
  const supabase = await createClient()
  
  // Check if user exists and their verification status (now using normalized email)
  const userStatus = await isUserVerified(normalizedEmail)
  
  if (userStatus?.exists) {
    if (userStatus.is_verified) {
      // User exists and is verified - send magic link
        const signinResult = await supabase.auth.signInWithOtp({
          email: normalizedEmail,
          options: {
            shouldCreateUser: false,
            emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/auth/callback`
          }
        })
      
      if (!signinResult.error) {
        redirect(`/check-email?mode=signin&email=${encodeURIComponent(normalizedEmail)}&existing=true&from=signup`)
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
          redirect(`/check-email?mode=signin&email=${encodeURIComponent(normalizedEmail)}&from=signup`)
        } else {
          throw new Error(signinResult.error.message)
        }
      }
    } else {
      // User exists but is unverified - resend confirmation
      const resendResult = await supabase.auth.resend({
        type: 'signup',
        email: normalizedEmail,
        options: {
          emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/auth/callback`
        }
      })
      
      if (!resendResult.error) {
        redirect(`/check-email?mode=signup&email=${encodeURIComponent(normalizedEmail)}&resend=true&from=signup`)
      } else {
        // Handle rate limiting or other errors
        if (resendResult.error.message.includes('rate limit') || 
            resendResult.error.message.includes('too many requests') ||
            resendResult.error.message.includes('security purposes') ||
            resendResult.error.message.includes('55 seconds')) {
          // Redirect to check-email with resend state (same as successful resend)
          redirect(`/check-email?mode=signup&email=${encodeURIComponent(normalizedEmail)}&resend=true&from=signup`)
        } else {
          throw new Error(resendResult.error.message)
        }
      }
    }
  } else {
    // User doesn't exist - create new account
    const randomPassword = Math.random().toString(36).slice(-12) + Math.random().toString(36).slice(-12)
    
    const signupResult = await supabase.auth.signUp({
      email: normalizedEmail,
      password: randomPassword,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/auth/callback`
      }
    })
    
    if (signupResult.error) {
      throw new Error(signupResult.error.message)
    }
    
    // New user - they'll get confirm email
    redirect(`/check-email?mode=signup&email=${encodeURIComponent(normalizedEmail)}&new=true&from=signup`)
  }
}

export default async function SignUpPage() {
  // Redirect logged-in users with active organization sessions to /home
  const context = await getActiveContext()
  if (context) {
    redirect('/home')
  }

  return (
    <>
      <SignupHashHandler />
      <AuthLayout
        title="Create your account"
        subtitle="Enter your work email. It's free to get started."
        linkText="Already have an account?"
        linkHref="/signin"
        linkLabel="Sign in"
        buttonText="Get early access"
        onSubmit={handleSignUp}
        formKey="signup-form"
      />
    </>
  )
}
