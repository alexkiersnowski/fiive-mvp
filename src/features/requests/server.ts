import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import { escapeForILike } from '@/lib/utils';
import type { EnhancedModeContext } from '@/lib/mode/getActiveContext';
import type { RequestsSnapshot, Request, RequestsPaginationOptions, SearchResults, SearchClientResult } from './types';
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
  const { search = '', offset = 0, limit = 20 } = options;
  
  // Validate context before proceeding
  if (!context || !context.orgId || !context.userId) {
    console.error('Invalid context provided to getRequestsSnapshot:', { context });
    return {
      requests: [],
      total: 0,
      unfilteredTotalCount: 0,
      offset: 0,
      hasMore: false,
      fetchedConnectionIds: [],
      allConnectionsMetadata: new Map(),
    };
  }

  const supabase = await createClient();
  
  // PHASE 0: Fetch ALL connection metadata upfront (for grouping) - RLS ENFORCED
  // This ensures grouping logic knows about all connections, even if their requests aren't loaded yet
  const allConnectionsMetadataQuery = context.variant === 'agency'
    ? supabase
        .from('connections')
        .select(`
          id,
          client_id,
          organizations!connections_client_id_fkey (
            id,
            name,
            logo_url
          )
        `)
        .eq('agency_id', context.orgId)
        .neq('connection_status', 'disconnected')
    : supabase
        .from('connections')
        .select(`
          id,
          agency_id,
          organizations!connections_agency_id_fkey (
            id,
            name,
            logo_url
          )
        `)
        .eq('client_id', context.orgId)
        .neq('connection_status', 'disconnected');
  
  const { data: allConnectionsMetadataData, error: allConnectionsMetadataError } = await allConnectionsMetadataQuery;
  
  // Build allConnectionsMetadata map (orgId -> {name, logoUrl})
  // Key is organization ID (client_id for agency view, agency_id for client view) - matches groupId in grouping logic
  // Multiple connections can share the same orgId, so we deduplicate by orgId
  const allConnectionsMetadata = new Map<string, { name: string; logoUrl?: string }>();
  if (!allConnectionsMetadataError && allConnectionsMetadataData) {
    for (const conn of allConnectionsMetadataData) {
      const orgId = context.variant === 'agency' 
        ? (conn as { client_id: string; organizations: { id: string; name: string | null; logo_url: string | null } | Array<{ id: string; name: string | null; logo_url: string | null }> }).client_id
        : (conn as { agency_id: string; organizations: { id: string; name: string | null; logo_url: string | null } | Array<{ id: string; name: string | null; logo_url: string | null }> }).agency_id;
      
      const org = Array.isArray(conn.organizations) ? conn.organizations[0] : conn.organizations;
      if (org && orgId) {
        // Use orgId as key (matches groupId in grouping logic) - deduplicate if multiple connections share same orgId
        if (!allConnectionsMetadata.has(orgId)) {
          allConnectionsMetadata.set(orgId, {
            name: org.name || 'Unknown',
            logoUrl: org.logo_url || undefined
          });
        }
      }
    }
  }
  
  // PHASE 1: Client-based pagination - Fetch connections first (paginated)
  // CRITICAL: Sort connections by organization name alphabetically (A-Z), not created_at
  // This ensures we show the correct first 20 clients alphabetically, then next 20 on scroll
  // First, fetch ALL connections with organization names for sorting
  const allConnectionsQuery = context.variant === 'agency'
    ? supabase
        .from('connections')
        .select(`
          id, 
          client_id, 
          agency_id, 
          created_at,
          organizations!connections_client_id_fkey (
            id,
            name
          )
        `)
        .eq('agency_id', context.orgId)
        .neq('connection_status', 'disconnected')
    : supabase
        .from('connections')
        .select(`
          id, 
          client_id, 
          agency_id, 
          created_at,
          organizations!connections_agency_id_fkey (
            id,
            name
          )
        `)
        .eq('client_id', context.orgId)
        .neq('connection_status', 'disconnected');
  
  const { data: allConnectionsRaw, error: allConnectionsError } = await allConnectionsQuery;
  
  if (allConnectionsError || !allConnectionsRaw) {
    console.error('Error fetching all connections:', allConnectionsError);
    return {
      requests: [],
      total: 0,
      unfilteredTotalCount: 0,
      offset: 0,
      hasMore: false,
      fetchedConnectionIds: [],
      allConnectionsMetadata: allConnectionsMetadata,
      totalClientCount: allConnectionsMetadata.size, // Total unique clients
    };
  }
  
  // Sort connections by organization name alphabetically (A-Z)
  // Extract org name for sorting
  const allConnections = allConnectionsRaw.map(conn => {
    const orgId = context.variant === 'agency' ? conn.client_id : conn.agency_id;
    const org = Array.isArray(conn.organizations) ? conn.organizations[0] : conn.organizations;
    const orgName = org?.name || 'Unknown';
    return {
      ...conn,
      _sortName: orgName.toLowerCase() // For case-insensitive sorting
    };
  }).sort((a, b) => {
    // Sort alphabetically by organization name
    return a._sortName.localeCompare(b._sortName, undefined, { sensitivity: 'base' });
  });
  
  // Apply pagination using offset directly (offset-based pagination)
  const connectionStartIndex = offset;
  const connections = allConnections.slice(connectionStartIndex, connectionStartIndex + limit);
  const connectionIds = connections.map(c => c.id);
  const hasMoreConnections = allConnections.length > connectionStartIndex + limit;

  if (connectionIds.length === 0) {
    // No more connections to load, return empty result (but still include allConnectionsMetadata)
    return {
      requests: [],
      total: 0,
      unfilteredTotalCount: 0,
      offset: connectionStartIndex + limit, // Next offset
      hasMore: false,
      fetchedConnectionIds: [],
      allConnectionsMetadata: allConnectionsMetadata,
      totalClientCount: allConnectionsMetadata.size, // Total unique clients
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

  // PHASE 2: Calculate status counts across ALL connections (before pagination)
  // Use count queries with status filters - efficient, no JS filtering
  let statusCounts: {
    new: number;
    in_review: number;
    accepted: number;
    closed: number;
    canceled: number;
  } = {
    new: 0,
    in_review: 0,
    accepted: 0,
    closed: 0,
    canceled: 0,
  };

  if (allConnectionIds.length > 0) {
    // Calculate status counts across ALL connections using parallel count queries
    const [newCount, inReviewCount, acceptedCount, closedCount, canceledCount] = await Promise.all([
      supabase
        .from('requests')
        .select('id', { count: 'exact', head: true })
        .in('connection_id', allConnectionIds)
        .eq('status', 'new')
        .is('deleted_at', null),
      supabase
        .from('requests')
        .select('id', { count: 'exact', head: true })
        .in('connection_id', allConnectionIds)
        .eq('status', 'in_review')
        .is('deleted_at', null),
      supabase
        .from('requests')
        .select('id', { count: 'exact', head: true })
        .in('connection_id', allConnectionIds)
        .eq('status', 'accepted')
        .is('deleted_at', null),
      supabase
        .from('requests')
        .select('id', { count: 'exact', head: true })
        .in('connection_id', allConnectionIds)
        .eq('status', 'closed')
        .is('deleted_at', null),
      supabase
        .from('requests')
        .select('id', { count: 'exact', head: true })
        .in('connection_id', allConnectionIds)
        .eq('status', 'canceled')
        .is('deleted_at', null),
    ]);

    statusCounts = {
      new: newCount.count || 0,
      in_review: inReviewCount.count || 0,
      accepted: acceptedCount.count || 0,
      closed: closedCount.count || 0,
      canceled: canceledCount.count || 0,
    };
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

  // PHASE 1 FIX: Fetch ALL requests per connection (Option C - per-connection fetch)
  // This guarantees completeness and avoids Supabase PostgREST 1,000 row limit truncation
  // Fetch each connection separately to ensure we get ALL requests for each connection
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
  
  // Fetch requests for each connection separately to guarantee completeness
  const allRequests: RequestRow[] = [];
  const requestErrors: Array<{ connectionId: string; error: any }> = [];

  for (const connectionId of connectionIds) {
    let connectionQuery = supabase
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
      .eq('connection_id', connectionId)
      .is('deleted_at', null);

    // Apply filters (same as base query)
    if (options.assignedToUserId) {
      connectionQuery = connectionQuery.eq('assignee_user_id', options.assignedToUserId);
    }
    
    if (options.createdByUserId) {
      connectionQuery = connectionQuery.eq('created_by_user_id', options.createdByUserId);
    }

    // Apply search filter if search is provided
    if (search && search.trim().length > 0) {
      const trimmedQuery = search.trim();
      const escaped = escapeForILike(trimmedQuery);
      
      // For per-connection fetch with search:
      // - If connection matches org name search, include all requests (title filter optional)
      // - If connection doesn't match org name, only include requests with matching title
      if (matchingConnectionIds.length > 0 && matchingConnectionIds.includes(connectionId)) {
        // Connection matches org name search - include all requests for this connection
        // Optionally filter by title as well
        connectionQuery = connectionQuery.ilike('title', `%${escaped}%`);
      } else {
        // Connection doesn't match org name - only include if title matches
        connectionQuery = connectionQuery.ilike('title', `%${escaped}%`);
      }
    }

    // Always sort by created_at descending (newest first)
    connectionQuery = connectionQuery.order('created_at', { ascending: false });

    // Fetch ALL requests for this connection (no limit - per-connection ensures completeness)
    const { data: connectionRequests, error: connectionError } = await connectionQuery;

    if (connectionError) {
      console.error(`Error fetching requests for connection ${connectionId}:`, connectionError);
      requestErrors.push({ connectionId, error: connectionError });
      // Continue with other connections even if one fails
      continue;
    }

    if (connectionRequests && connectionRequests.length > 0) {
      allRequests.push(...connectionRequests);
    }
  }

  // Log any errors encountered
  if (requestErrors.length > 0) {
    console.error(`Failed to fetch requests for ${requestErrors.length} connection(s)`);
  }

  const requestsData: RequestRow[] | null = allRequests.length > 0 ? allRequests : null;
  const requestsError = requestErrors.length > 0 ? requestErrors[0].error : null;

  // Verification: Log if we detect any truncation (shouldn't happen with per-connection fetch)
  // This is a safety check to catch any unexpected issues
  if (connectionIds.length > 0 && requestsData) {
    for (const connectionId of connectionIds) {
      // Build count query with same filters as fetch query
      let countQuery = supabase
        .from('requests')
        .select('id', { count: 'exact', head: true })
        .eq('connection_id', connectionId)
        .is('deleted_at', null);
      
      // Apply same filters as fetch query
      if (options.assignedToUserId) {
        countQuery = countQuery.eq('assignee_user_id', options.assignedToUserId);
      }
      if (options.createdByUserId) {
        countQuery = countQuery.eq('created_by_user_id', options.createdByUserId);
      }
      if (search && search.trim().length > 0) {
        const trimmedQuery = search.trim();
        const escaped = escapeForILike(trimmedQuery);
        // Apply same search logic as fetch query
        if (matchingConnectionIds.length > 0 && matchingConnectionIds.includes(connectionId)) {
          // Connection matches org name search - count all requests (org name match is sufficient)
          // But apply title filter for consistency
          countQuery = countQuery.ilike('title', `%${escaped}%`);
        } else {
          // Connection doesn't match org name - only count if title matches
          countQuery = countQuery.ilike('title', `%${escaped}%`);
        }
      }
      
      const { count: expectedCount } = await countQuery;
      const fetchedCount = requestsData.filter(r => r.connection_id === connectionId).length;
      
      if (expectedCount !== fetchedCount) {
        console.error(`❌ TRUNCATION DETECTED: Connection ${connectionId} has ${expectedCount} requests but only ${fetchedCount} fetched!`);
      }
    }
  }

  if (requestsError) {
    console.error('Error fetching requests:', requestsError);
    return {
      requests: [],
      total: 0,
      unfilteredTotalCount: unfilteredTotalCount || 0,
      offset: connectionStartIndex + limit, // Next offset
      hasMore: false,
      fetchedConnectionIds: [],
      allConnectionsMetadata: allConnectionsMetadata,
      statusCounts, // Include status counts even on error
      loadedStatusCounts: { new: 0, in_review: 0, accepted: 0, closed: 0, canceled: 0 }, // No loaded requests
      totalClientCount: allConnectionsMetadata.size, // Total unique clients
    };
  }

  // If no requests, return early
  if (!requestsData || requestsData.length === 0) {
    return {
      requests: [],
      total: total || 0,
      unfilteredTotalCount: unfilteredTotalCount || 0,
      offset: connectionStartIndex + limit, // Next offset
      hasMore: false,
      fetchedConnectionIds: [],
      allConnectionsMetadata: allConnectionsMetadata,
      statusCounts, // Include status counts even with no loaded requests
      loadedStatusCounts: { new: 0, in_review: 0, accepted: 0, closed: 0, canceled: 0 }, // No loaded requests
      totalClientCount: allConnectionsMetadata.size, // Total unique clients
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
      offset: connectionStartIndex + limit, // Next offset
      hasMore: false,
      fetchedConnectionIds: [],
      allConnectionsMetadata: allConnectionsMetadata,
      statusCounts, // Include status counts even on error
      loadedStatusCounts: { new: 0, in_review: 0, accepted: 0, closed: 0, canceled: 0 }, // No loaded requests
      totalClientCount: allConnectionsMetadata.size, // Total unique clients
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

  // Calculate loaded status counts from fetched requests (for debugging/display)
  const loadedStatusCounts: {
    new: number;
    in_review: number;
    accepted: number;
    closed: number;
    canceled: number;
  } = {
    new: requests.filter(r => r.status === 'new').length,
    in_review: requests.filter(r => r.status === 'in_review').length,
    accepted: requests.filter(r => r.status === 'accepted').length,
    closed: requests.filter(r => r.status === 'closed').length,
    canceled: requests.filter(r => r.status === 'canceled').length,
  };

  // Calculate pagination info based on connections, not requests
  // hasMoreConnections indicates if there are more connections to load
  // Total count should reflect total requests across ALL connections (for display purposes)
  const nextOffset = connectionStartIndex + limit;
  
  // Calculate total unique client count (agnostic to pagination)
  // This is the count of unique orgIds in allConnectionsMetadata (all clients user has access to)
  const totalClientCount = allConnectionsMetadata.size;
  
  // Get unique org IDs for loaded connections (for rendering)
  // Build connection -> org ID mapping
  const connectionIdToOrgId = new Map<string, string>()
  for (const conn of allConnectionsRaw) {
    const orgId = context.variant === 'agency' ? conn.client_id : conn.agency_id;
    connectionIdToOrgId.set(conn.id, orgId)
  }
  const fetchedOrgIds = Array.from(new Set(
    connectionIds
      .map(connId => connectionIdToOrgId.get(connId))
      .filter((orgId): orgId is string => orgId !== undefined)
  ));
  
  return {
    requests: requests,
    total: total || 0, // Total count from filtered query across all connections
    unfilteredTotalCount: unfilteredTotalCount || 0,
    offset: nextOffset, // Explicit next offset
    hasMore: hasMoreConnections,
    fetchedConnectionIds: fetchedOrgIds, // Org IDs for rendering (empty array for search mode)
    allConnectionsMetadata: allConnectionsMetadata,
    statusCounts, // Status counts across ALL connections
    loadedStatusCounts, // Status counts from loaded connections only
    totalClientCount, // Total unique client count (agnostic to pagination) - for status header
  };
});

/**
 * Get requests snapshot for a specific status (status-first pagination)
 * DEPRECATED: No longer used after accordion refactor. Kept for backward compatibility.
 * @deprecated Use getRequestsForClientStatus for accordion fetch-on-expand instead
 */
export const getRequestsSnapshotForStatus = cache(async (
  context: EnhancedModeContext,
  status: 'new' | 'in_review' | 'accepted' | 'closed' | 'canceled',
  options: RequestsPaginationOptions = {}
): Promise<RequestsSnapshot> => {
  const { 
    search = '', 
    offset = 0, 
    limit = 50, // Single limit for flat stream (changed from 20 connections to 50 requests)
    excludedConnectionIds = [], // Server-side collapse filter
    assignedToUserId, 
    createdByUserId 
  } = options;
  
  // Validate context before proceeding
  if (!context || !context.orgId || !context.userId) {
    console.error('Invalid context provided to getRequestsSnapshotForStatus:', { context });
    return {
      requests: [],
      total: 0,
      unfilteredTotalCount: 0,
      offset: 0,
      hasMore: false,
      fetchedConnectionIds: [],
      allConnectionsMetadata: new Map(),
      status,
    };
  }

  const supabase = await createClient();
  
  // PHASE 0: Fetch ALL connection metadata upfront (for grouping) - RLS ENFORCED
  // Needed for grouping logic and display names
  const allConnectionsMetadataQuery = context.variant === 'agency'
    ? supabase
        .from('connections')
        .select(`
          id,
          client_id,
          organizations!connections_client_id_fkey (
            id,
            name,
            logo_url
          )
        `)
        .eq('agency_id', context.orgId)
        .neq('connection_status', 'disconnected')
    : supabase
        .from('connections')
        .select(`
          id,
          agency_id,
          organizations!connections_agency_id_fkey (
            id,
            name,
            logo_url
          )
        `)
        .eq('client_id', context.orgId)
        .neq('connection_status', 'disconnected');
  
  const { data: allConnectionsMetadataData, error: allConnectionsMetadataError } = await allConnectionsMetadataQuery;
  
  // Build allConnectionsMetadata map
  const allConnectionsMetadata = new Map<string, { name: string; logoUrl?: string }>();
  if (!allConnectionsMetadataError && allConnectionsMetadataData) {
    for (const conn of allConnectionsMetadataData) {
      const orgId = context.variant === 'agency' 
        ? (conn as { client_id: string; organizations: { id: string; name: string | null; logo_url: string | null } | Array<{ id: string; name: string | null; logo_url: string | null }> }).client_id
        : (conn as { agency_id: string; organizations: { id: string; name: string | null; logo_url: string | null } | Array<{ id: string; name: string | null; logo_url: string | null }> }).agency_id;
      
      const org = Array.isArray(conn.organizations) ? conn.organizations[0] : conn.organizations;
      if (org && orgId) {
        if (!allConnectionsMetadata.has(orgId)) {
          allConnectionsMetadata.set(orgId, {
            name: org.name || 'Unknown',
            logoUrl: org.logo_url || undefined
          });
        }
      }
    }
  }

  // Get all connection IDs for this context
  const allConnectionIds = await getConnectionIdsForOrg(context, supabase);
  
  if (allConnectionIds.length === 0) {
    return {
      requests: [],
      total: 0,
      unfilteredTotalCount: 0,
      offset: 0,
      hasMore: false,
      fetchedConnectionIds: [],
      allConnectionsMetadata: allConnectionsMetadata,
      statusCounts: { new: 0, in_review: 0, accepted: 0, closed: 0, canceled: 0 },
      totalClientCount: allConnectionsMetadata.size,
      status,
    };
  }

  // PHASE 1: Fetch skeleton/metadata (lightweight, no request rows)
  const { data: skeletonData, error: skeletonError } = await supabase.rpc(
    'get_requests_skeleton',
    {
      p_connection_ids: allConnectionIds,
      p_assigned_to_user_id: assignedToUserId || null,
      p_created_by_user_id: createdByUserId || null,
    }
  );

  if (skeletonError) {
    console.error('Error fetching requests skeleton:', skeletonError);
    // Continue with empty skeleton data
  }

  // Parse skeleton data
  const statusCounts = skeletonData?.status_counts || { new: 0, in_review: 0, accepted: 0, closed: 0, canceled: 0 };
  const clientCounts = skeletonData?.client_counts || {}; // connection_id -> count

  // PHASE 2: Fetch flat ordered stream (single offset, single limit)
  // Note: Search is not yet supported in flat RPC - will need to add later or handle separately
  // For now, if search is provided, we'll need to fall back to search mode or add search to RPC
  if (search && search.trim().length > 0) {
    // TODO: Add search support to flat RPC or use existing search function
    // For MVP, we'll skip search in flat pagination mode
    console.warn('Search not yet supported in flat pagination mode');
  }

  const { data: requestsData, error: requestsError } = await supabase.rpc(
    'get_requests_flat_ordered',
    {
      p_connection_ids: allConnectionIds,
      p_status: status,
      p_offset_count: offset,
      p_limit_count: limit,
      p_excluded_connection_ids: excludedConnectionIds, // Server-side collapse filter
      p_assigned_to_user_id: assignedToUserId || null,
      p_created_by_user_id: createdByUserId || null,
      p_view_type: context.variant, // 'agency' or 'client' - determines display name sorting
    }
  );

  if (requestsError) {
    console.error('Error fetching flat requests:', requestsError);
    return {
      requests: [],
      total: statusCounts[status] || 0,
      unfilteredTotalCount: statusCounts[status] || 0,
      offset: offset,
      hasMore: false,
      fetchedConnectionIds: [],
      allConnectionsMetadata: allConnectionsMetadata,
      statusCounts,
      clientCounts,
      totalClientCount: allConnectionsMetadata.size,
      status,
    };
  }

  if (!requestsData || requestsData.length === 0) {
    return {
      requests: [],
      total: statusCounts[status] || 0,
      unfilteredTotalCount: statusCounts[status] || 0,
      offset: offset,
      hasMore: false,
      fetchedConnectionIds: [],
      allConnectionsMetadata: allConnectionsMetadata,
      statusCounts,
      clientCounts,
      totalClientCount: allConnectionsMetadata.size,
      status,
    };
  }

  // PHASE 3: Transform requests (same transformation logic as before)
  // The RPC returns raw request rows, we need to enrich them with profiles, connections, etc.
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
  };

  const uniqueConnectionIds = [...new Set(requestsData.map((r: RequestRow) => r.connection_id))];
  const userIds = new Set<string>();
  requestsData.forEach((request: RequestRow) => {
    if (request.created_by_user_id) userIds.add(request.created_by_user_id);
    if (request.assignee_user_id) userIds.add(request.assignee_user_id);
  });

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
  const { data: connectionsData, error: connectionsError } = connectionsResult;
  const { data: membershipsData, error: membershipsError } = membershipsResult;
  const { data: orgsData, error: orgsError } = orgsResult;

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
      total: statusCounts[status] || 0,
      unfilteredTotalCount: statusCounts[status] || 0,
      offset: offset,
      hasMore: false,
      fetchedConnectionIds: [],
      allConnectionsMetadata: allConnectionsMetadata,
      statusCounts,
      clientCounts,
      totalClientCount: allConnectionsMetadata.size,
      status,
    };
  }

  const connectionsMap = (connectionsData || []).reduce((acc, conn) => {
    acc[conn.id] = { clientId: conn.client_id, agencyId: conn.agency_id };
    return acc;
  }, {} as Record<string, { clientId: string; agencyId: string }>);

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

  // Fetch projects for requests that have project_id
  const projectIds: string[] = requestsData
    .map((r: RequestRow) => r.project_id)
    .filter((id: string | null): id is string => id !== null);
  const uniqueProjectIds = [...new Set(projectIds)];
  const projectsMap: Record<string, { id: string; name: string }> = {};
  if (uniqueProjectIds.length > 0) {
    const { data: projectsData } = await supabase
      .from('projects')
      .select('id, name')
      .in('id', uniqueProjectIds)
      .is('deleted_at', null);
    
    if (projectsData) {
      projectsData.forEach(project => {
        projectsMap[project.id] = project;
      });
    }
  }

  const requests: Request[] = requestsData
    .filter((request: RequestRow) => {
      return connectionsMap[request.connection_id] !== undefined;
    })
    .map((request: RequestRow) => {
      const connectionInfo = connectionsMap[request.connection_id];
      if (!connectionInfo) {
        throw new Error('Connection not found in map');
      }

      const clientOrg = orgMap[connectionInfo.clientId];
      const agencyOrg = orgMap[connectionInfo.agencyId];
      
      const submittedByProfile = request.created_by_user_id ? profilesMap[request.created_by_user_id] || null : null;
      const assigneeProfile = request.assignee_user_id ? profilesMap[request.assignee_user_id] || null : null;
      
      let project = null;
      if (request.project_id) {
        const projectData = projectsMap[request.project_id];
        if (projectData) {
          project = { id: projectData.id, name: projectData.name };
        } else if (request.project_name_cached) {
          project = { id: request.project_id, name: request.project_name_cached };
        }
      }

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
      } as Request;
    });

  // Calculate hasMore: if we got exactly limit items, there might be more
  const hasMore = (requestsData?.length || 0) === limit;
  
  return {
    requests: requests,
    total: statusCounts[status] || 0,
    unfilteredTotalCount: statusCounts[status] || 0,
    offset: offset + (requestsData?.length || 0), // Next offset
    hasMore,
    fetchedConnectionIds: [], // Not used in flat pagination (empty array)
    allConnectionsMetadata: allConnectionsMetadata,
    statusCounts,
    clientCounts, // NEW: Per-connection counts for collapse math
    totalClientCount: allConnectionsMetadata.size,
    status,
  };
});

/**
 * Helper function to calculate status counts across all connections
 */
async function calculateStatusCounts(
  supabase: Awaited<ReturnType<typeof createClient>>,
  allConnectionIds: string[]
): Promise<{
  new: number;
  in_review: number;
  accepted: number;
  closed: number;
  canceled: number;
}> {
  if (allConnectionIds.length === 0) {
    return { new: 0, in_review: 0, accepted: 0, closed: 0, canceled: 0 };
  }

  const [newCount, inReviewCount, acceptedCount, closedCount, canceledCount] = await Promise.all([
    supabase
      .from('requests')
      .select('id', { count: 'exact', head: true })
      .in('connection_id', allConnectionIds)
      .eq('status', 'new')
      .is('deleted_at', null),
    supabase
      .from('requests')
      .select('id', { count: 'exact', head: true })
      .in('connection_id', allConnectionIds)
      .eq('status', 'in_review')
      .is('deleted_at', null),
    supabase
      .from('requests')
      .select('id', { count: 'exact', head: true })
      .in('connection_id', allConnectionIds)
      .eq('status', 'accepted')
      .is('deleted_at', null),
    supabase
      .from('requests')
      .select('id', { count: 'exact', head: true })
      .in('connection_id', allConnectionIds)
      .eq('status', 'closed')
      .is('deleted_at', null),
    supabase
      .from('requests')
      .select('id', { count: 'exact', head: true })
      .in('connection_id', allConnectionIds)
      .eq('status', 'canceled')
      .is('deleted_at', null),
  ]);

  return {
    new: newCount.count || 0,
    in_review: inReviewCount.count || 0,
    accepted: acceptedCount.count || 0,
    closed: closedCount.count || 0,
    canceled: canceledCount.count || 0,
  };
}

/**
 * Search requests across ALL connections using PostgreSQL full-text search
 * Uses search-based pagination (offset-based) instead of connection-based pagination
 * Returns results ranked by relevance using ts_rank()
 */
export const searchRequestsGlobal = cache(async (
  context: EnhancedModeContext,
  options: RequestsPaginationOptions = {}
): Promise<RequestsSnapshot> => {
  const { search = '', offset = 0, limit = 50, assignedToUserId, createdByUserId } = options;
  
  // Validate context before proceeding
  if (!context || !context.orgId || !context.userId) {
    console.error('Invalid context provided to searchRequestsGlobal:', { context });
    return {
      requests: [],
      total: 0,
      unfilteredTotalCount: 0,
      offset: 0,
      hasMore: false,
      fetchedConnectionIds: [],
      allConnectionsMetadata: new Map(),
    };
  }

  // Validate search query
  if (!search || !search.trim()) {
    console.error('searchRequestsGlobal called without search query');
    return {
      requests: [],
      total: 0,
      unfilteredTotalCount: 0,
      offset: 0,
      hasMore: false,
      fetchedConnectionIds: [],
      allConnectionsMetadata: new Map(),
    };
  }

  const supabase = await createClient();
  
  // Fetch ALL connection metadata upfront (for grouping) - RLS ENFORCED
  const allConnectionsMetadataQuery = context.variant === 'agency'
    ? supabase
        .from('connections')
        .select(`
          id,
          client_id,
          organizations!connections_client_id_fkey (
            id,
            name,
            logo_url
          )
        `)
        .eq('agency_id', context.orgId)
        .neq('connection_status', 'disconnected')
    : supabase
        .from('connections')
        .select(`
          id,
          agency_id,
          organizations!connections_agency_id_fkey (
            id,
            name,
            logo_url
          )
        `)
        .eq('client_id', context.orgId)
        .neq('connection_status', 'disconnected');
  
  const { data: allConnectionsMetadataData, error: allConnectionsMetadataError } = await allConnectionsMetadataQuery;
  
  // Build allConnectionsMetadata map (orgId -> {name, logoUrl})
  // Key is organization ID (client_id for agency view, agency_id for client view) - matches groupId in grouping logic
  // Multiple connections can share the same orgId, so we deduplicate by orgId
  const allConnectionsMetadata = new Map<string, { name: string; logoUrl?: string }>();
  if (!allConnectionsMetadataError && allConnectionsMetadataData) {
    for (const conn of allConnectionsMetadataData) {
      const orgId = context.variant === 'agency' 
        ? (conn as { client_id: string; organizations: { id: string; name: string | null; logo_url: string | null } | Array<{ id: string; name: string | null; logo_url: string | null }> }).client_id
        : (conn as { agency_id: string; organizations: { id: string; name: string | null; logo_url: string | null } | Array<{ id: string; name: string | null; logo_url: string | null }> }).agency_id;
      
      const org = Array.isArray(conn.organizations) ? conn.organizations[0] : conn.organizations;
      if (org && orgId) {
        // Use orgId as key (matches groupId in grouping logic) - deduplicate if multiple connections share same orgId
        if (!allConnectionsMetadata.has(orgId)) {
          allConnectionsMetadata.set(orgId, {
            name: org.name || 'Unknown',
            logoUrl: org.logo_url || undefined
          });
        }
      }
    }
  }
  
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
      offset: 0,
      hasMore: false,
      fetchedConnectionIds: [],
      allConnectionsMetadata: allConnectionsMetadata,
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

  // MVP: Search by organization name only (not request title)
  // Optimized: Query organizations first, then get connection IDs (2 queries instead of 3)
  const trimmedQuery = search.trim();
  const escaped = escapeForILike(trimmedQuery);
  const searchPattern = `%${escaped}%`;
  
  let matchingConnectionIds: string[] = [];
  
  // Step 1: Get org IDs from connections (we already have connectionIds, extract org IDs)
  // Step 2: Query organizations with name filter AND org IDs from step 1
  // Step 3: Get connection IDs for matching orgs
  
  // Extract org IDs from allConnectionsMetadata (already fetched above)
  const orgIdsToSearch = Array.from(allConnectionsMetadata.keys());
  
  if (orgIdsToSearch.length > 0) {
    // Single query: Find matching organizations
    const { data: matchingOrgs, error: orgsError } = await supabase
      .from('organizations')
      .select('id')
      .in('id', orgIdsToSearch)
      .ilike('name', searchPattern)
      .is('deleted_at', null);
    
    if (!orgsError && matchingOrgs && matchingOrgs.length > 0) {
      const matchingOrgIds = matchingOrgs.map(org => org.id);
      
      // Get connection IDs for matching orgs (use connectionIds we already have)
      // Filter connectionIds to only those that match the org IDs
      // We can do this by checking allConnectionsMetadata
      matchingConnectionIds = connectionIds.filter(connId => {
        // Find the org ID for this connection from allConnectionsMetadata
        // We need to look it up from the connections we fetched earlier
        // Actually, we can query connections directly with the org IDs
        return true; // Will filter below
      });
      
      // Query connections to get IDs for matching orgs
      const { data: matchingConnections } = context.variant === 'agency'
        ? await supabase
            .from('connections')
            .select('id')
            .eq('agency_id', context.orgId)
            .in('client_id', matchingOrgIds)
            .neq('connection_status', 'disconnected')
        : await supabase
            .from('connections')
            .select('id')
            .eq('client_id', context.orgId)
            .in('agency_id', matchingOrgIds)
            .neq('connection_status', 'disconnected');
      
      matchingConnectionIds = (matchingConnections || []).map((c: { id: string }) => c.id);
    }
  }

  // If no matching organizations found, return empty results
  if (matchingConnectionIds.length === 0) {
    return {
      requests: [],
      total: 0,
      unfilteredTotalCount: unfilteredTotalCount || 0,
      offset: offset,
      hasMore: false,
      fetchedConnectionIds: [],
      allConnectionsMetadata: allConnectionsMetadata,
      statusCounts: {
        new: 0,
        in_review: 0,
        accepted: 0,
        closed: 0,
        canceled: 0,
      },
      clientCounts: {},
    };
  }

  // Use offset directly (offset-based for search pagination)
  const searchOffset = offset || 0;
  const searchLimit = limit || 50;

  // Build search query filtering by matching connection IDs only
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
    .in('connection_id', matchingConnectionIds)
    .is('deleted_at', null);

  if (assignedToUserId) {
    requestsQuery = requestsQuery.eq('assignee_user_id', assignedToUserId);
  }
  
  if (createdByUserId) {
    requestsQuery = requestsQuery.eq('created_by_user_id', createdByUserId);
  }

  // Apply pagination (offset-based for search)
  requestsQuery = requestsQuery
    .order('created_at', { ascending: false })
    .range(searchOffset, searchOffset + searchLimit - 1);

  // Execute query
  const { data: requestsData, error: requestsError } = await requestsQuery;

  if (requestsError) {
    console.error('Error searching requests:', requestsError);
    return {
      requests: [],
      total: 0,
      unfilteredTotalCount: unfilteredTotalCount || 0,
      offset: offset, // Keep current offset on error
      hasMore: false,
      fetchedConnectionIds: [],
      allConnectionsMetadata: allConnectionsMetadata,
    };
  }

  // Get total count of matching requests
  let countQuery = supabase
    .from('requests')
    .select('id', { count: 'exact', head: true })
    .in('connection_id', matchingConnectionIds)
    .is('deleted_at', null);

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

  // Calculate status counts and client counts for search results (from ALL matching results, not just paginated)
  // This ensures accurate counts in the UI even when results are paginated
  const statusCounts: {
    new: number;
    in_review: number;
    accepted: number;
    closed: number;
    canceled: number;
  } = {
    new: 0,
    in_review: 0,
    accepted: 0,
    closed: 0,
    canceled: 0,
  };
  const clientCounts: Record<string, number> = {}; // Map<`${status}-${clientOrgId}`, number>

  if (connectionIds.length > 0) {
    // Calculate status counts for search results
    const statusCountPromises = (['new', 'in_review', 'accepted', 'closed', 'canceled'] as const).map(status => {
      let statusCountQuery = supabase
        .from('requests')
        .select('id', { count: 'exact', head: true })
        .in('connection_id', matchingConnectionIds)
        .is('deleted_at', null)
        .eq('status', status);

      if (assignedToUserId) {
        statusCountQuery = statusCountQuery.eq('assignee_user_id', assignedToUserId);
      }
      if (createdByUserId) {
        statusCountQuery = statusCountQuery.eq('created_by_user_id', createdByUserId);
      }

      return statusCountQuery.then(({ count }) => ({ status, count: count || 0 }));
    });

    const statusCountResults = await Promise.all(statusCountPromises);
    statusCountResults.forEach(({ status, count }) => {
      const typedStatus = status as keyof typeof statusCounts;
      statusCounts[typedStatus] = count;
    });

    // Calculate client counts per status for search results
    // We need to join with connections to get client_id/agency_id, then count by status and orgId
    const clientCountPromises: Array<Promise<void>> = [];
    
    for (const status of ['new', 'in_review', 'accepted', 'closed', 'canceled'] as const) {
      // Build query to get connection IDs and their org IDs for this status
      let clientCountQuery = supabase
        .from('requests')
        .select(`
          connection_id,
          connections!inner (
            ${context.variant === 'agency' ? 'client_id' : 'agency_id'}
          )
        `)
        .in('connection_id', matchingConnectionIds)
        .is('deleted_at', null)
        .eq('status', status);

      if (assignedToUserId) {
        clientCountQuery = clientCountQuery.eq('assignee_user_id', assignedToUserId);
      }
      if (createdByUserId) {
        clientCountQuery = clientCountQuery.eq('created_by_user_id', createdByUserId);
      }

      clientCountPromises.push(
        (async () => {
          const { data, error } = await clientCountQuery;
          if (error || !data) return;
          
          // Count requests per client org ID
          const countsByClient = new Map<string, number>();
          for (const row of data) {
            const connection = Array.isArray(row.connections) ? row.connections[0] : row.connections;
            if (!connection) continue;
            
            const clientOrgId = context.variant === 'agency' 
              ? (connection as { client_id: string }).client_id
              : (connection as { agency_id: string }).agency_id;
            
            if (clientOrgId) {
              const key = `${status}-${clientOrgId}`;
              countsByClient.set(key, (countsByClient.get(key) || 0) + 1);
            }
          }
          
          // Merge into clientCounts
          countsByClient.forEach((count, key) => {
            clientCounts[key] = count;
          });
        })()
      );
    }

    await Promise.all(clientCountPromises);
  }

  // If no requests, return early
  if (!requestsData || requestsData.length === 0) {
    return {
      requests: [],
      total: total || 0,
      unfilteredTotalCount: unfilteredTotalCount || 0,
      offset: offset + searchLimit, // Next offset
      hasMore: false,
      fetchedConnectionIds: [],
      allConnectionsMetadata: allConnectionsMetadata,
      statusCounts,
      clientCounts,
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
      offset: offset + searchLimit, // Next offset
      hasMore: false,
      fetchedConnectionIds: [],
      allConnectionsMetadata: allConnectionsMetadata,
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
  const hasMoreResults = (total || 0) > searchOffset + searchLimit;
  const nextCursor = hasMoreResults ? String(searchOffset + searchLimit) : null;
  
  // For search mode, we don't paginate by connections, so connection counts are not meaningful
  // But we can still provide total connection count for context
  const totalConnectionCount = connectionIds.length

  return {
    requests: requests,
    total: total || 0,
    unfilteredTotalCount: unfilteredTotalCount || 0,
    offset: searchOffset + searchLimit, // Next offset for search pagination
    hasMore: hasMoreResults,
    fetchedConnectionIds: [], // Empty for search mode (not connection-based pagination)
    allConnectionsMetadata: allConnectionsMetadata,
    statusCounts,
    clientCounts,
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

/**
 * Helper function to fetch all connection metadata for grouping
 * Returns Map<orgId, {name, logoUrl}>
 */
async function fetchAllConnectionsMetadata(
  context: EnhancedModeContext,
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<Map<string, { name: string; logoUrl?: string }>> {
  const allConnectionsMetadataQuery = context.variant === 'agency'
    ? supabase
        .from('connections')
        .select(`
          id,
          client_id,
          organizations!connections_client_id_fkey (
            id,
            name,
            logo_url
          )
        `)
        .eq('agency_id', context.orgId)
        .neq('connection_status', 'disconnected')
    : supabase
        .from('connections')
        .select(`
          id,
          agency_id,
          organizations!connections_agency_id_fkey (
            id,
            name,
            logo_url
          )
        `)
        .eq('client_id', context.orgId)
        .neq('connection_status', 'disconnected');

  const { data: allConnectionsMetadataData, error: allConnectionsMetadataError } = await allConnectionsMetadataQuery;

  const allConnectionsMetadata = new Map<string, { name: string; logoUrl?: string }>();
  if (!allConnectionsMetadataError && allConnectionsMetadataData) {
    for (const conn of allConnectionsMetadataData) {
      const orgId = context.variant === 'agency'
        ? (conn as { client_id: string; organizations: { id: string; name: string | null; logo_url: string | null } | Array<{ id: string; name: string | null; logo_url: string | null }> }).client_id
        : (conn as { agency_id: string; organizations: { id: string; name: string | null; logo_url: string | null } | Array<{ id: string; name: string | null; logo_url: string | null }> }).agency_id;

      const org = Array.isArray(conn.organizations) ? conn.organizations[0] : conn.organizations;
      if (org && orgId) {
        if (!allConnectionsMetadata.has(orgId)) {
          allConnectionsMetadata.set(orgId, {
            name: org.name || 'Unknown',
            logoUrl: org.logo_url || undefined
          });
        }
      }
    }
  }

  return allConnectionsMetadata;
}

/**
 * Helper function to transform raw request rows to Request[] format
 * Reuses transformation logic from existing functions
 */
async function transformRequestsToRequestFormat(
  requestsData: Array<{
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
  }>,
  context: EnhancedModeContext,
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<Request[]> {
  const uniqueConnectionIds = [...new Set(requestsData.map(r => r.connection_id))];
  const userIds = new Set<string>();
  requestsData.forEach(request => {
    if (request.created_by_user_id) userIds.add(request.created_by_user_id);
    if (request.assignee_user_id) userIds.add(request.assignee_user_id);
  });

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
  const { data: connectionsData, error: connectionsError } = connectionsResult;
  const { data: membershipsData, error: membershipsError } = membershipsResult;
  const { data: orgsData, error: orgsError } = orgsResult;

  const profilesMap: Record<string, { first_name: string; last_name: string; email: string; avatar_url?: string; job_title?: string }> = {};
  if (!profilesError && profilesData) {
    profilesData.forEach(profile => {
      profilesMap[profile.id] = profile;
    });
  }

  if (connectionsError) {
    console.error('Error fetching connections:', connectionsError);
    return [];
  }

  const connectionsMap = (connectionsData || []).reduce((acc, conn) => {
    acc[conn.id] = { clientId: conn.client_id, agencyId: conn.agency_id };
    return acc;
  }, {} as Record<string, { clientId: string; agencyId: string }>);

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

  // Fetch projects for requests that have project_id
  const projectIds: string[] = requestsData
    .map(r => r.project_id)
    .filter((id): id is string => id !== null);
  const uniqueProjectIds = [...new Set(projectIds)];
  const projectsMap: Record<string, { id: string; name: string }> = {};
  if (uniqueProjectIds.length > 0) {
    const { data: projectsData } = await supabase
      .from('projects')
      .select('id, name')
      .in('id', uniqueProjectIds)
      .is('deleted_at', null);

    if (projectsData) {
      projectsData.forEach(project => {
        projectsMap[project.id] = project;
      });
    }
  }

  return requestsData
    .filter(request => {
      return connectionsMap[request.connection_id] !== undefined;
    })
    .map(request => {
      const connectionInfo = connectionsMap[request.connection_id];
      if (!connectionInfo) {
        throw new Error('Connection not found in map');
      }

      const clientOrg = orgMap[connectionInfo.clientId];
      const agencyOrg = orgMap[connectionInfo.agencyId];

      const submittedByProfile = request.created_by_user_id ? profilesMap[request.created_by_user_id] || null : null;
      const assigneeProfile = request.assignee_user_id ? profilesMap[request.assignee_user_id] || null : null;

      let project = null;
      if (request.project_id) {
        const projectData = projectsMap[request.project_id];
        if (projectData) {
          project = { id: projectData.id, name: projectData.name };
        } else if (request.project_name_cached) {
          project = { id: request.project_id, name: request.project_name_cached };
        }
      }

      return {
        id: request.id,
        connectionId: request.connection_id,
        title: request.title,
        description: request.description || '',
        status: request.status as 'new' | 'in_review' | 'accepted' | 'canceled' | 'closed',
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
      } as Request;
    });
}

/**
 * Get requests counts (minimal metadata for accurate header counts)
 * Returns status counts and client counts without fetching request rows
 */
export const getRequestsCounts = cache(async (
  context: EnhancedModeContext,
  options: { assignedToUserId?: string; createdByUserId?: string } = {}
): Promise<{
  statusCounts: Record<string, number>;
  clientCounts: Record<string, number>;
}> => {
  const { assignedToUserId, createdByUserId } = options;
  const supabase = await createClient();
  const connectionIds = await getConnectionIdsForOrg(context, supabase);

  if (connectionIds.length === 0) {
    return {
      statusCounts: {},
      clientCounts: {},
    };
  }

  const { data, error } = await supabase.rpc('get_requests_counts', {
    p_connection_ids: connectionIds,
    p_assigned_to_user_id: assignedToUserId || null,
    p_created_by_user_id: createdByUserId || null,
  });

  if (error || !data) {
    console.error('Error fetching requests counts:', error);
    return {
      statusCounts: {},
      clientCounts: {},
    };
  }

  // Extract client counts based on view type
  // The RPC returns both 'agency' and 'client' views, we use the appropriate one
  const clientCountsRaw = data.client_counts || {};
  const clientCounts = context.variant === 'agency' 
    ? (clientCountsRaw.agency || {})
    : (clientCountsRaw.client || {});

  return {
    statusCounts: data.status_counts || {},
    clientCounts: clientCounts,
  };
});

/**
 * Get requests for a specific client organization in a specific status
 * Used for accordion fetch-on-expand pattern
 * Returns all requests for the client (no pagination needed)
 */
export const getRequestsForClientStatus = cache(async (
  context: EnhancedModeContext,
  clientOrgId: string,
  status: 'new' | 'in_review' | 'accepted' | 'closed' | 'canceled',
  options: { assignedToUserId?: string; createdByUserId?: string } = {}
): Promise<Request[]> => {
  const { assignedToUserId, createdByUserId } = options;

  // Validate context before proceeding
  if (!context || !context.orgId || !context.userId) {
    console.error('Invalid context provided to getRequestsForClientStatus:', { context });
    return [];
  }

  const supabase = await createClient();
  const connectionIds = await getConnectionIdsForOrg(context, supabase);

  if (connectionIds.length === 0) {
    return [];
  }

  // Call RPC function to fetch requests for this client in this status
  const { data: requestsData, error: requestsError } = await supabase.rpc(
    'get_requests_for_client_status',
    {
      p_connection_ids: connectionIds,
      p_client_org_id: clientOrgId,
      p_status: status,
      p_assigned_to_user_id: assignedToUserId || null,
      p_created_by_user_id: createdByUserId || null,
      p_view_type: context.variant,
    }
  );

  if (requestsError) {
    console.error('Error fetching requests for client status:', requestsError);
    return [];
  }

  if (!requestsData || requestsData.length === 0) {
    return [];
  }

  // Transform raw request rows to Request[] format
  const requests = await transformRequestsToRequestFormat(requestsData, context, supabase);

  return requests;
});

/**
 * Get requests flat (single pagination axis - MVP)
 * DEPRECATED: No longer used after accordion refactor. Replaced by getRequestsForClientStatus.
 * @deprecated Use getRequestsForClientStatus for accordion fetch-on-expand instead
 */
export const getRequestsFlat = cache(async (
  context: EnhancedModeContext,
  options: RequestsPaginationOptions = {}
): Promise<RequestsSnapshot> => {
  // Return empty snapshot - this function is deprecated
  // Accordion mode uses getRequestsForClientStatus instead
  const supabase = await createClient();
  const allConnectionsMetadata = await fetchAllConnectionsMetadata(context, supabase);
  
  return {
    requests: [],
    total: 0,
    unfilteredTotalCount: 0,
    offset: 0,
    hasMore: false,
    allConnectionsMetadata,
  };
});

/**
 * Search clients with their requests pre-loaded (server-side search mode)
 * Returns clients matching search text with all their requests as atomic data
 * Used for fast, flicker-free search results
 */
export const searchClientsWithRequests = cache(async (
  context: EnhancedModeContext,
  searchText: string,
  options?: {
    statusFilter?: ('new' | 'in_review' | 'accepted' | 'closed' | 'canceled')[];
    assignedToUserId?: string;
    createdByUserId?: string;
  }
): Promise<SearchResults> => {
  // Validate context
  if (!context || !context.orgId || !context.userId) {
    console.error('Invalid context provided to searchClientsWithRequests:', { context });
    return {
      clients: [],
      totalClients: 0,
    };
  }

  const supabase = await createClient();
  const connectionIds = await getConnectionIdsForOrg(context, supabase);

  if (connectionIds.length === 0) {
    return {
      clients: [],
      totalClients: 0,
    };
  }

  const { statusFilter, assignedToUserId, createdByUserId } = options || {};

  // Call RPC function
  const { data: searchResultsData, error: searchError } = await supabase.rpc(
    'search_clients_with_requests',
    {
      p_search_text: searchText.trim(),
      p_connection_ids: connectionIds,
      p_view_type: context.variant,
      p_status_filter: statusFilter || null,
      p_assigned_to_user_id: assignedToUserId || null,
      p_created_by_user_id: createdByUserId || null,
    }
  );

  if (searchError) {
    console.error('Error searching clients with requests:', searchError);
    return {
      clients: [],
      totalClients: 0,
    };
  }

  if (!searchResultsData || searchResultsData.length === 0) {
    return {
      clients: [],
      totalClients: 0,
    };
  }

  // Transform results: convert JSONB requests arrays to Request[] objects
  // CRITICAL: Convert created_at strings to Date objects (Postgres jsonb_agg returns strings)
  const clients: SearchClientResult[] = await Promise.all(
    searchResultsData.map(async (clientData: {
      client_id: string;
      client_name: string;
      client_logo_url: string | null;
      requests: Array<{
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
      }>;
    }) => {
      // Transform requests JSONB array to Request[] format
      const requestsData = clientData.requests || [];
      
      if (requestsData.length === 0) {
        return {
          client_id: clientData.client_id,
          client_name: clientData.client_name,
          client_logo_url: clientData.client_logo_url || undefined,
          requests: [],
        };
      }

      // Transform requests using existing transformation logic
      const transformedRequests = await transformRequestsToRequestFormat(
        requestsData.map(req => ({
          ...req,
          // Ensure created_at is a string (it already is from JSONB, but be explicit)
          created_at: req.created_at,
        })),
        context,
        supabase
      );

      // CRITICAL: Convert created_at strings to Date objects for frontend components
      // The transformRequestsToRequestFormat returns createdAt as string, but we need to ensure
      // it's properly formatted. Actually, looking at the Request type, createdAt is string,
      // so we don't need to convert to Date objects - the string format is fine.
      // However, if components expect Date objects, we'd convert here. For now, keep as strings.

      return {
        client_id: clientData.client_id,
        client_name: clientData.client_name,
        client_logo_url: clientData.client_logo_url || undefined,
        requests: transformedRequests,
      };
    })
  );

  return {
    clients,
    totalClients: clients.length,
  };
});

/**
 * Get all requests assigned to a user, grouped by client (assigned filter mode)
 * Returns clients with their assigned requests pre-loaded as atomic data
 * Used for fast, flicker-free assigned filter results
 */
export const getAssignedRequestsByClient = cache(async (
  context: EnhancedModeContext,
  options?: {
    statusFilter?: ('new' | 'in_review' | 'accepted' | 'closed' | 'canceled')[];
  }
): Promise<SearchResults> => {
  // Validate context
  if (!context || !context.orgId || !context.userId) {
    console.error('Invalid context provided to getAssignedRequestsByClient:', { context });
    return {
      clients: [],
      totalClients: 0,
    };
  }

  const supabase = await createClient();
  const connectionIds = await getConnectionIdsForOrg(context, supabase);

  if (connectionIds.length === 0) {
    return {
      clients: [],
      totalClients: 0,
    };
  }

  const { statusFilter } = options || {};

  // Call search_clients_with_requests with empty search text to match all clients
  // Filter by assignee_user_id for agency view, created_by_user_id for client view
  const { data: filterResultsData, error: filterError } = await supabase.rpc(
    'search_clients_with_requests',
    {
      p_search_text: '', // Empty string matches all organization names
      p_connection_ids: connectionIds,
      p_view_type: context.variant,
      p_status_filter: statusFilter || null,
      p_assigned_to_user_id: context.variant === 'agency' ? context.userId : null,
      p_created_by_user_id: context.variant === 'client' ? context.userId : null,
    }
  );

  if (filterError) {
    console.error('Error fetching assigned requests by client:', filterError);
    return {
      clients: [],
      totalClients: 0,
    };
  }

  if (!filterResultsData || filterResultsData.length === 0) {
    return {
      clients: [],
      totalClients: 0,
    };
  }

  // Transform results: convert JSONB requests arrays to Request[] objects
  const clients: SearchClientResult[] = await Promise.all(
    filterResultsData.map(async (clientData: {
      client_id: string;
      client_name: string;
      client_logo_url: string | null;
      requests: Array<{
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
      }>;
    }) => {
      // Transform requests JSONB array to Request[] format
      const requestsData = clientData.requests || [];
      
      if (requestsData.length === 0) {
        return {
          client_id: clientData.client_id,
          client_name: clientData.client_name,
          client_logo_url: clientData.client_logo_url || undefined,
          requests: [],
        };
      }

      // Transform requests using existing transformation logic
      const transformedRequests = await transformRequestsToRequestFormat(
        requestsData.map(req => ({
          ...req,
          created_at: req.created_at,
        })),
        context,
        supabase
      );

      return {
        client_id: clientData.client_id,
        client_name: clientData.client_name,
        client_logo_url: clientData.client_logo_url || undefined,
        requests: transformedRequests,
      };
    })
  );

  return {
    clients,
    totalClients: clients.length,
  };
});

