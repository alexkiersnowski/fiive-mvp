import { redirect } from "next/navigation"
import AuthLayout from '@/components/layouts/AuthLayout'

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
  
  // TODO: Add Supabase magic link logic here
  console.log('Sign in with email:', email)
  
  // Redirect to check-email page
  redirect(`/check-email?mode=signin&email=${encodeURIComponent(email)}`)
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
