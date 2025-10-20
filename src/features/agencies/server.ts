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
  
  // Transform connections to Agency format
  const allAgencies: Agency[] = (connections || []).map(conn => {
    const org = conn.organizations as { name?: string; logo_url?: string; industry?: string } | null;
    
    return {
      id: conn.id,
      name: org?.name || 'Unknown Agency',
      logo: org?.logo_url,
      industry: org?.industry,
      status: (conn.connection_status as "connected" | "invited" | "disconnected" | "draft") || 'draft',
      accountManager: conn.agency_primary_contact_id
        ? { name: 'Loading...', avatar: undefined } // TODO: Fetch from profiles when RLS allows
        : { name: 'Unassigned', avatar: undefined }
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
