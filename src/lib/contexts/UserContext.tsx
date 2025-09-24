"use client"

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'

interface Organization {
  id: string
  name: string
  slug: string
  website?: string
  about?: string
  agency_type?: string
  currency?: string
  logo_url?: string
  created_at: string
  updated_at: string
}

interface UserProfile {
  id: string
  user_id: string
  first_name?: string
  last_name?: string
  job_title?: string
  avatar_url?: string
  created_at: string
  updated_at: string
}

interface OrganizationMembership {
  id: string
  user_id: string
  organization_id: string
  role: 'owner' | 'admin' | 'member'
  status: 'active' | 'invited' | 'pending'
  created_at: string
  updated_at: string
  organization?: Organization
  user_profile?: UserProfile
}

interface UserContextType {
  user: User | null
  profile: UserProfile | null
  currentOrganization: Organization | null
  memberships: OrganizationMembership[]
  isLoading: boolean
  isAuthenticated: boolean
  refreshUser: () => Promise<void>
  refreshOrganization: () => Promise<void>
  signOut: () => Promise<void>
}

const UserContext = createContext<UserContextType | undefined>(undefined)

interface UserProviderProps {
  children: ReactNode
}

export function UserProvider({ children }: UserProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [currentOrganization, setCurrentOrganization] = useState<Organization | null>(null)
  const [memberships, setMemberships] = useState<OrganizationMembership[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const supabase = createClient()

  const isAuthenticated = !!user

  const fetchUserProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('Error fetching user profile:', error)
        return null
      }

      return data
    } catch (error) {
      console.error('Error fetching user profile:', error)
      return null
    }
  }

  const fetchUserMemberships = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('organization_memberships')
        .select(`
          *,
          organization:organizations(*),
          user_profile:user_profiles(*)
        `)
        .eq('user_id', userId)

      if (error) {
        console.error('Error fetching memberships:', error)
        return []
      }

      return data || []
    } catch (error) {
      console.error('Error fetching memberships:', error)
      return []
    }
  }

  const refreshUser = async () => {
    try {
      const { data: { user }, error } = await supabase.auth.getUser()
      
      if (error) {
        console.error('Error getting user:', error)
        setUser(null)
        setProfile(null)
        setCurrentOrganization(null)
        setMemberships([])
        return
      }

      setUser(user)

      if (user) {
        const [userProfile, userMemberships] = await Promise.all([
          fetchUserProfile(user.id),
          fetchUserMemberships(user.id)
        ])

        setProfile(userProfile)
        setMemberships(userMemberships)

        // Set current organization to the first active membership or null
        const activeMembership = userMemberships.find(m => m.status === 'active')
        setCurrentOrganization(activeMembership?.organization || null)
      } else {
        setProfile(null)
        setCurrentOrganization(null)
        setMemberships([])
      }
    } catch (error) {
      console.error('Error refreshing user:', error)
    }
  }

  const refreshOrganization = async () => {
    if (!user) return

    try {
      const userMemberships = await fetchUserMemberships(user.id)
      setMemberships(userMemberships)

      const activeMembership = userMemberships.find(m => m.status === 'active')
      setCurrentOrganization(activeMembership?.organization || null)
    } catch (error) {
      console.error('Error refreshing organization:', error)
    }
  }

  const signOut = async () => {
    try {
      await supabase.auth.signOut()
      setUser(null)
      setProfile(null)
      setCurrentOrganization(null)
      setMemberships([])
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  useEffect(() => {
    // Initial load
    refreshUser()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          setUser(session.user)
          await refreshUser()
        } else if (event === 'SIGNED_OUT') {
          setUser(null)
          setProfile(null)
          setCurrentOrganization(null)
          setMemberships([])
        }
        setIsLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const value: UserContextType = {
    user,
    profile,
    currentOrganization,
    memberships,
    isLoading,
    isAuthenticated,
    refreshUser,
    refreshOrganization,
    signOut,
  }

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  )
}

export function useUser() {
  const context = useContext(UserContext)
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider')
  }
  return context
}
