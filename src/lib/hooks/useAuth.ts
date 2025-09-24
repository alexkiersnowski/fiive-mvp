"use client"

import { useUser } from '@/lib/contexts/UserContext'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

export function useAuth() {
  const { user, isAuthenticated, signOut, isLoading } = useUser()
  const supabase = createClient()

  const signOutWithToast = async () => {
    try {
      await signOut()
      toast.success('Signed out successfully')
    } catch (error) {
      console.error('Error signing out:', error)
      toast.error('Failed to sign out')
    }
  }

  const requireAuth = () => {
    if (!isAuthenticated) {
      throw new Error('Authentication required')
    }
    return user
  }

  const getCurrentUserId = () => {
    if (!isAuthenticated) {
      throw new Error('Authentication required')
    }
    return user!.id
  }

  return {
    user,
    isAuthenticated,
    isLoading,
    signOut: signOutWithToast,
    requireAuth,
    getCurrentUserId,
  }
}
