import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import type { EnhancedModeContext } from '@/lib/mode/getActiveContext';
import type { AgenciesSnapshot, Agency, AgenciesPaginationOptions } from './types';

export const getAgenciesSnapshot = cache(async (
  context: EnhancedModeContext,
  options: AgenciesPaginationOptions = {}
): Promise<AgenciesSnapshot> => {
  const { search = '', limit = 50 } = options;
  
  // Fetch real data from connections table
  const supabase = await createClient();
  
  // Get connections for this client with related agency organization data
  const { data: connections, error } = await supabase
    .from('connections')
    .select(`
      id,
      connection_status,
      agency_primary_contact_id,
      agency_id,
      organizations!connections_agency_id_fkey (
        id,
        name,
        logo_url,
        industry
      )
    `)
    .eq('client_id', context.orgId)  // KEY DIFFERENCE: client_id instead of agency_id
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching agency connections:', error);
    // Return empty snapshot on error
    return {
      agencies: [],
      total: 0,
    };
  }

  // Fetch account manager profiles for connections that have agency_primary_contact_id
  const agencyContactIds = (connections || [])
    .map(conn => conn.agency_primary_contact_id)
    .filter((id): id is string => id !== null);

  let accountManagerProfiles: Record<string, { first_name: string; last_name: string; avatar_url: string | null; email: string; job_title: string | null }> = {};

  if (agencyContactIds.length > 0) {
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, avatar_url, email, job_title')
      .in('id', agencyContactIds);

    if (profilesError) {
      console.error('Error fetching account manager profiles:', profilesError);
    } else {
      // Create a lookup map for easy access
      accountManagerProfiles = (profiles || []).reduce((acc, profile) => {
        acc[profile.id] = {
          first_name: profile.first_name || '',
          last_name: profile.last_name || '',
          avatar_url: profile.avatar_url,
          email: profile.email || '',
          job_title: profile.job_title
        };
        return acc;
      }, {} as Record<string, { first_name: string; last_name: string; avatar_url: string | null; email: string; job_title: string | null }>);
    }
  }
  
  // Transform connections to Agency format
  const allAgencies: Agency[] = (connections || []).map(conn => {
    const org = conn.organizations as { name?: string; logo_url?: string; industry?: string } | null;
    
    // Get account manager data if available
    let accountManager: { 
      id: string; 
      name: string; 
      avatarUrl?: string | undefined; 
      email?: string; 
      jobTitle?: string; 
    } = { id: '', name: 'Unassigned' };
    if (conn.agency_primary_contact_id) {
      const profile = accountManagerProfiles[conn.agency_primary_contact_id];
      if (profile) {
        accountManager = {
          id: conn.agency_primary_contact_id,
          name: `${profile.first_name} ${profile.last_name}`.trim() || 'Unknown',
          avatarUrl: profile.avatar_url || undefined,
          email: profile.email,
          jobTitle: profile.job_title || undefined
        };
      } else {
        accountManager = { id: conn.agency_primary_contact_id, name: 'Loading...' };
      }
    }
    
    return {
      id: conn.agency_id,
      connectionId: conn.id,
      name: org?.name || 'Unknown Agency',
      logo: org?.logo_url,
      industry: org?.industry,
      status: (conn.connection_status as "connected" | "invited" | "disconnected" | "internal") || 'internal',
      accountManager
    };
  });

  // Apply search filter
  let filteredAgencies = allAgencies;
  if (search) {
    const query = search.toLowerCase().trim();
    
    // Pre-compute search terms for better performance
    const searchTerms = query.split(' ').filter(term => term.length > 0);
    
    filteredAgencies = allAgencies.filter(agency => {
      if (searchTerms.length === 0) return true;
      
      // Create searchable text for the crucial fields: Agency name, Industry, Status, Account Manager
      const searchableText = [
        agency.name.toLowerCase(),
        agency.industry?.toLowerCase() || '',
        agency.status.toLowerCase(),
        agency.accountManager.name.toLowerCase()
      ].join(' ');
      
      // Check if all search terms are present
      return searchTerms.every(term => searchableText.includes(term));
    });
  }

  // Apply pagination
  const paginatedAgencies = filteredAgencies.slice(0, limit);

  return {
    agencies: paginatedAgencies,
    total: filteredAgencies.length,
  };
});

export function invalidateAgencies(orgId: string) {
  // TODO: Implement cache invalidation when using real data
  // revalidateTag(`agencies:${orgId}`);
  console.log(`Invalidating agencies cache for org: ${orgId}`);
}

