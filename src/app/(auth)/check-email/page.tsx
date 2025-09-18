"use client"

import { useSearchParams } from "next/navigation"
import { useEffect, useState, Suspense } from "react"
import AuthLayout from '@/components/layouts/AuthLayout'

function CheckEmailContent() {
  const searchParams = useSearchParams()
  const [isClient, setIsClient] = useState(false)
  
  // Prevent hydration mismatch by only using search params on client
  useEffect(() => {
    setIsClient(true)
  }, [])
  
  const email = isClient ? searchParams.get("email") : null
  const mode = isClient ? searchParams.get("mode") : null
  const existing = isClient ? searchParams.get("existing") : null
  const newUser = isClient ? searchParams.get("new") : null
  const isSignup = mode === "signup"
  const isExistingUser = existing === "true"
  const isNewUser = newUser === "true"
  
  // Handle messaging based on user's intent vs what actually happened
  let title, subtitle, description
  
  if (isSignup && isExistingUser) {
    // User was on signup page but already has account
    title = "You already have an account"
    subtitle = email 
      ? `We've sent a sign-in link to ${email}`
      : "We've sent a sign-in link to your email address"
    description = "Click the link to access your existing account"
  } else if (!isSignup && isNewUser) {
    // User was on signin page but we created new account
    title = "Welcome! We've created your account"
    subtitle = email 
      ? `We've sent a verification link to ${email}`
      : "We've sent a verification link to your email address"
    description = "Click the link to confirm and finish setting up your account"
  } else {
    // Normal flow
    title = isSignup ? "Verify your email" : "Sign in with email"
    subtitle = email 
      ? `We've sent a ${isSignup ? 'verification' : 'secure sign-in'} link to ${email}`
      : `We've sent a ${isSignup ? 'verification' : 'secure sign-in'} link to your email address`
    description = isSignup 
      ? "Click the link to confirm and finish creating your account"
      : "Click the link to access your account"
  }

  return (
    <AuthLayout
      title={title}
      subtitle={subtitle}
      description={description}
      linkText="Didn't get it? Check your spam or"
      linkHref={isSignup ? "/signup" : "/signin"}
      linkLabel="try again"
      buttonText="Try again"
      showForm={false}
      onSubmit={async () => {
        // TODO: Implement resend email logic
        console.log(`Resending ${mode} email`)
      }}
    />
  )
}

export default function CheckEmailPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <CheckEmailContent />
    </Suspense>
  )
}
