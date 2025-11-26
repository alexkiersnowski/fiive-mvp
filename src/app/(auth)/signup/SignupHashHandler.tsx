'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

/**
 * Client component to handle hash fragments on signup page
 * If Supabase redirects here with hash fragments (from generateLink),
 * we detect the session and redirect to the appropriate page
 */
export function SignupHashHandler() {
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    
    // Check if there are hash fragments in the URL (Supabase auth tokens)
    const hasHash = typeof window !== 'undefined' && window.location.hash.length > 0
    
    if (hasHash) {
      if (process.env.NODE_ENV !== 'production') {
        console.log('[SignupHashHandler] Hash fragments detected:', window.location.hash.substring(0, 50) + '...')
      }
      
      let hasRedirected = false
      
      // Listen for auth state changes (handles hash fragments automatically)
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if (process.env.NODE_ENV !== 'production') {
          console.log('[SignupHashHandler] Auth state change:', event, session ? 'has session' : 'no session')
        }
        
        if (event === 'SIGNED_IN' && session && !hasRedirected) {
          hasRedirected = true
          
          // Check if user has a membership (from member invite)
          supabase
            .from('memberships')
            .select('id')
            .eq('user_id', session.user.id)
            .single()
            .then(({ data: membership }) => {
              if (membership) {
                // User has membership - likely from member invite flow
                if (process.env.NODE_ENV !== 'production') {
                  console.log('[SignupHashHandler] User has membership, redirecting to /member-invite/profile')
                }
                router.push('/member-invite/profile')
              } else {
                // No membership - regular signup flow
                if (process.env.NODE_ENV !== 'production') {
                  console.log('[SignupHashHandler] No membership, redirecting to /signup/profile')
                }
                router.push('/signup/profile')
              }
            })
        }
      })
      
      // Wait a bit for Supabase to process hash fragments, then check session
      const checkSession = async () => {
        // Give Supabase time to process hash fragments
        await new Promise(resolve => setTimeout(resolve, 500))
        
        const { data: { session } } = await supabase.auth.getSession()
        
        if (process.env.NODE_ENV !== 'production') {
          console.log('[SignupHashHandler] Session check after delay:', session ? 'has session' : 'no session')
        }
        
        if (session && !hasRedirected) {
          hasRedirected = true
          
          supabase
            .from('memberships')
            .select('id')
            .eq('user_id', session.user.id)
            .single()
            .then(({ data: membership, error }) => {
              if (process.env.NODE_ENV !== 'production') {
                console.log('[SignupHashHandler] Membership check:', membership ? 'has membership' : 'no membership', error)
              }
              
              if (membership) {
                router.push('/member-invite/profile')
              } else {
                router.push('/signup/profile')
              }
            })
        }
      }
      
      checkSession()
      
      return () => {
        subscription.unsubscribe()
      }
    }
  }, [router])

  return null
}

