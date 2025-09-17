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
  const isSignup = mode === "signup"
  
  const title = isSignup ? "Verify your email" : "Sign in with email"
  const subtitle = email 
    ? `We've sent a ${isSignup ? 'verification' : 'secure sign-in'} link to ${email}`
    : `We've sent a ${isSignup ? 'verification' : 'secure sign-in'} link to your email address`
  const description = isSignup 
    ? "Click the link to confirm and finish creating your account"
    : "Click the link to access your account"

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
