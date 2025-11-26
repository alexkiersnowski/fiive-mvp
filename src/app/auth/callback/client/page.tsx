'use client'

import { useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function ClientCallbackContent() {
  const searchParams = useSearchParams()
  const router = useRouter()

  useEffect(() => {
    const handleCallback = async () => {
      // Extract tokens from URL hash fragment
      const hash = window.location.hash.substring(1) // Remove the #
      const params = new URLSearchParams(hash)
      
      const accessToken = params.get('access_token')
      const refreshToken = params.get('refresh_token')
      const error = params.get('error')
      const errorDescription = params.get('error_description')

      // Handle errors
      if (error) {
        console.error('[CLIENT_CALLBACK] Auth error:', error, errorDescription)
        router.push(`/signin?error=auth_failed&reason=${encodeURIComponent(errorDescription || error)}`)
        return
      }

      // If no tokens, something went wrong
      if (!accessToken || !refreshToken) {
        console.error('[CLIENT_CALLBACK] No tokens found in hash fragment')
        router.push('/signin?error=auth_failed&reason=no_tokens')
        return
      }

      // Set session using Supabase client
      const supabase = createClient()
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      })

      if (sessionError) {
        console.error('[CLIENT_CALLBACK] Session error:', sessionError)
        router.push(`/signin?error=auth_failed&reason=${encodeURIComponent(sessionError.message)}`)
        return
      }

      // Get the next destination from query params
      const next = searchParams.get('next') || ''
      const token = searchParams.get('token') // Preserve member-invite token
      const safeNext = next && next.startsWith('/') ? next : '/home'

      // Preserve token if present (for member-invite flow)
      let redirectUrl = safeNext
      if (token && safeNext.startsWith('/member-invite/')) {
        const url = new URL(safeNext, window.location.origin)
        url.searchParams.set('token', token)
        redirectUrl = url.pathname + url.search
      }

      // Clear hash fragment and redirect
      window.history.replaceState(null, '', window.location.pathname + window.location.search)
      router.push(redirectUrl)
    }

    handleCallback()
  }, [searchParams, router])

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes loading-bar-fill {
          0% {
            width: 0%;
          }
          50% {
            width: 70%;
          }
          100% {
            width: 100%;
          }
        }
        .loading-bar-fill {
          animation: loading-bar-fill 1.5s ease-in-out infinite;
        }
      `}} />
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--color-neutral-1)' }}>
        {/* Full-width loading bar at top */}
        <div className="w-full h-1 bg-slate-2 relative overflow-hidden">
          <div 
            className="h-full loading-bar-fill"
            style={{
              background: 'linear-gradient(90deg, #ff8c1a 3.71%, #ff8985 51.17%, #51d9cc 122.36%)'
            }}
          />
        </div>

        {/* Center content */}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-md-regular" style={{ color: 'var(--color-base-text-primary)' }}>
              Setting things up…
            </p>
          </div>
        </div>
      </div>
    </>
  )
}

export default function ClientCallbackPage() {
  return (
    <Suspense fallback={
      <>
        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes loading-bar-fill {
            0% {
              width: 0%;
            }
            50% {
              width: 70%;
            }
            100% {
              width: 100%;
            }
          }
          .loading-bar-fill {
            animation: loading-bar-fill 1.5s ease-in-out infinite;
          }
        `}} />
        <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--color-neutral-1)' }}>
          <div className="w-full h-1 bg-slate-2 relative overflow-hidden">
            <div 
              className="h-full loading-bar-fill"
              style={{
                background: 'linear-gradient(90deg, #ff8c1a 3.71%, #ff8985 51.17%, #51d9cc 122.36%)'
              }}
            />
          </div>
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <p className="text-md-regular" style={{ color: 'var(--color-base-text-primary)' }}>
                Setting things up…
              </p>
            </div>
          </div>
        </div>
      </>
    }>
      <ClientCallbackContent />
    </Suspense>
  )
}

