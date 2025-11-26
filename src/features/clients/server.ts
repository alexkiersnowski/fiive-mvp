import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import { escapeForILike } from '@/lib/utils';
import type { EnhancedModeContext } from '@/lib/mode/getActiveContext';
import type { ClientsSnapshot, Client, ClientsPaginationOptions } from './types';

// Helper functions for cursor-based pagination
function encodeCursor(index: number): string {
  return Buffer.from(index.toString()).toString('base64');
}

function decodeCursor(cursor: string): number {
  return parseInt(Buffer.from(cursor, 'base64').toString(), 10);
}

// Cache for mock data generation
let cachedMockData: Client[] | null = null;

// Cache for month mapping to avoid recreation
const _MONTH_MAP: { [key: string]: number } = {
  'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
  'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
} as const;

function _generateMockData(): Client[] {
  if (cachedMockData) {
    return cachedMockData;
  }

  cachedMockData = Array.from({ length: 1 }, (_, i) => {
    const clientId = i + 1;
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];
    
    // Deterministic contract end date based on client ID
    const hasContract = clientId % 3 === 0;
    const contractEnd = hasContract 
      ? `${(clientId % 28) + 1} ${monthNames[clientId % 6]} 2025`
      : undefined;
    
    return {
      id: `${clientId}`,
      name: `Client ${String(clientId).padStart(3, '0')}`, // Client 001, Client 002, etc.
      logo: undefined,
      status: (["internal", "onboarding", "active", "offboarded"] as const)[clientId % 4],
      accountManager: { 
        id: `manager-${i}`,
        name: `Manager ${String(Math.floor(i / 10) + 1).padStart(2, '0')}`,
        firstName: 'Manager',
        lastName: `${String(Math.floor(i / 10) + 1).padStart(2, '0')}`,
        email: `manager${String(Math.floor(i / 10) + 1).padStart(2, '0')}@agency.com`,
        jobTitle: 'Account Manager',
        avatar: undefined,
        organization: {
          id: 'agency-org',
          name: 'Agency',
          logo_url: 'https://api.dicebear.com/7.x/shapes/svg?seed=agency'
        }
      },
      contractEnd,
      health: (() => {
        // Ensure we have some critical clients for testing
        if (clientId <= 10) return "critical";
        if (clientId <= 20) return "at-risk";
        if (clientId <= 30) return "healthy";
        return (["critical", "at-risk", "healthy", "unassigned"] as const)[clientId % 4];
      })(),
      badge: ["Draft", "Onboarding", "Active", "Offboarded"][clientId % 4]
    };
  });

  return cachedMockData || [];
}

export const getClientsSnapshot = cache(async (
  context: EnhancedModeContext,
  options: ClientsPaginationOptions = {}
): Promise<ClientsSnapshot> => {
  const { search = '', cursor, limit = 50, sort = 'newest-first' } = options;
  
  // Validate context before proceeding
  if (!context || !context.orgId || !context.userId) {
    console.error('Invalid context provided to getClientsSnapshot:', { context });
    return {
      clients: [],
      total: 0,
      unfilteredTotalCount: 0,
      cursor: null,
      hasNextPage: false,
    };
  }

  // Only agencies can view clients
  if (context.variant !== 'agency') {
    console.error('Non-agency context provided to getClientsSnapshot:', { variant: context.variant });
    return {
      clients: [],
      total: 0,
      unfilteredTotalCount: 0,
      cursor: null,
      hasNextPage: false,
    };
  }
  
  const supabase = await createClient();
  
  // Always fetch unfiltered total count first (for empty state logic)
  const { count: unfilteredTotalCount, error: unfilteredCountError } = await supabase
    .from('connections')
    .select('id', { count: 'exact', head: true })
    .eq('agency_id', context.orgId);
  
  if (unfilteredCountError) {
    console.error('Error fetching unfiltered total count:', unfilteredCountError);
  }
  
  // Build base query with joins including profiles for account manager search
  let query = supabase
    .from('connections')
    .select(`
      id,
      created_at,
      connection_status,
      engagement_status,
      health_status,
      contract_end_on,
      agency_primary_contact_id,
      client_id,
      organizations!connections_client_id_fkey (
        id,
        name,
        logo_url,
        is_draft
      ),
      profiles!connections_agency_primary_contact_id_fkey (
        id,
        first_name,
        last_name,
        email,
        job_title,
        avatar_url
      )
    `)
    .eq('agency_id', context.orgId);
  
  // Apply sorting at database level
  switch (sort) {
    case 'newest-first':
      query = query.order('created_at', { ascending: false });
      break;
    case 'alphabetical':
      query = query.order('organizations(name)', { ascending: true });
      break;
    case 'reverse-alphabetical':
      query = query.order('organizations(name)', { ascending: false });
      break;
    case 'contract-end-soonest':
      // Sort by contract_end_on ascending (NULLS LAST)
      query = query.order('contract_end_on', { ascending: true, nullsFirst: false });
      break;
    case 'status-critical-first':
      // Sort by health_status priority, then by name
      // We'll need to handle this with a custom order or post-process
      // For now, order by health_status then name
      query = query.order('health_status', { ascending: true }).order('organizations(name)', { ascending: true });
      break;
    default:
      query = query.order('created_at', { ascending: false });
  }
  
  // When searching, fetch all connections first (for account manager search), then filter and paginate in memory
  // When not searching, apply pagination at database level for performance
  const startIndex = cursor ? decodeCursor(cursor) : 0;
  if (!search.trim()) {
    query = query.range(startIndex, startIndex + limit - 1);
  }
  
  // Execute query
  const { data: connections, error } = await query;
  
  if (error) {
    console.error('Error fetching connections:', {
      error,
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
      agencyId: context.orgId,
    });
    return {
      clients: [],
      total: 0,
      unfilteredTotalCount: 0,
      cursor: null,
      hasNextPage: false,
    };
  }
  
  const connectionsArray = connections || [];
  
  // Fetch agency organization data (needed for account manager organization info)
  const { data: agencyOrg, error: agencyError } = await supabase
    .from('organizations')
    .select('id, name, logo_url')
    .eq('id', context.orgId)
    .single();

  if (agencyError) {
    console.error('Error fetching agency organization:', {
      error: agencyError,
      orgId: context.orgId,
    });
  }
  
  // Apply search filter in memory (supports all fields including account manager)
  let filteredConnections = connectionsArray;
  
  if (search.trim()) {
    const _escapedSearch = escapeForILike(search.trim());
    const searchLower = search.trim().toLowerCase();
    const searchTerms = searchLower.split(' ').filter(t => t.length > 0);
    
    filteredConnections = connectionsArray.filter(conn => {
      const org = conn.organizations as { name?: string } | null;
      const orgName = (org?.name || '').toLowerCase();
      const connectionStatus = (conn.connection_status || '').toLowerCase();
      const engagementStatus = (conn.engagement_status || '').toLowerCase();
      const healthStatus = (conn.health_status || '').toLowerCase();
      const contractEnd = conn.contract_end_on 
        ? new Date(conn.contract_end_on).toLocaleDateString('en-GB', { 
            day: 'numeric', month: 'short', year: 'numeric' 
          }).toLowerCase()
        : '';
      
      // Get account manager name from joined profile
      const profile = conn.profiles as { first_name?: string; last_name?: string } | null;
      const accountManagerName = profile
        ? `${(profile.first_name || '').toLowerCase()} ${(profile.last_name || '').toLowerCase()}`.trim()
        : '';
      
      // Check if all search terms match any field
      return searchTerms.every(term => 
        orgName.includes(term) ||
        connectionStatus.includes(term) ||
        engagementStatus.includes(term) ||
        healthStatus.includes(term) ||
        contractEnd.includes(term) ||
        accountManagerName.includes(term)
      );
    });
  }
  
  // Get total count for pagination
  // When searching, use filtered count; otherwise use unfilteredTotalCount
  const totalCount = search.trim() 
    ? filteredConnections.length 
    : (unfilteredTotalCount ?? connectionsArray.length);
  
  // Transform connections to Client format
  const allClients: Client[] = filteredConnections.map(conn => {
    // Handle case where organizations join might be null due to RLS or missing data
    const org = conn.organizations as { name?: string; logo_url?: string; id?: string; is_draft?: boolean } | null;
    const profile = conn.profiles as { 
      id?: string; 
      first_name?: string; 
      last_name?: string; 
      email?: string; 
      job_title?: string; 
      avatar_url?: string;
    } | null;
    
    // If org is null but we have a client_id, it might be a draft org blocked by RLS
    // In that case, we can infer it's a draft from the connection_status
    // Note: 'invited' connections are not considered drafts (they can't be deleted)
    // Only mark as draft if BOTH the org is a draft AND the connection status is 'internal'
    const isDraft = (org?.is_draft ?? false) && (conn.connection_status === 'internal');
    
    // Build account manager data from joined profile
    const accountManager = conn.agency_primary_contact_id && profile
      ? {
          id: profile.id || '',
          name: `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Unknown',
          firstName: profile.first_name || '',
          lastName: profile.last_name || '',
          email: profile.email || '',
          jobTitle: profile.job_title || undefined,
          avatar: profile.avatar_url || undefined,
          organization: {
            id: agencyOrg?.id || context.organization.id,
            name: agencyOrg?.name || context.organization.name,
            logo_url: agencyOrg?.logo_url || context.organization.logoUrl || undefined
          }
        }
      : {
          id: '',
          name: 'Unassigned',
          firstName: '',
          lastName: '',
          email: '',
          jobTitle: undefined,
          avatar: undefined,
          organization: {
            id: agencyOrg?.id || context.organization.id,
            name: agencyOrg?.name || context.organization.name,
            logo_url: agencyOrg?.logo_url || context.organization.logoUrl || undefined
          }
        };
    
    return {
      id: conn.id, // Connection ID
      clientId: conn.client_id, // Client organization ID (for deletion)
      createdAt: conn.created_at || undefined,
      name: org?.name || 'Unknown Client',
      logo: org?.logo_url,
      status: (conn.connection_status as "internal" | "invited" | "onboarding" | "active" | "offboarded") || 'internal', // Used for connection badge color
      is_draft: isDraft, // Indicates if this is a draft client organization
      accountManager,
      contractEnd: conn.contract_end_on 
        ? new Date(conn.contract_end_on).toLocaleDateString('en-GB', { 
            day: 'numeric', 
            month: 'short', 
            year: 'numeric' 
          })
        : undefined,
      health: (conn.health_status as "unassigned" | "healthy" | "at-risk" | "critical" | "n/a") || 'unassigned',
      badge: conn.engagement_status || undefined // Status column shows engagement_status
    };
  });
  
  // Apply post-processing for complex sorts that require client-side logic
  let sortedClients = allClients;
  if (sort === 'status-critical-first') {
    const healthPriority = {
      'critical': 0,
      'at-risk': 1,
      'healthy': 2,
      'unassigned': 3,
      'n/a': 4
    };
    
    sortedClients = [...allClients].sort((a, b) => {
      const priorityA = healthPriority[a.health as keyof typeof healthPriority] ?? 999;
      const priorityB = healthPriority[b.health as keyof typeof healthPriority] ?? 999;
      
      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }
      
      return a.name.localeCompare(b.name);
    });
  }

  // Apply pagination (in memory when searching, already applied at DB level when not searching)
  const endIndex = startIndex + limit;
  let paginatedClients = sortedClients;
  
  if (search.trim()) {
    // Paginate in memory after filtering/sorting
    paginatedClients = sortedClients.slice(startIndex, endIndex);
  }
  
  // Calculate total and pagination state
  const total = totalCount;
  const hasNextPage = endIndex < total;

  return {
    clients: paginatedClients,
    total,
    unfilteredTotalCount: unfilteredTotalCount || 0,
    cursor: hasNextPage ? encodeCursor(endIndex) : null,
    hasNextPage,
  };
});

export function invalidateClients(orgId: string) {
  // TODO: Implement cache invalidation when using real data
  // revalidateTag(`clients:${orgId}`);
  console.log(`Invalidating clients cache for org: ${orgId}`);
}

