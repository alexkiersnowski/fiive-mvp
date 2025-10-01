import { createClient } from './server'
import { User } from '@supabase/supabase-js'

export interface UserProfile {
  id: string
  user_id: string
  first_name?: string
  last_name?: string
  job_title?: string
  avatar_url?: string
  created_at: string
  updated_at: string
}

export interface Organization {
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

export interface OrganizationMembership {
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

export async function getCurrentUser(): Promise<User | null> {
  const supabase = await createClient()
  
  const { data: { user }, error } = await supabase.auth.getUser()
  
  if (error) {
    console.error('Error getting current user:', error)
    return null
  }
  
  return user
}

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const supabase = await createClient()
  
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
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

export async function getUserMemberships(userId: string): Promise<OrganizationMembership[]> {
  const supabase = await createClient()
  
  try {
    const { data, error } = await supabase
      .from('memberships')
      .select(`
        *,
        organization:organizations(*),
        user_profile:profiles(*)
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

export async function getCurrentUserWithProfile(): Promise<{
  user: User | null
  profile: UserProfile | null
  memberships: OrganizationMembership[]
  currentOrganization: Organization | null
}> {
  const user = await getCurrentUser()
  
  if (!user) {
    return {
      user: null,
      profile: null,
      memberships: [],
      currentOrganization: null,
    }
  }

  const [profile, memberships] = await Promise.all([
    getUserProfile(user.id),
    getUserMemberships(user.id)
  ])

  // Set current organization to the first active membership or null
  const activeMembership = memberships.find(m => m.status === 'active')
  const currentOrganization = activeMembership?.organization || null

  return {
    user,
    profile,
    memberships,
    currentOrganization,
  }
}

export async function requireAuth(): Promise<User> {
  const user = await getCurrentUser()
  
  if (!user) {
    throw new Error('Authentication required')
  }
  
  return user
}

export async function requireOrganization(): Promise<Organization> {
  const { currentOrganization } = await getCurrentUserWithProfile()
  
  if (!currentOrganization) {
    throw new Error('Organization context required')
  }
  
  return currentOrganization
}
