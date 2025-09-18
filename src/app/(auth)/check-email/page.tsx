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
  const resend = isClient ? searchParams.get("resend") : null
  const from = isClient ? searchParams.get("from") : null
  const isSignup = mode === "signup"
  const isResend = resend === "true"
  
  // Determine which page to redirect back to
  const backToPage = from === "signin" ? "/signin" : "/signup"
  
  // Handle messaging based on user's intent vs what actually happened
  let title, subtitle, description
  
  if (isResend) {
    // User exists but unverified - resending confirmation (or rate limited)
    title = "Check your email again"
    subtitle = email 
      ? `We've sent a verification link to ${email}`
      : "We've sent a verification link to your email address"
    description = "Click the link to confirm and finish creating your account"
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
      linkHref={backToPage}
      linkLabel="try again"
      buttonText="Try again"
      showForm={false}
      onSubmit={async () => {
        // Redirect back to the original page to resend email
        window.location.href = backToPage
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
