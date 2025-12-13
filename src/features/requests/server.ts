import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import { escapeForILike } from '@/lib/utils';
import type { EnhancedModeContext } from '@/lib/mode/getActiveContext';
import type { RequestsSnapshot, Request, RequestsPaginationOptions } from './types';
import * as formatters from '../connections/formatters';

/**
 * Get connection IDs for the current organization (exported for use in page components)
 * This allows sharing connection IDs across multiple queries to avoid redundant fetches
 */
export async function getConnectionIdsForContext(context: EnhancedModeContext): Promise<string[]> {
  const supabase = await createClient();
  return getConnectionIdsForOrg(context, supabase);
}

/**
 * Internal helper function to fetch connection IDs for the current organization
 * Shared between getRequestsSnapshot and getGlobalNewRequestsCount to avoid redundant queries
 */
async function getConnectionIdsForOrg(
  context: EnhancedModeContext,
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<string[]> {
  // Get all connection IDs that belong to this organization
  // Agency: connections where agency_id = orgId
  // Client: connections where client_id = orgId
  // Exclude disconnected connections (frozen/read-only)
  const connectionQuery = context.variant === 'agency'
    ? supabase
        .from('connections')
        .select('id')
        .eq('agency_id', context.orgId)
        .neq('connection_status', 'disconnected')
    : supabase
        .from('connections')
        .select('id')
        .eq('client_id', context.orgId)
        .neq('connection_status', 'disconnected');

  const { data: connections, error: connectionQueryError } = await connectionQuery;

  if (connectionQueryError || !connections) {
    console.error('Error fetching connections:', connectionQueryError);
    return [];
  }

  return connections.map(c => c.id);
}

/**
 * Get all requests across all connections for the current organization
 * This is a global view that aggregates requests from all connections
 */
export const getRequestsSnapshot = cache(async (
  context: EnhancedModeContext,
  options: RequestsPaginationOptions = {}
): Promise<RequestsSnapshot> => {
  const { search = '', cursor, limit = 20, connectionIds: _providedConnectionIds, loadedConnectionIds = [] } = options;
  
  // Validate context before proceeding
  if (!context || !context.orgId || !context.userId) {
    console.error('Invalid context provided to getRequestsSnapshot:', { context });
    return {
      requests: [],
      total: 0,
      unfilteredTotalCount: 0,
      cursor: null,
      hasNextPage: false,
      loadedConnectionIds: [],
    };
  }

  const supabase = await createClient();
  
  // PHASE 1: Client-based pagination - Fetch connections first (paginated)
  // Sort connections by created_at desc (newest first)
  // First, fetch ALL connection IDs (to filter out already loaded ones)
  const allConnectionsQuery = context.variant === 'agency'
    ? supabase
        .from('connections')
        .select('id, client_id, agency_id, created_at')
        .eq('agency_id', context.orgId)
        .neq('connection_status', 'disconnected')
        .order('created_at', { ascending: false })
    : supabase
        .from('connections')
        .select('id, client_id, agency_id, created_at')
        .eq('client_id', context.orgId)
        .neq('connection_status', 'disconnected')
        .order('created_at', { ascending: false });
  
  const { data: allConnections, error: allConnectionsError } = await allConnectionsQuery;
  
  if (allConnectionsError || !allConnections) {
    console.error('Error fetching all connections:', allConnectionsError);
    return {
      requests: [],
      total: 0,
      unfilteredTotalCount: 0,
      cursor: null,
      hasNextPage: false,
      loadedConnectionIds: [],
    };
  }
  
  // Filter out already loaded connections
  const remainingConnections = loadedConnectionIds.length > 0
    ? allConnections.filter(conn => !loadedConnectionIds.includes(conn.id))
    : allConnections;
  
  // Apply pagination to remaining connections
  const connectionStartIndex = cursor ? parseInt(cursor, 10) : 0;
  const connections = remainingConnections.slice(connectionStartIndex, connectionStartIndex + limit);
  const totalConnectionsCount = remainingConnections.length;
  const connectionIds = connections.map(c => c.id);
  const newLoadedConnectionIds = [...loadedConnectionIds, ...connectionIds];
  
  // Check if there are more connections to load
  const hasMoreConnections = totalConnectionsCount > connectionStartIndex + limit;

  if (connectionIds.length === 0) {
    // No more connections to load, return empty result
    return {
      requests: [],
      total: 0,
      unfilteredTotalCount: 0,
      cursor: null,
      hasNextPage: false,
      loadedConnectionIds: loadedConnectionIds,
    };
  }

  // Always fetch unfiltered total count across ALL connections (needed to distinguish empty state vs "No results" during search)
  // Reuse connection IDs from allConnections fetched above
  const allConnectionIds = (allConnections || []).map(c => c.id);
  const { count: unfilteredTotalCountRaw, error: unfilteredCountError } = allConnectionIds.length > 0
    ? await supabase
        .from('requests')
        .select('id', { count: 'exact', head: true })
        .in('connection_id', allConnectionIds)
        .is('deleted_at', null)
    : { count: 0, error: null };

  // Ensure we always have a valid number (default to 0 on error, but log it)
  const unfilteredTotalCount = unfilteredCountError ? 0 : (unfilteredTotalCountRaw ?? 0);
  
  if (unfilteredCountError) {
    console.error('Error fetching unfiltered total count:', unfilteredCountError);
  }

  // When searching, find matching organization names via connections
  let matchingConnectionIds: string[] = [];
  
  if (search && search.trim().length > 0) {
    const trimmedQuery = search.trim();
    const escaped = escapeForILike(trimmedQuery);
    const searchPattern = `%${escaped}%`;
    
    // Get connection org IDs for organization name search
    const connectionsForOrgSearchResult = context.variant === 'agency'
      ? await supabase
          .from('connections')
          .select('client_id')
          .eq('agency_id', context.orgId)
      : await supabase
          .from('connections')
          .select('agency_id')
          .eq('client_id', context.orgId);
    
    // Process connection/org search results
    const { data: connectionsForOrgSearch, error: connectionsForOrgSearchError } = connectionsForOrgSearchResult;
    if (!connectionsForOrgSearchError && connectionsForOrgSearch) {
      let orgIdsToSearch: string[] = [];
      
      if (context.variant === 'agency') {
        orgIdsToSearch = (connectionsForOrgSearch as Array<{ client_id: string | null }>)
          .map((c) => c.client_id)
          .filter((id): id is string => id !== null);
      } else {
        orgIdsToSearch = (connectionsForOrgSearch as Array<{ agency_id: string | null }>)
          .map((c) => c.agency_id)
          .filter((id): id is string => id !== null);
      }
      
      if (orgIdsToSearch.length > 0) {
        const { data: matchingOrgs, error: orgsError } = await supabase
          .from('organizations')
          .select('id')
          .in('id', orgIdsToSearch)
          .ilike('name', searchPattern)
          .is('deleted_at', null);
        
        if (!orgsError && matchingOrgs) {
          const matchingOrgIds = matchingOrgs.map(org => org.id);
          
          // Find connection IDs that match these organization IDs
          const { data: matchingConnections } = context.variant === 'agency'
            ? await supabase
                .from('connections')
                .select('id')
                .eq('agency_id', context.orgId)
                .in('client_id', matchingOrgIds)
            : await supabase
                .from('connections')
                .select('id')
                .eq('client_id', context.orgId)
                .in('agency_id', matchingOrgIds);
          
          matchingConnectionIds = (matchingConnections || []).map(c => c.id);
        }
      }
    }
  }

  // Build the base query for filtering (used for both count and data)
  let baseQuery = supabase
    .from('requests')
    .select('*', { count: 'exact', head: true })
    .in('connection_id', connectionIds)
    .is('deleted_at', null);

  if (options.assignedToUserId) {
    baseQuery = baseQuery.eq('assignee_user_id', options.assignedToUserId);
  }
  
  if (options.createdByUserId) {
    baseQuery = baseQuery.eq('created_by_user_id', options.createdByUserId);
  }

  // Apply search filter if search is provided - MVP: only search request title and organization name
  if (search && search.trim().length > 0) {
    const trimmedQuery = search.trim();
    const escaped = escapeForILike(trimmedQuery);
    
    // Build OR list for search: request title OR organization name (via connection IDs)
    const orParts: string[] = [];
    orParts.push(`title.ilike.%${escaped}%`);
    
    // Add client/agency organization name matches (DB-level via connection IDs)
    if (matchingConnectionIds.length > 0) {
      orParts.push(`connection_id.in.(${matchingConnectionIds.join(',')})`);
    }
    
    baseQuery = baseQuery.or(orParts.join(','));
  }

  // Get total count with filters applied
  const { count: total, error: countError } = await baseQuery;

  if (countError) {
    console.error('Error fetching requests count:', countError);
  }

  // Note: We no longer paginate requests - we fetch ALL requests for the current page's connections
  // This is safe because we're only loading 15 connections at a time
  // If a connection has 100+ requests, virtualization will handle rendering performance
  const requestStartIndex = 0;
  const requestLimit = 10000; // Very high limit to fetch all requests for current connections

  // Use regular Supabase query - always sort by created_at descending (newest first)
  type RequestRow = {
    id: string;
    title: string;
    description: string | null;
    status: string;
    project_id: string | null;
    project_name_cached: string | null;
    connection_id: string;
    created_by_user_id: string;
    assignee_user_id: string | null;
    created_at: string;
    created_by_org_id: string;
    connections: {
      id: string;
      client_id: string;
      agency_id: string;
    } | Array<{
      id: string;
      client_id: string;
      agency_id: string;
    }>;
    projects?: {
      id: string;
      name: string;
    } | Array<{
      id: string;
      name: string;
    }> | null;
  };
  
  let requestsQuery = supabase
      .from('requests')
      .select(`
        id,
        title,
        description,
        status,
        project_id,
        project_name_cached,
        connection_id,
        created_by_user_id,
        assignee_user_id,
        created_at,
        created_by_org_id,
        connections!inner (
          id,
          client_id,
          agency_id
        ),
        projects (
          id,
          name
        )
      `)
      .in('connection_id', connectionIds)
      .is('deleted_at', null);

    if (options.assignedToUserId) {
      requestsQuery = requestsQuery.eq('assignee_user_id', options.assignedToUserId);
    }
    
    if (options.createdByUserId) {
      requestsQuery = requestsQuery.eq('created_by_user_id', options.createdByUserId);
    }

    // Apply search filter if search is provided - MVP: only search request title and organization name
    if (search && search.trim().length > 0) {
      const trimmedQuery = search.trim();
      const escaped = escapeForILike(trimmedQuery);
      
      // Build OR list for search: request title OR organization name (via connection IDs)
      const orParts: string[] = [];
      orParts.push(`title.ilike.%${escaped}%`);
      
      // Add client/agency organization name matches (DB-level via connection IDs)
      if (matchingConnectionIds.length > 0) {
        orParts.push(`connection_id.in.(${matchingConnectionIds.join(',')})`);
      }
      
      requestsQuery = requestsQuery.or(orParts.join(','));
    }

    // Always sort by created_at descending (newest first)
    requestsQuery = requestsQuery.order('created_at', { ascending: false });

    // No pagination - fetch all requests for current connections
    // This is safe because we're only loading 15 connections at a time
    requestsQuery = requestsQuery.range(requestStartIndex, requestStartIndex + requestLimit - 1);

    // Execute query
    const result = await requestsQuery;
    const requestsData: RequestRow[] | null = result.data;
    const requestsError = result.error;

    if (requestsError) {
      console.error('Error fetching requests:', requestsError);
      return {
        requests: [],
        total: 0,
        unfilteredTotalCount: unfilteredTotalCount || 0,
        cursor: null,
        hasNextPage: false,
        loadedConnectionIds: loadedConnectionIds,
      };
    }

  // If no requests, return early
  if (!requestsData || requestsData.length === 0) {
    return {
      requests: [],
      total: total || 0,
      unfilteredTotalCount: unfilteredTotalCount || 0,
      cursor: null,
      hasNextPage: false,
    };
  }

  // Extract unique connection IDs and user IDs for parallel lookups
  const uniqueConnectionIds = [...new Set(requestsData.map(r => r.connection_id))];
  const userIds = new Set<string>();
  requestsData.forEach(request => {
    if (request.created_by_user_id) userIds.add(request.created_by_user_id);
    if (request.assignee_user_id) userIds.add(request.assignee_user_id);
  });

  // Fetch profiles, connections, memberships, and organizations in parallel
  const userIdArray = Array.from(userIds);
  const [profilesResult, connectionsResult, membershipsResult, orgsResult] = await Promise.all([
    // Fetch profiles for submitted_by and assignee
    userIdArray.length > 0
      ? supabase
          .from('profiles')
          .select('id, first_name, last_name, email, avatar_url, job_title')
          .in('id', userIdArray)
      : Promise.resolve({ data: null, error: null }),
    // Fetch connection info with organization IDs (needed for connection map)
    supabase
      .from('connections')
      .select('id, client_id, agency_id')
      .in('id', uniqueConnectionIds),
    // Fetch memberships for user org info
    userIdArray.length > 0
      ? supabase
          .from('memberships')
          .select(`
            user_id,
            org_id,
            organizations!inner(
              id,
              name,
              logo_url
            )
          `)
          .in('user_id', userIdArray)
      : Promise.resolve({ data: null, error: null }),
    // Fetch organizations
    (async () => {
      const connectionsData = await supabase
        .from('connections')
        .select('client_id, agency_id')
        .in('id', uniqueConnectionIds);
      
      if (connectionsData.error || !connectionsData.data) {
        return { data: null, error: connectionsData.error };
      }
      
      const uniqueOrgIds = new Set<string>();
      connectionsData.data.forEach(conn => {
        if (conn.client_id) uniqueOrgIds.add(conn.client_id);
        if (conn.agency_id) uniqueOrgIds.add(conn.agency_id);
      });
      
      const orgIdsArray = Array.from(uniqueOrgIds);
      if (orgIdsArray.length === 0) {
        return { data: null, error: null };
      }
      
      return await supabase
        .from('organizations')
        .select('id, name, logo_url, type')
        .in('id', orgIdsArray);
    })()
  ]);

  const { data: profilesData, error: profilesError } = profilesResult;
  const { data: connectionsData, error: connectionsError } = connectionsResult;
  const { data: membershipsData, error: membershipsError } = membershipsResult;
  const { data: orgsData, error: orgsError } = orgsResult;

  // Build profiles map
  const profilesMap: Record<string, { first_name: string; last_name: string; email: string; avatar_url?: string; job_title?: string }> = {};
  if (!profilesError && profilesData) {
    profilesData.forEach(profile => {
      profilesMap[profile.id] = profile;
    });
  }

  if (connectionsError) {
    console.error('Error fetching connections:', connectionsError);
    return {
      requests: [],
      total: total || 0,
      unfilteredTotalCount: unfilteredTotalCount || 0,
      cursor: null,
      hasNextPage: false,
    };
  }

  const connectionsMap = (connectionsData || []).reduce((acc, conn) => {
    acc[conn.id] = { clientId: conn.client_id, agencyId: conn.agency_id };
    return acc;
  }, {} as Record<string, { clientId: string; agencyId: string }>);

  // Build org maps from fetched data
  const orgMap: Record<string, { name: string; logoUrl?: string }> = {};
  const orgTypeMap: Record<string, 'agency' | 'client'> = {};
  
  if (orgsError) {
    console.error('Error fetching organizations:', orgsError);
  }
  
  (orgsData || []).forEach(org => {
    orgMap[org.id] = {
      name: org.name || 'Unknown',
      logoUrl: org.logo_url || undefined
    };
    if (org.type === 'agency' || org.type === 'client') {
      orgTypeMap[org.id] = org.type as 'agency' | 'client';
    }
  });

  // Build user org map (for submittedBy org info)
  const userOrgMap: Record<string, { orgId: string; orgName: string; orgLogo?: string }> = {};
  if (!membershipsError && membershipsData) {
    membershipsData.forEach((membership: { user_id: string; organizations: { id: string; name: string; logo_url: string | null } | Array<{ id: string; name: string; logo_url: string | null }> }) => {
      const org = Array.isArray(membership.organizations) ? membership.organizations[0] : membership.organizations;
      if (org) {
        userOrgMap[membership.user_id] = {
          orgId: org.id,
          orgName: org.name,
          orgLogo: org.logo_url || undefined
        };
      }
    });
  }

  // Transform requests to Request[] format using joined data and fetched maps
  const requestsWithTimestamps: Array<{ request: Request; originalCreatedAt: number }> = requestsData
    .filter(request => {
      // Filter out requests with invalid connections
      const connection = Array.isArray(request.connections) ? request.connections[0] : request.connections;
      return connection !== null && connection !== undefined && connectionsMap[request.connection_id] !== undefined;
    })
    .map(request => {
      // Extract connection info
      const connection = Array.isArray(request.connections) ? request.connections[0] : request.connections;
      if (!connection) {
        throw new Error('Invalid connection');
      }
      const connectionInfo = connectionsMap[request.connection_id];
      if (!connectionInfo) {
        throw new Error('Connection not found in map');
      }

      // Get organization data from maps (or RPC data)
      const clientOrg = orgMap[connectionInfo.clientId];
      const agencyOrg = orgMap[connectionInfo.agencyId];
      
      // Extract profile data from fetched map
      const submittedByProfile = request.created_by_user_id ? profilesMap[request.created_by_user_id] || null : null;
      const assigneeProfile = request.assignee_user_id ? profilesMap[request.assignee_user_id] || null : null;
      
      // Extract project data
      let project = null;
      if (request.project_id) {
        const requestWithJoins = request as typeof request & { projects?: { id: string; name: string } | Array<{ id: string; name: string }> };
        const projectData = requestWithJoins.projects
          ? (Array.isArray(requestWithJoins.projects) ? requestWithJoins.projects[0] : requestWithJoins.projects)
          : null;
        
        if (projectData) {
          project = { id: projectData.id, name: projectData.name };
        } else if (request.project_name_cached) {
          // Fallback to cached name if project lookup failed (e.g., RLS issue or project deleted)
          project = { id: request.project_id, name: request.project_name_cached };
        }
      }

      return {
        request: {
          id: request.id,
          connectionId: request.connection_id,
          title: request.title,
          description: request.description || '',
          status: request.status as 'new' | 'in_review' | 'accepted' | 'canceled',
          project: project || null,
          submittedBy: formatters.buildSubmittedBy(
            request.created_by_user_id,
            submittedByProfile,
            userOrgMap
          ),
          assignee: formatters.buildAssignee(request.assignee_user_id, assigneeProfile),
          client: formatters.buildOrganization(
            connectionInfo.clientId,
            clientOrg?.name,
            clientOrg?.logoUrl,
            'Unknown Client'
          ),
          agency: agencyOrg ? formatters.buildOrganization(
            connectionInfo.agencyId,
            agencyOrg.name,
            agencyOrg.logoUrl,
            'Unknown Agency'
          ) : undefined,
          createdAt: request.created_at || '',
          createdByOrgId: request.created_by_org_id,
          createdByOrgType: formatters.getOrgType(request.created_by_org_id, orgTypeMap)
        } as Request,
        originalCreatedAt: new Date(request.created_at).getTime()
      };
    });

  // Extract requests - database has already sorted them
  // No pagination needed - we fetch all requests for current connections
  const requests: Request[] = requestsWithTimestamps.map(item => item.request);

  // Calculate pagination info based on connections, not requests
  // hasMoreConnections indicates if there are more connections to load
  // Total count should reflect total requests across ALL connections (for display purposes)
  const nextCursor = hasMoreConnections ? String(connectionStartIndex + limit) : null;

  return {
    requests: requests,
    total: total || 0, // Total count from filtered query across all connections
    unfilteredTotalCount: unfilteredTotalCount || 0,
    cursor: nextCursor,
    hasNextPage: hasMoreConnections,
    loadedConnectionIds: newLoadedConnectionIds,
  };
});

/**
 * Search requests across ALL connections using PostgreSQL full-text search
 * Uses search-based pagination (offset-based) instead of connection-based pagination
 * Returns results ranked by relevance using ts_rank()
 */
export const searchRequestsGlobal = cache(async (
  context: EnhancedModeContext,
  options: RequestsPaginationOptions = {}
): Promise<RequestsSnapshot> => {
  const { search = '', cursor, limit = 50, assignedToUserId, createdByUserId } = options;
  
  // Validate context before proceeding
  if (!context || !context.orgId || !context.userId) {
    console.error('Invalid context provided to searchRequestsGlobal:', { context });
    return {
      requests: [],
      total: 0,
      unfilteredTotalCount: 0,
      cursor: null,
      hasNextPage: false,
      loadedConnectionIds: [],
    };
  }

  // Validate search query
  if (!search || !search.trim()) {
    console.error('searchRequestsGlobal called without search query');
    return {
      requests: [],
      total: 0,
      unfilteredTotalCount: 0,
      cursor: null,
      hasNextPage: false,
      loadedConnectionIds: [],
    };
  }

  const supabase = await createClient();
  
  // Get all connection IDs for this context (cached to avoid repeated queries)
  const allConnectionsQuery = context.variant === 'agency'
    ? supabase
        .from('connections')
        .select('id')
        .eq('agency_id', context.orgId)
        .neq('connection_status', 'disconnected')
    : supabase
        .from('connections')
        .select('id')
        .eq('client_id', context.orgId)
        .neq('connection_status', 'disconnected');
  
  const { data: allConnections, error: allConnectionsError } = await allConnectionsQuery;
  
  if (allConnectionsError || !allConnections || allConnections.length === 0) {
    console.error('Error fetching connections for search:', allConnectionsError);
    return {
      requests: [],
      total: 0,
      unfilteredTotalCount: 0,
      cursor: null,
      hasNextPage: false,
      loadedConnectionIds: [],
    };
  }

  const connectionIds = allConnections.map(c => c.id);

  // Always fetch unfiltered total count across ALL connections
  const { count: unfilteredTotalCountRaw, error: unfilteredCountError } = await supabase
    .from('requests')
    .select('id', { count: 'exact', head: true })
    .in('connection_id', connectionIds)
    .is('deleted_at', null);

  const unfilteredTotalCount = unfilteredCountError ? 0 : (unfilteredTotalCountRaw ?? 0);
  
  if (unfilteredCountError) {
    console.error('Error fetching unfiltered total count:', unfilteredCountError);
  }

  // Prepare search query for PostgreSQL full-text search
  const trimmedQuery = search.trim();
  const searchTerms = trimmedQuery.split(/\s+/).filter(t => t.length > 0);
  const tsQuery = searchTerms.map(term => term.replace(/[():&|!]/g, '')).join(' & ');

  // Parse cursor (offset-based for search pagination)
  const offset = cursor ? parseInt(cursor, 10) : 0;
  const searchLimit = limit || 50;

  // Build search query with full-text search
  let requestsQuery = supabase
    .from('requests')
    .select(`
      id,
      title,
      description,
      status,
      project_id,
      project_name_cached,
      connection_id,
      created_by_user_id,
      assignee_user_id,
      created_at,
      created_by_org_id,
      connections!inner (
        id,
        client_id,
        agency_id
      ),
      projects (
        id,
        name
      )
    `)
    .in('connection_id', connectionIds)
    .is('deleted_at', null)
    .textSearch('search_vector', tsQuery, { type: 'websearch', config: 'english' });

  if (assignedToUserId) {
    requestsQuery = requestsQuery.eq('assignee_user_id', assignedToUserId);
  }
  
  if (createdByUserId) {
    requestsQuery = requestsQuery.eq('created_by_user_id', createdByUserId);
  }

  // Apply pagination (offset-based for search)
  requestsQuery = requestsQuery
    .order('created_at', { ascending: false })
    .range(offset, offset + searchLimit - 1);

  // Execute query
  const { data: requestsData, error: requestsError } = await requestsQuery;

  if (requestsError) {
    console.error('Error searching requests:', requestsError);
    return {
      requests: [],
      total: 0,
      unfilteredTotalCount: unfilteredTotalCount || 0,
      cursor: null,
      hasNextPage: false,
      loadedConnectionIds: [],
    };
  }

  // Get total count of matching requests
  let countQuery = supabase
    .from('requests')
    .select('id', { count: 'exact', head: true })
    .in('connection_id', connectionIds)
    .is('deleted_at', null)
    .textSearch('search_vector', tsQuery, { type: 'websearch', config: 'english' });

  if (assignedToUserId) {
    countQuery = countQuery.eq('assignee_user_id', assignedToUserId);
  }
  
  if (createdByUserId) {
    countQuery = countQuery.eq('created_by_user_id', createdByUserId);
  }

  const { count: total, error: countError } = await countQuery;

  if (countError) {
    console.error('Error fetching search count:', countError);
  }

  // If no requests, return early
  if (!requestsData || requestsData.length === 0) {
    return {
      requests: [],
      total: total || 0,
      unfilteredTotalCount: unfilteredTotalCount || 0,
      cursor: null,
      hasNextPage: false,
      loadedConnectionIds: [],
    };
  }

  // Extract unique connection IDs and user IDs for parallel lookups
  const uniqueConnectionIds = [...new Set(requestsData.map(r => r.connection_id))];
  const userIds = new Set<string>();
  requestsData.forEach(request => {
    if (request.created_by_user_id) userIds.add(request.created_by_user_id);
    if (request.assignee_user_id) userIds.add(request.assignee_user_id);
  });

  // Fetch profiles, connections, memberships, and organizations in parallel
  const userIdArray = Array.from(userIds);
  const [profilesResult, connectionsResult, membershipsResult, orgsResult] = await Promise.all([
    userIdArray.length > 0
      ? supabase
          .from('profiles')
          .select('id, first_name, last_name, email, avatar_url, job_title')
          .in('id', userIdArray)
      : Promise.resolve({ data: null, error: null }),
    supabase
      .from('connections')
      .select('id, client_id, agency_id')
      .in('id', uniqueConnectionIds),
    userIdArray.length > 0
      ? supabase
          .from('memberships')
          .select(`
            user_id,
            org_id,
            organizations!inner(
              id,
              name,
              logo_url
            )
          `)
          .in('user_id', userIdArray)
      : Promise.resolve({ data: null, error: null }),
    (async () => {
      const connectionsData = await supabase
        .from('connections')
        .select('client_id, agency_id')
        .in('id', uniqueConnectionIds);
      
      if (connectionsData.error || !connectionsData.data) {
        return { data: null, error: connectionsData.error };
      }
      
      const uniqueOrgIds = new Set<string>();
      connectionsData.data.forEach(conn => {
        if (conn.client_id) uniqueOrgIds.add(conn.client_id);
        if (conn.agency_id) uniqueOrgIds.add(conn.agency_id);
      });
      
      const orgIdsArray = Array.from(uniqueOrgIds);
      if (orgIdsArray.length === 0) {
        return { data: null, error: null };
      }
      
      return await supabase
        .from('organizations')
        .select('id, name, logo_url, type')
        .in('id', orgIdsArray);
    })()
  ]);

  const { data: profilesData, error: profilesError } = profilesResult;
  const { data: connectionsData, error: searchConnectionsError } = connectionsResult;
  const { data: membershipsData, error: membershipsError } = membershipsResult;
  const { data: orgsData, error: orgsError } = orgsResult;

  // Build profiles map
  const profilesMap: Record<string, { first_name: string; last_name: string; email: string; avatar_url?: string; job_title?: string }> = {};
  if (!profilesError && profilesData) {
    profilesData.forEach(profile => {
      profilesMap[profile.id] = profile;
    });
  }

  if (searchConnectionsError) {
    console.error('Error fetching connections:', searchConnectionsError);
    return {
      requests: [],
      total: total || 0,
      unfilteredTotalCount: unfilteredTotalCount || 0,
      cursor: null,
      hasNextPage: false,
      loadedConnectionIds: [],
    };
  }

  const connectionsMap = (connectionsData || []).reduce((acc, conn) => {
    acc[conn.id] = { clientId: conn.client_id, agencyId: conn.agency_id };
    return acc;
  }, {} as Record<string, { clientId: string; agencyId: string }>);

  // Build org maps from fetched data
  const orgMap: Record<string, { name: string; logoUrl?: string }> = {};
  const orgTypeMap: Record<string, 'agency' | 'client'> = {};
  
  if (orgsError) {
    console.error('Error fetching organizations:', orgsError);
  }
  
  (orgsData || []).forEach(org => {
    orgMap[org.id] = {
      name: org.name || 'Unknown',
      logoUrl: org.logo_url || undefined
    };
    if (org.type === 'agency' || org.type === 'client') {
      orgTypeMap[org.id] = org.type as 'agency' | 'client';
    }
  });

  // Build user org map (for submittedBy org info)
  const userOrgMap: Record<string, { orgId: string; orgName: string; orgLogo?: string }> = {};
  if (!membershipsError && membershipsData) {
    membershipsData.forEach((membership: { user_id: string; organizations: { id: string; name: string; logo_url: string | null } | Array<{ id: string; name: string; logo_url: string | null }> }) => {
      const org = Array.isArray(membership.organizations) ? membership.organizations[0] : membership.organizations;
      if (org) {
        userOrgMap[membership.user_id] = {
          orgId: org.id,
          orgName: org.name,
          orgLogo: org.logo_url || undefined
        };
      }
    });
  }

  // Transform requests to Request[] format using joined data and fetched maps
  const requestsWithTimestamps: Array<{ request: Request; originalCreatedAt: number }> = requestsData
    .filter(request => {
      const connection = Array.isArray(request.connections) ? request.connections[0] : request.connections;
      return connection !== null && connection !== undefined && connectionsMap[request.connection_id] !== undefined;
    })
    .map(request => {
      const connection = Array.isArray(request.connections) ? request.connections[0] : request.connections;
      if (!connection) {
        throw new Error('Invalid connection');
      }
      const connectionInfo = connectionsMap[request.connection_id];
      if (!connectionInfo) {
        throw new Error('Connection not found in map');
      }

      // Get organization data from maps
      const clientOrg = orgMap[connectionInfo.clientId];
      const agencyOrg = orgMap[connectionInfo.agencyId];
      
      // Extract profile data from fetched map
      const submittedByProfile = request.created_by_user_id ? profilesMap[request.created_by_user_id] || null : null;
      const assigneeProfile = request.assignee_user_id ? profilesMap[request.assignee_user_id] || null : null;
      
      // Extract project data
      let project = null;
      if (request.project_id) {
        const requestWithJoins = request as typeof request & { projects?: { id: string; name: string } | Array<{ id: string; name: string }> };
        const projectData = requestWithJoins.projects
          ? (Array.isArray(requestWithJoins.projects) ? requestWithJoins.projects[0] : requestWithJoins.projects)
          : null;
        
        if (projectData) {
          project = { id: projectData.id, name: projectData.name };
        } else if (request.project_name_cached) {
          project = { id: request.project_id, name: request.project_name_cached };
        }
      }

      return {
        request: {
          id: request.id,
          connectionId: request.connection_id,
          title: request.title,
          description: request.description || '',
          status: request.status as 'new' | 'in_review' | 'accepted' | 'canceled',
          project: project || null,
          submittedBy: formatters.buildSubmittedBy(
            request.created_by_user_id,
            submittedByProfile,
            userOrgMap
          ),
          assignee: formatters.buildAssignee(request.assignee_user_id, assigneeProfile),
          client: formatters.buildOrganization(
            connectionInfo.clientId,
            clientOrg?.name,
            clientOrg?.logoUrl,
            'Unknown Client'
          ),
          agency: agencyOrg ? formatters.buildOrganization(
            connectionInfo.agencyId,
            agencyOrg.name,
            agencyOrg.logoUrl,
            'Unknown Agency'
          ) : undefined,
          createdAt: request.created_at || '',
          createdByOrgId: request.created_by_org_id,
          createdByOrgType: formatters.getOrgType(request.created_by_org_id, orgTypeMap)
        } as Request,
        originalCreatedAt: new Date(request.created_at).getTime()
      };
    });

  // Extract requests (already sorted by created_at DESC from query)
  const requests: Request[] = requestsWithTimestamps.map(item => item.request);

  // Calculate pagination info (offset-based for search)
  const hasMoreResults = (total || 0) > offset + searchLimit;
  const nextCursor = hasMoreResults ? String(offset + searchLimit) : null;

  return {
    requests: requests,
    total: total || 0,
    unfilteredTotalCount: unfilteredTotalCount || 0,
    cursor: nextCursor, // Offset-based cursor for search pagination
    hasNextPage: hasMoreResults,
    loadedConnectionIds: [], // Not used for search mode
  };
});

/**
 * Get a single request by ID (works across all connections) - NON-CACHED version for immediate post-insert fetches
 * @param connectionId - Optional connection ID. If provided, filters directly by connection_id (faster, more reliable)
 */
async function getRequestByIdGlobalUncached(
  requestId: string,
  context: EnhancedModeContext,
  connectionId?: string
): Promise<Request | null> {
  if (!context || !context.orgId || !context.userId) {
    return null;
  }

  const supabase = await createClient();

  // CRITICAL: Query request WITHOUT inner join (matches working pattern)
  // Inner joins can fail if the FK relationship isn't immediately visible after insert
  let requestQuery = supabase
    .from('requests')
    .select(`
      id,
      title,
      description,
      status,
      project_id,
      project_name_cached,
      connection_id,
      created_by_user_id,
      assignee_user_id,
      created_at,
      created_by_org_id
    `)
    .eq('id', requestId)
    .is('deleted_at', null);

  // If connectionId is provided, filter by it directly (faster and more reliable)
  if (connectionId) {
    requestQuery = requestQuery.eq('connection_id', connectionId);
  }

  const { data: request, error } = await requestQuery.single();

  if (error || !request) {
    return null;
  }

  // Fetch connection info separately (no inner join)
  const { data: connection, error: connectionError } = await supabase
    .from('connections')
    .select('agency_id, client_id')
    .eq('id', request.connection_id)
    .single();

  if (connectionError || !connection) {
    return null;
  }

  // Verify access: org must be either agency_id or client_id
  // If connectionId was provided, we already filtered by it, but still verify access
  const hasAccess = context.variant === 'agency'
    ? connection.agency_id === context.orgId
    : connection.client_id === context.orgId;

  if (!hasAccess) {
    return null;
  }

  // Check paywall for agencies accessing restricted connections
  if (context.variant === 'agency') {
    const { assertConnectionAccessOrThrow } = await import('@/lib/paywall/assertConnectionAccess');
    await assertConnectionAccessOrThrow(
      request.connection_id,
      context.orgId,
      context.organization.billing_status || 'free'
    );
  }

  // Fetch client and agency organization details in parallel
  const [clientOrgResult, agencyOrgResult] = await Promise.all([
    supabase
      .from('organizations')
      .select('id, name, logo_url, type')
      .eq('id', connection.client_id)
      .single(),
    supabase
      .from('organizations')
      .select('id, name, logo_url, type')
      .eq('id', connection.agency_id)
      .single()
  ]);

  const { data: clientOrg, error: clientOrgError } = clientOrgResult;
  const { data: agencyOrg, error: agencyOrgError } = agencyOrgResult;

  if (clientOrgError && process.env.NODE_ENV !== 'production') {
    console.error('Error fetching client organization:', clientOrgError);
  }

  if (agencyOrgError && process.env.NODE_ENV !== 'production') {
    console.error('Error fetching agency organization:', agencyOrgError);
  }

  // Fetch user IDs needed
  const userIds = new Set<string>();
  if (request.created_by_user_id) userIds.add(request.created_by_user_id);
  if (request.assignee_user_id) userIds.add(request.assignee_user_id);

  // Fetch user profiles, memberships, org type, and project in parallel
  const userIdArray = Array.from(userIds);
  const [profilesResult, membershipsResult, orgTypeResult, projectResult] = await Promise.all([
    userIdArray.length > 0
      ? supabase
          .from('profiles')
          .select('id, first_name, last_name, email, avatar_url, job_title')
          .in('id', userIdArray)
      : Promise.resolve({ data: null, error: null }),
    userIdArray.length > 0
      ? supabase
          .from('memberships')
          .select(`
            user_id,
            org_id,
            organizations!inner(
              id,
              name,
              logo_url
            )
          `)
          .in('user_id', userIdArray)
      : Promise.resolve({ data: null, error: null }),
    request.created_by_org_id
      ? supabase
          .from('organizations')
          .select('type')
          .eq('id', request.created_by_org_id)
          .single()
      : Promise.resolve({ data: null, error: null }),
    request.project_id
      ? supabase
          .from('projects')
          .select('id, name')
          .eq('id', request.project_id)
          .is('deleted_at', null)
          .single()
      : Promise.resolve({ data: null, error: null })
  ]);

  // Build profiles map
  const profilesMap: Record<string, { first_name: string; last_name: string; email: string; avatar_url?: string; job_title?: string }> = {};
  if (!profilesResult.error && profilesResult.data) {
    profilesResult.data.forEach(profile => {
      profilesMap[profile.id] = profile;
    });
  }

  // Build user org map
  const userOrgMap: Record<string, { orgId: string; orgName: string; orgLogo?: string }> = {};
  if (!membershipsResult.error && membershipsResult.data) {
    membershipsResult.data.forEach((membership: { user_id: string; organizations: { id: string; name: string; logo_url: string | null } | Array<{ id: string; name: string; logo_url: string | null }> }) => {
      const org = Array.isArray(membership.organizations) ? membership.organizations[0] : membership.organizations;
      if (org) {
        userOrgMap[membership.user_id] = {
          orgId: org.id,
          orgName: org.name,
          orgLogo: org.logo_url || undefined
        };
      }
    });
  }

  // Get org type
  const orgTypeMap: Record<string, 'agency' | 'client'> = {};
  if (!orgTypeResult.error && orgTypeResult.data) {
    const orgType = orgTypeResult.data.type;
    if (orgType === 'agency' || orgType === 'client') {
      orgTypeMap[request.created_by_org_id] = orgType as 'agency' | 'client';
    }
  }

  // Get project - use fetched project if available, otherwise fallback to project_name_cached
  let project = null;
  if (request.project_id) {
    if (!projectResult.error && projectResult.data) {
      project = { id: projectResult.data.id, name: projectResult.data.name };
    } else if (request.project_name_cached) {
      // Fallback to cached name if project lookup failed (e.g., RLS issue or project deleted)
      project = { id: request.project_id, name: request.project_name_cached };
    }
  }

  const submittedByProfile = request.created_by_user_id ? profilesMap[request.created_by_user_id] : null;
  const assigneeProfile = request.assignee_user_id ? profilesMap[request.assignee_user_id] : null;

  return {
    id: request.id,
    connectionId: request.connection_id,
    title: request.title,
    description: request.description || '',
    status: request.status as 'new' | 'in_review' | 'accepted' | 'canceled',
    project: project || null,
    submittedBy: formatters.buildSubmittedBy(
      request.created_by_user_id,
      submittedByProfile,
      userOrgMap
    ),
    assignee: formatters.buildAssignee(request.assignee_user_id, assigneeProfile),
    client: formatters.buildOrganization(
      connection.client_id,
      clientOrg?.name,
      clientOrg?.logo_url,
      'Unknown Client'
    ),
    agency: agencyOrg ? formatters.buildOrganization(
      connection.agency_id,
      agencyOrg.name,
      agencyOrg.logo_url,
      'Unknown Agency'
    ) : undefined,
    createdAt: request.created_at || '',
    createdByOrgId: request.created_by_org_id,
    createdByOrgType: formatters.getOrgType(request.created_by_org_id, orgTypeMap)
  };
}

/**
 * Get a single request by ID (works across all connections) - CACHED version
 */
export const getRequestByIdGlobal = cache(getRequestByIdGlobalUncached);

/**
 * Export uncached version for immediate post-insert fetches
 */
export { getRequestByIdGlobalUncached };

/**
 * Get agency members for the active organization
 * Only fetches when context.variant === 'agency' (clients can't assign assignees)
 */
export const getAgencyMembersForActiveOrg = cache(async (
  context: EnhancedModeContext
): Promise<Array<{
  id: string
  firstName: string
  lastName: string
  email: string
  avatarUrl?: string
  jobTitle?: string
}>> => {
  // Only fetch for agencies
  if (context.variant !== 'agency') {
    return [];
  }

  const supabase = await createClient();

  // Fetch organization name
  const { data: orgData, error: orgError } = await supabase
    .from('organizations')
    .select('id, name')
    .eq('id', context.orgId)
    .single();

  if (orgError || !orgData) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Error fetching organization:', orgError);
    }
    return [];
  }

  // Fetch agency members
  const { data: members, error: membersError } = await supabase
    .from('memberships')
    .select(`
      org_id,
      profiles!inner(
        id,
        first_name,
        last_name,
        email,
        avatar_url,
        job_title,
        deleted_at
      )
    `)
    .eq('org_id', context.orgId)
    .is('profiles.deleted_at', null)
    .order('profiles(first_name)');

  if (membersError) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Error fetching agency members:', membersError);
    }
    return [];
  }

  // Map to expected format
  return (members || []).map(member => {
    const profile = Array.isArray(member.profiles) ? member.profiles[0] : member.profiles;
    return {
      id: profile.id,
      firstName: profile.first_name || '',
      lastName: profile.last_name || '',
      email: profile.email || '',
      avatarUrl: profile.avatar_url || undefined,
      jobTitle: profile.job_title || undefined
    };
  });
});

/**
 * Get global count of requests with status 'new' for the current organization
 */
/**
 * Get global count of requests with status 'new' for the current organization
 * @param context - The enhanced mode context
 * @param connectionIds - Optional array of connection IDs to use instead of fetching connections
 *                        This avoids redundant queries when connection IDs are already available
 */
export const getGlobalNewRequestsCount = cache(async (
  context: EnhancedModeContext,
  connectionIds?: string[]
): Promise<number> => {
  // Validate context before proceeding
  if (!context || !context.orgId || !context.userId) {
    return 0;
  }

  const supabase = await createClient();
  
  // Use provided connection IDs or fetch them
  let finalConnectionIds: string[] = connectionIds || [];
  
  if (finalConnectionIds.length === 0) {
    finalConnectionIds = await getConnectionIdsForOrg(context, supabase);
  }

  if (finalConnectionIds.length === 0) {
    return 0;
  }

  // Count requests with status 'new'
  const { count, error: countError } = await supabase
    .from('requests')
    .select('id', { count: 'exact', head: true })
    .in('connection_id', finalConnectionIds)
    .eq('status', 'new')
    .is('deleted_at', null);

  if (countError) {
    console.error('Error fetching new requests count:', countError);
    return 0;
  }

  return count || 0;
});

/**
 * Get global count of requests with status 'in_review' for the current organization
 * @param context - The enhanced mode context
 * @param connectionIds - Optional array of connection IDs to use instead of fetching connections
 *                        This avoids redundant queries when connection IDs are already available
 */
export const getGlobalInReviewRequestsCount = cache(async (
  context: EnhancedModeContext,
  connectionIds?: string[]
): Promise<number> => {
  // Validate context before proceeding
  if (!context || !context.orgId || !context.userId) {
    return 0;
  }

  const supabase = await createClient();
  
  // Use provided connection IDs or fetch them
  let finalConnectionIds: string[] = connectionIds || [];
  
  if (finalConnectionIds.length === 0) {
    finalConnectionIds = await getConnectionIdsForOrg(context, supabase);
  }

  if (finalConnectionIds.length === 0) {
    return 0;
  }

  // Count requests with status 'in_review'
  const { count, error: countError } = await supabase
    .from('requests')
    .select('id', { count: 'exact', head: true })
    .in('connection_id', finalConnectionIds)
    .eq('status', 'in_review')
    .is('deleted_at', null);

  if (countError) {
    console.error('Error fetching in-review requests count:', countError);
    return 0;
  }

  return count || 0;
});

/**
 * Get all connections for the current organization (for global request creation)
 * Returns connections with partner organization data
 */
export const getConnectionsForGlobalView = cache(async (
  context: EnhancedModeContext
): Promise<Array<{
  id: string
  name: string
  logoUrl?: string
}>> => {
  const supabase = await createClient();
  
  if (context.variant === 'agency') {
    // Agency viewing clients - get all client connections
    // Exclude disconnected connections (frozen/read-only)
    const { data: connections, error } = await supabase
      .from('connections')
      .select(`
        id,
        organizations!connections_client_id_fkey (
          id,
          name,
          logo_url
        )
      `)
      .eq('agency_id', context.orgId)
      .neq('connection_status', 'disconnected')
      .order('created_at', { ascending: false });
    
    if (error || !connections) {
      console.error('Error fetching client connections:', error);
      return [];
    }
    
    return connections
      .filter((conn): conn is typeof conn & { organizations: { name: string; logo_url: string | null } } => !!conn.organizations)
      .map(conn => ({
        id: conn.id,
        name: conn.organizations.name,
        logoUrl: conn.organizations.logo_url || undefined
      }));
  } else {
    // Client viewing agencies - get all agency connections
    // Exclude disconnected connections (frozen/read-only)
    const { data: connections, error } = await supabase
      .from('connections')
      .select(`
        id,
        organizations!connections_agency_id_fkey (
          id,
          name,
          logo_url
        )
      `)
      .eq('client_id', context.orgId)
      .neq('connection_status', 'disconnected')
      .order('created_at', { ascending: false });
    
    if (error || !connections) {
      console.error('Error fetching agency connections:', error);
      return [];
    }
    
    return connections
      .filter((conn): conn is typeof conn & { organizations: { name: string; logo_url: string | null } } => !!conn.organizations)
      .map(conn => ({
        id: conn.id,
        name: conn.organizations.name,
        logoUrl: conn.organizations.logo_url || undefined
      }));
  }
});

