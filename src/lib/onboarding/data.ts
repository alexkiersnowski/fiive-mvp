import { createClient } from '@/lib/supabase/server'
import { User } from '@supabase/supabase-js'

/**
 * Optimized data fetching for onboarding pages
 * Eliminates complex fallback queries and improves performance
 */

export interface ProfileData {
  first_name: string | null
  last_name: string | null
  job_title: string | null
  avatar_url: string | null
}

export interface OrganizationData {
  name: string | null
  type: string | null
  industry: string | null
  logo_url: string | null
  connection_code: string | null
}

/**
 * Fetch user profile data with optimized query
 */
export async function getProfileData(userId: string): Promise<ProfileData | null> {
  const supabase = await createClient()
  
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('first_name, last_name, job_title, avatar_url')
    .eq('id', userId)
    .maybeSingle() // Better than .single() - handles missing data gracefully
  
  if (error) {
    console.error('Error loading profile:', error)
    return null
  }
  
  return profile
}

/**
 * Fetch organization data with optimized single query
 * Replaces complex 3-query fallback pattern with efficient JOIN
 */
export async function getOrganizationData(userId: string): Promise<OrganizationData | null> {
  const supabase = await createClient()
  
  // Single optimized query using JOIN instead of sequential fallbacks
  const { data: organization, error } = await supabase
    .from('organizations')
    .select(`
      name, 
      type, 
      industry, 
      logo_url, 
      connection_code,
      memberships!inner(user_id)
    `)
    .eq('memberships.user_id', userId)
    .maybeSingle()
  
  if (error) {
    console.error('Error loading organization:', error)
    return null
  }
  
  return organization
}
