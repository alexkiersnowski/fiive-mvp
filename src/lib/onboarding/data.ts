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
  website: string | null
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
  
  // RLS policies will automatically filter to organizations the user has access to
  const { data: organization, error } = await supabase
    .from('organizations')
    .select(`
      name, 
      type, 
      industry, 
      website,
      logo_url, 
      connection_code
    `)
    .maybeSingle()
  
  if (error) {
    console.error('Error loading organization:', error)
    return null
  }
  
  return organization
}

/**
 * Fetch partner organization name for a claimed organization
 * Used to display the inviting organization's name on the claim profile page
 * Works for both clients claiming (shows agency name) and agencies claiming (shows client name)
 */
export async function getPartnerOrgNameForClaimedOrg(userId: string): Promise<string | null> {
  const supabase = await createClient()
  
  try {
    // Step 1: Get user's organization ID from organizations table using owner_id
    // Ownership is tracked via owner_id in organizations table, not via memberships.role
    // Claimed organizations set owner_id to the claiming user's ID
    const { data: userOrg, error: orgError } = await supabase
      .from('organizations')
      .select('id, type')
      .eq('owner_id', userId)
      .is('is_draft', false)
      .maybeSingle()
    
    if (orgError || !userOrg) {
      console.error('Error loading user organization:', orgError)
      return null
    }
    
    const userOrgId = userOrg.id
    const userOrgType = userOrg.type
    
    // Step 2: Find connection based on org type
    // If user org is client, find connection where client_id = user's org ID
    // If user org is agency, find connection where agency_id = user's org ID
    let connection
    let connectionError
    
    if (userOrgType === 'client') {
      const result = await supabase
        .from('connections')
        .select('agency_id')
        .eq('client_id', userOrgId)
        .eq('connection_status', 'connected')
        .maybeSingle()
      connection = result.data
      connectionError = result.error
      
      if (connectionError || !connection || !connection.agency_id) {
        console.error('Error loading connection:', connectionError)
        return null
      }
      
      // Step 3: Get agency organization name
      const { data: agencyOrg, error: agencyOrgError } = await supabase
        .from('organizations')
        .select('name')
        .eq('id', connection.agency_id)
        .maybeSingle()
      
      if (agencyOrgError || !agencyOrg) {
        console.error('Error loading agency organization:', agencyOrgError)
        return null
      }
      
      return agencyOrg.name
    } else if (userOrgType === 'agency') {
      const result = await supabase
        .from('connections')
        .select('client_id')
        .eq('agency_id', userOrgId)
        .eq('connection_status', 'connected')
        .maybeSingle()
      connection = result.data
      connectionError = result.error
      
      if (connectionError || !connection || !connection.client_id) {
        console.error('Error loading connection:', connectionError)
        return null
      }
      
      // Step 3: Get client organization name
      const { data: clientOrg, error: clientOrgError } = await supabase
        .from('organizations')
        .select('name')
        .eq('id', connection.client_id)
        .maybeSingle()
      
      if (clientOrgError || !clientOrg) {
        console.error('Error loading client organization:', clientOrgError)
        return null
      }
      
      return clientOrg.name
    } else {
      console.error('Unknown organization type:', userOrgType)
      return null
    }
  } catch (error) {
    console.error('Unexpected error fetching partner org name:', error)
    return null
  }
}

/**
 * Fetch agency organization name for a claimed client organization
 * Used to display the inviting agency's name on the claim profile page
 * @deprecated Use getPartnerOrgNameForClaimedOrg instead for generic support
 */
export async function getAgencyNameForClaimedOrg(userId: string): Promise<string | null> {
  return getPartnerOrgNameForClaimedOrg(userId)
}
