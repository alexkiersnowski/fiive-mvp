import type { Metadata } from 'next';
import { redirect } from "next/navigation"
import AuthLayout from '@/components/layouts/AuthLayout'
import { createClient, isUserVerified } from '@/lib/supabase/server'
import { getActiveContext } from '@/lib/mode/getActiveContext'

export const metadata: Metadata = {
  title: 'Sign in to Fiive | Client management software',
  description: 'Sign in to Fiive to access your agency hub or client portal. Manage requests, tasks, projects, and ongoing work in one place.',
};

async function handleSignIn(data: { email: string }) {
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
  let supabase
  try {
    supabase = await createClient()
  } catch {
    throw new Error('Something went wrong. Please try again in a moment.')
  }
  
  // Check if user exists and their verification status (now using normalized email)
  let userStatus
  try {
    userStatus = await isUserVerified(normalizedEmail)
  } catch (error) {
    // If verification check fails, assume user doesn't exist and proceed with signup
    // If it's a JSON parsing error, the service is likely down
    if (error instanceof Error && (
      error.message.includes('JSON') || 
      error.message.includes('Unexpected token') ||
      error.message.includes('<html')
    )) {
      throw new Error('Something went wrong. Please try again in a moment.')
    }
    userStatus = { exists: false, is_verified: false }
  }
  
  if (userStatus?.exists) {
    if (userStatus.is_verified) {
      // User exists and is verified - send magic link
      try {
        const signinResult = await supabase.auth.signInWithOtp({
          email: normalizedEmail,
          options: {
            shouldCreateUser: false,
            emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/auth/callback`
          }
        })
        
        if (!signinResult.error) {
          redirect(`/check-email?mode=signin&email=${encodeURIComponent(normalizedEmail)}&from=signin`)
        } else {
          // Handle rate limiting or other errors
          const errorMessage = signinResult.error?.message || ''
          if (errorMessage.includes('rate limit') || 
              errorMessage.includes('too many requests') ||
              errorMessage.includes('security purposes') ||
              errorMessage.includes('21 seconds') ||
              errorMessage.includes('54 seconds') ||
              errorMessage.includes('55 seconds')) {
            // For signin rate limits, redirect to check-email page
            // User will see "Sign in with email" messaging
            redirect(`/check-email?mode=signin&email=${encodeURIComponent(normalizedEmail)}&from=signin`)
          } else {
            throw new Error(errorMessage || 'Failed to send sign-in link. Please try again.')
          }
        }
      } catch (error) {
        // Handle unexpected errors (network issues, service errors, etc.)
        if (error instanceof Error) {
          const errorMessage = error.message || String(error)
          // Check if it's a JSON parsing error (server returning HTML)
          if (errorMessage.includes('JSON') || 
              errorMessage.includes('Unexpected token') ||
              errorMessage.includes('<html') ||
              errorMessage.includes('is not valid JSON')) {
            throw new Error('Something went wrong. Please try again in a moment.')
          }
          throw error
        }
        const errorString = String(error)
        if (errorString.includes('JSON') || errorString.includes('Unexpected token')) {
          throw new Error('Something went wrong. Please try again in a moment.')
        }
        throw new Error('Something went wrong. Please try again in a moment.')
      }
    } else {
      // User exists but is unverified - resend confirmation
      try {
        const resendResult = await supabase.auth.resend({
          type: 'signup',
          email: normalizedEmail,
          options: {
            emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/auth/callback`
          }
        })
        
        if (!resendResult.error) {
          redirect(`/check-email?mode=signup&email=${encodeURIComponent(normalizedEmail)}&from=signin`)
        } else {
          // Handle rate limiting or other errors
          const errorMessage = resendResult.error?.message || ''
          if (errorMessage.includes('rate limit') || 
              errorMessage.includes('too many requests') ||
              errorMessage.includes('security purposes') ||
              errorMessage.includes('55 seconds')) {
            // Redirect to check-email (same as successful resend)
            redirect(`/check-email?mode=signup&email=${encodeURIComponent(normalizedEmail)}&from=signin`)
          } else {
            throw new Error(errorMessage || 'Failed to resend confirmation email. Please try again.')
          }
        }
      } catch (error) {
        // Handle unexpected errors (network issues, service errors, etc.)
        if (error instanceof Error) {
          const errorMessage = error.message || String(error)
          // Check if it's a JSON parsing error (server returning HTML)
          if (errorMessage.includes('JSON') || 
              errorMessage.includes('Unexpected token') ||
              errorMessage.includes('<html') ||
              errorMessage.includes('is not valid JSON')) {
            throw new Error('Something went wrong. Please try again in a moment.')
          }
          throw error
        }
        const errorString = String(error)
        if (errorString.includes('JSON') || errorString.includes('Unexpected token')) {
          throw new Error('Something went wrong. Please try again in a moment.')
        }
        throw new Error('Something went wrong. Please try again in a moment.')
      }
    }
  } else {
    // User doesn't exist - create new account
    const randomPassword = Math.random().toString(36).slice(-12) + Math.random().toString(36).slice(-12)
    
    try {
      const signupResult = await supabase.auth.signUp({
        email: normalizedEmail,
        password: randomPassword,
        options: {
          emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/auth/callback`
        }
      })
      
      if (signupResult.error) {
        const errorMessage = signupResult.error?.message || 'Failed to create account. Please try again.'
        throw new Error(errorMessage)
      }
      
      // New user - they'll get confirm email
      redirect(`/check-email?mode=signup&email=${encodeURIComponent(normalizedEmail)}&new=true&from=signin`)
      } catch (error) {
        // Handle unexpected errors (network issues, service errors, JSON parsing errors, etc.)
        if (error instanceof Error) {
          const errorMessage = error.message || String(error)
          // Check if it's a JSON parsing error (server returning HTML)
          if (errorMessage.includes('JSON') || 
              errorMessage.includes('Unexpected token') ||
              errorMessage.includes('<html') ||
              errorMessage.includes('is not valid JSON')) {
            throw new Error('Something went wrong. Please try again in a moment.')
          }
          throw error
        }
        // Handle non-Error objects
        const errorString = String(error)
        if (errorString.includes('JSON') || errorString.includes('Unexpected token')) {
          throw new Error('Something went wrong. Please try again in a moment.')
        }
        throw new Error('Something went wrong. Please try again in a moment.')
      }
  }
}

export default async function SignInPage() {
  // Redirect logged-in users with active organization sessions to /home
  const context = await getActiveContext()
  if (context) {
    redirect('/home')
  }

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
