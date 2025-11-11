import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
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
const MONTH_MAP: { [key: string]: number } = {
  'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
  'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
} as const;

function generateMockData(): Client[] {
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
      status: (["draft", "onboarding", "active", "offboarded"] as const)[clientId % 4],
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
  
  // Fetch real data from connections table
  const supabase = await createClient();
  
  // Get connections for this agency with related organization and contact data
  // RLS policy allows reading organizations through connections if user's org owns the connection
  const { data: connections, error } = await supabase
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
      )
    `)
    .eq('agency_id', context.orgId)
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('Error fetching connections:', error);
    // Return empty snapshot on error
    return {
      clients: [],
      total: 0,
      cursor: null,
      hasNextPage: false,
    };
  }
  
  // Fetch account manager profiles for connections that have agency_primary_contact_id
  const connectionsWithContactIds = (connections || []).filter(conn => conn.agency_primary_contact_id);
  const contactIds = connectionsWithContactIds.map(conn => conn.agency_primary_contact_id);
  
  let accountManagerProfiles: { [key: string]: { 
    id: string; 
    name: string; 
    firstName: string; 
    lastName: string; 
    email: string; 
    jobTitle?: string; 
    avatar?: string;
    organization: {
      id: string;
      name: string;
      logo_url?: string;
    }
  } } = {};
  
  if (contactIds.length > 0) {
    // Fetch agency organization data
    const { data: agencyOrg, error: agencyError } = await supabase
      .from('organizations')
      .select('id, name, logo_url')
      .eq('id', context.orgId)
      .single();

    if (agencyError) {
      console.error('Error fetching agency organization:', agencyError);
    }

    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, email, job_title, avatar_url')
      .in('id', contactIds);
    
    if (profilesError) {
      console.error('Error fetching account manager profiles:', profilesError);
    } else {
      // Create a map of profile ID to profile data
      accountManagerProfiles = (profiles || []).reduce((acc, profile) => {
        acc[profile.id] = {
          id: profile.id,
          name: `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Unknown',
          firstName: profile.first_name || '',
          lastName: profile.last_name || '',
          email: profile.email || '',
          jobTitle: profile.job_title || undefined,
          avatar: profile.avatar_url || undefined,
          organization: {
            id: agencyOrg?.id || '',
            name: agencyOrg?.name || 'Agency',
            logo_url: agencyOrg?.logo_url || undefined
          }
        };
        return acc;
      }, {} as { [key: string]: { 
        id: string; 
        name: string; 
        firstName: string; 
        lastName: string; 
        email: string; 
        jobTitle?: string; 
        avatar?: string;
        organization: {
          id: string;
          name: string;
          logo_url?: string;
        }
      } });
    }
  }

  // Transform connections to Client format
  const allClients: Client[] = (connections || []).map(conn => {
    const org = conn.organizations as { name?: string; logo_url?: string } | null;
    
    return {
      id: conn.id,
      createdAt: conn.created_at || undefined,
      name: org?.name || 'Unknown Client',
      logo: org?.logo_url,
      status: (conn.connection_status as "draft" | "onboarding" | "active" | "offboarded") || 'draft', // Used for connection badge color
      accountManager: conn.agency_primary_contact_id
        ? (accountManagerProfiles[conn.agency_primary_contact_id] || { 
            id: '', 
            name: 'Loading...', 
            firstName: '', 
            lastName: '', 
            email: '', 
            jobTitle: undefined, 
            avatar: undefined,
            organization: {
              id: '',
              name: 'Agency',
              logo_url: undefined
            }
          })
        : { 
            id: '', 
            name: 'Unassigned', 
            firstName: '', 
            lastName: '', 
            email: '', 
            jobTitle: undefined, 
            avatar: undefined,
            organization: {
              id: '',
              name: 'Agency',
              logo_url: undefined
            }
          },
      contractEnd: conn.contract_end_on 
        ? new Date(conn.contract_end_on).toLocaleDateString('en-GB', { 
            day: 'numeric', 
            month: 'short', 
            year: 'numeric' 
          })
        : undefined,
      health: conn.health_status || 'unassigned',
      badge: conn.engagement_status || undefined // Status column shows engagement_status
    };
  });

  // Apply search filter
  let filteredClients = allClients;
  if (search) {
    const query = search.toLowerCase().trim();
    
    // Pre-compute search terms for better performance
    const searchTerms = query.split(' ').filter(term => term.length > 0);
    
    filteredClients = allClients.filter(client => {
      // Early exit if no search terms
      if (searchTerms.length === 0) return true;
      
      // Create searchable text once per client
      const searchableText = [
        client.name.toLowerCase(),
        client.accountManager.name.toLowerCase(),
        client.status.toLowerCase(),
        client.health.toLowerCase(),
        client.contractEnd?.toLowerCase() || '',
        client.badge?.toLowerCase() || ''
      ].join(' ');
      
      // Check if all search terms are present
      const allTermsMatch = searchTerms.every(term => searchableText.includes(term));
      
      // Smart number matching for client names (only if query starts with 'client ')
      let numberMatch = false;
      if (query.startsWith('client ') && searchTerms.length === 1) {
        const numberPart = searchTerms[0].replace('client', '');
        if (/^\d+$/.test(numberPart)) {
          const searchNumber = parseInt(numberPart);
          const clientNumber = parseInt(client.name.replace('Client ', ''));
          numberMatch = clientNumber === searchNumber;
        }
      }
      
      return allTermsMatch || numberMatch;
    });
  }

  // Sort clients based on sort parameter
  const sortedClients = filteredClients.sort((a, b) => {
    switch (sort) {
      case 'newest-first':
        // Sort by ID descending (higher ID = newer)
        return parseInt(b.id) - parseInt(a.id);
      
      case 'alphabetical':
        return a.name.localeCompare(b.name); // A to Z
      
      case 'reverse-alphabetical':
        return b.name.localeCompare(a.name); // Z to A
      
      case 'contract-end-soonest':
        // Sort by contract end date (soonest first)
        // Clients without contracts go to the end
        if (!a.contractEnd && !b.contractEnd) return 0;
        if (!a.contractEnd) return 1;
        if (!b.contractEnd) return -1;
        
        // Parse dates (format: "DD MMM YYYY")
        const parseDate = (dateStr: string) => {
          const [day, month, year] = dateStr.split(' ');
          return new Date(parseInt(year), MONTH_MAP[month], parseInt(day));
        };
        
        const dateA = parseDate(a.contractEnd);
        const dateB = parseDate(b.contractEnd);
        return dateA.getTime() - dateB.getTime();
      
      case 'status-critical-first':
        // Sort by health priority (critical first), then alphabetically within each category
        const healthPriority = {
          'critical': 0,
          'at-risk': 1,
          'healthy': 2,
          'unassigned': 3
        };
        
        const priorityA = healthPriority[a.health as keyof typeof healthPriority] ?? 999;
        const priorityB = healthPriority[b.health as keyof typeof healthPriority] ?? 999;
        
        // If different priorities, sort by priority
        if (priorityA !== priorityB) {
          return priorityA - priorityB;
        }
        
        // If same priority, sort alphabetically by name
        return a.name.localeCompare(b.name);
      
      default:
        return a.name.localeCompare(b.name); // Default to A to Z
    }
  });

  // Apply cursor-based pagination
  const startIndex = cursor ? decodeCursor(cursor) : 0;
  const endIndex = startIndex + limit;
  const paginatedClients = sortedClients.slice(startIndex, endIndex);

  return {
    clients: paginatedClients,
    total: sortedClients.length,
    cursor: endIndex < sortedClients.length ? encodeCursor(endIndex) : null,
    hasNextPage: endIndex < sortedClients.length,
  };
});

export function invalidateClients(orgId: string) {
  // TODO: Implement cache invalidation when using real data
  // revalidateTag(`clients:${orgId}`);
  console.log(`Invalidating clients cache for org: ${orgId}`);
}

