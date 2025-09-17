import { redirect } from "next/navigation"
import AuthLayout from '@/components/layouts/AuthLayout'

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
  
  // TODO: Add Supabase email verification logic here
  console.log('Sign up with email:', email)
  
  // Redirect to check-email page
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
