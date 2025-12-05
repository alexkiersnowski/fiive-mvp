import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import type { EnhancedModeContext } from '@/lib/mode/getActiveContext';
import type { AgenciesSnapshot, Agency, AgenciesPaginationOptions } from './types';

// Helper functions for cursor-based pagination
function encodeCursor(index: number): string {
  return Buffer.from(index.toString()).toString('base64');
}

function decodeCursor(cursor: string): number {
  return parseInt(Buffer.from(cursor, 'base64').toString(), 10);
}

export const getAgenciesSnapshot = cache(async (
  context: EnhancedModeContext,
  options: AgenciesPaginationOptions = {}
): Promise<AgenciesSnapshot> => {
  const { search = '', cursor, limit = 50 } = options;
  
  // Validate context before proceeding
  if (!context || !context.orgId || !context.userId) {
    console.error('Invalid context provided to getAgenciesSnapshot:', { context });
    return {
      agencies: [],
      total: 0,
      unfilteredTotalCount: 0,
      cursor: null,
      hasNextPage: false,
    };
  }

  // Only clients can view agencies
  if (context.variant !== 'client') {
    console.error('Non-client context provided to getAgenciesSnapshot:', { variant: context.variant });
    return {
      agencies: [],
      total: 0,
      unfilteredTotalCount: 0,
      cursor: null,
      hasNextPage: false,
    };
  }
  
  // Fetch real data from connections table
  const supabase = await createClient();
  
  // Always fetch unfiltered total count first (for empty state logic)
  const { count: unfilteredTotalCount, error: unfilteredCountError } = await supabase
    .from('connections')
    .select('id', { count: 'exact', head: true })
    .eq('client_id', context.orgId);
  
  if (unfilteredCountError) {
    console.error('Error fetching unfiltered total count:', unfilteredCountError);
  }
  
  const totalCount = unfilteredTotalCount ?? 0;
  
  // Determine if we should use client-side filtering (≤100 items) or server-side search (>100 items)
  // For MVP: when ≤100, fetch all and let client-side handle filtering
  // When >100, use server-side search with pagination
  const useClientSideFiltering = totalCount <= 100 && !search.trim();
  
  // Build base query
  let query = supabase
    .from('connections')
    .select(`
      id,
      created_at,
      connection_status,
      agency_primary_contact_id,
      agency_id,
      invited_email,
      organizations!connections_agency_id_fkey (
        id,
        name,
        logo_url,
        industry
      )
    `)
    .eq('client_id', context.orgId)
    .order('created_at', { ascending: false });
  
  // Apply pagination logic:
  // - If using client-side filtering (≤100, no search): fetch all, no pagination
  // - If server-side search (>100 or has search): apply pagination at database level
  const startIndex = cursor ? decodeCursor(cursor) : 0;
  if (!useClientSideFiltering) {
    // Server-side: apply pagination at database level
    query = query.range(startIndex, startIndex + limit - 1);
  }
  // Client-side: fetch all (no range limit)
  
  // Get connections for this client with related agency organization data
  const { data: connections, error } = await query;

  if (error) {
    console.error('Error fetching agency connections:', {
      error,
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
      clientId: context.orgId,
    });
    return {
      agencies: [],
      total: 0,
      unfilteredTotalCount: 0,
      cursor: null,
      hasNextPage: false,
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
        // Use email as fallback if first_name and last_name are both empty/null
        const fullName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim();
        const displayName = fullName || profile.email || 'Unknown';
        
        accountManager = {
          id: conn.agency_primary_contact_id,
          name: displayName,
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
      invitedEmail: conn.invited_email || undefined,
      accountManager
    };
  });

  // Apply search filter in memory (only when using server-side search)
  // When useClientSideFiltering is true, return all data and let client handle filtering
  let filteredAgencies = allAgencies;
  
  if (!useClientSideFiltering && search.trim()) {
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

  // Get total count for pagination
  // When using client-side filtering: return unfilteredTotalCount (client will filter)
  // When using server-side search: use filtered count if searching, otherwise unfilteredTotalCount
  const finalTotalCount = useClientSideFiltering
    ? totalCount
    : (search.trim() ? filteredAgencies.length : totalCount);

  // Apply pagination:
  // - Client-side filtering: return all agencies (no pagination)
  // - Server-side search: paginate results
  const endIndex = startIndex + limit;
  let paginatedAgencies = filteredAgencies;
  
  if (!useClientSideFiltering) {
    // Server-side: paginate after filtering
    paginatedAgencies = filteredAgencies.slice(startIndex, endIndex);
  }
  // Client-side: return all (no pagination needed)

  // Calculate total and pagination state
  const total = finalTotalCount;
  const hasNextPage = useClientSideFiltering ? false : (endIndex < total);

  return {
    agencies: paginatedAgencies,
    total,
    unfilteredTotalCount: totalCount,
    cursor: hasNextPage ? encodeCursor(endIndex) : null,
    hasNextPage,
  };
});

export function invalidateAgencies(orgId: string) {
  // TODO: Implement cache invalidation when using real data
  // revalidateTag(`agencies:${orgId}`);
  console.log(`Invalidating agencies cache for org: ${orgId}`);
}

