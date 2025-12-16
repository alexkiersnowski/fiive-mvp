"use client"

import { useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"
import AuthLayout from '@/components/layouts/AuthLayout'

export default function CheckEmailContent() {
  const searchParams = useSearchParams()
  const [isClient, setIsClient] = useState(false)
  
  // Prevent hydration mismatch by only using search params on client
  useEffect(() => {
    setIsClient(true)
  }, [])
  
  const email = isClient ? searchParams.get("email") : null
  const mode = isClient ? searchParams.get("mode") : null
  const from = isClient ? searchParams.get("from") : null
  const isSignup = mode === "signup"
  
  // Determine which page to redirect back to
  const backToPage = from === "signin" ? "/signin" : "/signup"
  
  // Simplified messaging - always use "Confirm your email" for unverified users
  let title, subtitle, description
  
  if (isSignup) {
    // New user signup or existing unverified user
    title = "Confirm your email"
    subtitle = email 
      ? `We've sent a confirmation link to ${email}`
      : "We've sent a confirmation link to your email address"
    description = "Click the link to confirm and finish creating your account"
  } else {
    // Sign in flow
    title = "Sign in with email"
    subtitle = email 
      ? `We've sent a secure sign-in link to ${email}`
      : "We've sent a secure sign-in link to your email address"
    description = "Click the link to access your account"
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

