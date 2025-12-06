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
  const { search = '', cursor, limit = 50, sort = 'created', connectionIds: providedConnectionIds } = options;
  
  // Validate context before proceeding
  if (!context || !context.orgId || !context.userId) {
    console.error('Invalid context provided to getRequestsSnapshot:', { context });
    return {
      requests: [],
      total: 0,
      unfilteredTotalCount: 0,
      cursor: null,
      hasNextPage: false,
    };
  }

  const supabase = await createClient();
  
  // Use provided connection IDs or fetch them
  let connectionIds: string[] = providedConnectionIds || [];
  
  if (connectionIds.length === 0) {
    connectionIds = await getConnectionIdsForOrg(context, supabase);
  }

  if (connectionIds.length === 0) {
    // No connections, return empty result
    return {
      requests: [],
      total: 0,
      unfilteredTotalCount: 0,
      cursor: null,
      hasNextPage: false,
    };
  }

  // Always fetch unfiltered total count (needed to distinguish empty state vs "No results" during search)
  // This allows us to show empty state only when truly no requests exist, vs "No results" when search filters return nothing
  // This MUST be fetched even when searching to properly distinguish between "no requests exist" and "search returned no results"
  const { count: unfilteredTotalCountRaw, error: unfilteredCountError } = await supabase
    .from('requests')
    .select('id', { count: 'exact', head: true })
    .in('connection_id', connectionIds)
    .is('deleted_at', null);

  // Ensure we always have a valid number (default to 0 on error, but log it)
  const unfilteredTotalCount = unfilteredCountError ? 0 : (unfilteredTotalCountRaw ?? 0);
  
  if (unfilteredCountError) {
    console.error('Error fetching unfiltered total count:', unfilteredCountError);
  }

  // Normalize search query for status matching
  const normalizeStatusQuery = (query: string): string | null => {
    const normalized = query.toLowerCase().trim();
    const STATUS_KEYWORDS: Record<string, 'new' | 'in_review' | 'accepted' | 'canceled' | 'closed'> = {
      open: 'new',
      new: 'new',
      'in review': 'in_review',
      in_review: 'in_review',
      review: 'in_review',
      reviewing: 'in_review',
      accepted: 'accepted',
      approve: 'accepted',
      approved: 'accepted',
      accept: 'accepted',
      canceled: 'canceled',
      cancelled: 'canceled',
      cancel: 'canceled',
      closed: 'closed',
      close: 'closed',
      completed: 'closed'
    };
    return STATUS_KEYWORDS[normalized] ?? null;
  };

  // When searching, find matching profile IDs and connection IDs in parallel
  let matchingUserIds: string[] = [];
  let matchingConnectionIds: string[] = [];
  
  if (search && search.trim().length > 0) {
    const trimmedQuery = search.trim();
    const escaped = escapeForILike(trimmedQuery);
    const searchPattern = `%${escaped}%`;
    const searchTerms = trimmedQuery.toLowerCase().split(' ').filter(t => t.length > 0);
    
    // Parallelize profile search and connection/org search queries
    const [profilesResult, connectionsForOrgSearchResult] = await Promise.all([
      // Query profiles table for matching names (DB-level search)
      (() => {
        let profilesQuery = supabase
          .from('profiles')
          .select('id, first_name, last_name')
          .is('deleted_at', null);
        
        if (searchTerms.length > 1) {
          const firstTermEscaped = escapeForILike(searchTerms[0]);
          const secondTermEscaped = escapeForILike(searchTerms[1]);
          const firstPattern = `%${firstTermEscaped}%`;
          const secondPattern = `%${secondTermEscaped}%`;
          
          profilesQuery = profilesQuery.or(
            `and(first_name.ilike.${firstPattern},last_name.ilike.${secondPattern}),` +
            `and(first_name.ilike.${secondPattern},last_name.ilike.${firstPattern}),` +
            `first_name.ilike.${searchPattern},` +
            `last_name.ilike.${searchPattern}`
          );
        } else {
          profilesQuery = profilesQuery.or(`first_name.ilike.${searchPattern},last_name.ilike.${searchPattern}`);
        }
        return profilesQuery;
      })(),
      // Get connection org IDs for organization name search
      context.variant === 'agency'
        ? supabase
            .from('connections')
            .select('client_id')
            .eq('agency_id', context.orgId)
        : supabase
            .from('connections')
            .select('agency_id')
            .eq('client_id', context.orgId)
    ]);
    
    // Process profile results
    const { data: matchingProfiles, error: profilesError } = profilesResult;
    if (!profilesError && matchingProfiles) {
      if (searchTerms.length > 1) {
        matchingUserIds = matchingProfiles
          .filter(profile => {
            const firstName = (profile.first_name || '').toLowerCase();
            const lastName = (profile.last_name || '').toLowerCase();
            const fullName = `${firstName} ${lastName}`.trim();
            
            return searchTerms.every(term => 
              firstName.includes(term) || 
              lastName.includes(term) || 
              fullName.includes(term)
            );
          })
          .map(p => p.id);
      } else {
        matchingUserIds = matchingProfiles.map(p => p.id);
      }
    }
    
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

  // Apply search filter if search is provided (DB-level for all fields)
  if (search && search.trim().length > 0) {
    const trimmedQuery = search.trim();
    const escaped = escapeForILike(trimmedQuery);
    const matchedStatus = normalizeStatusQuery(trimmedQuery);
    const searchLower = trimmedQuery.toLowerCase();
    
    // Build OR list for search (all DB-level)
    const orParts: string[] = [];
    orParts.push(`title.ilike.%${escaped}%`);
    orParts.push(`project_name_cached.ilike.%${escaped}%`);
    
    // Handle "General request" search
    if (searchLower.includes('general')) {
      orParts.push(`project_id.is.null`);
    }
    
    if (matchedStatus) {
      orParts.push(`status.eq.${matchedStatus}`);
    }
    
    // Add profile name matches (DB-level via user IDs)
    if (matchingUserIds.length > 0) {
      orParts.push(`created_by_user_id.in.(${matchingUserIds.join(',')})`);
      orParts.push(`assignee_user_id.in.(${matchingUserIds.join(',')})`);
    }
    
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

  // Determine if we're sorting by organization name
  const isClientNameSort = sort === 'client_asc' || sort === 'client_desc';
  const isAgencyNameSort = sort === 'agency_asc' || sort === 'agency_desc';
  const isOrgNameSort = isClientNameSort || isAgencyNameSort;
  const startIndex = cursor ? parseInt(cursor, 10) : 0;

  // For org name sorting, use RPC function (bypasses PostgREST's two-level join limitation)
  // For other sorts, use regular Supabase query
  type RpcRequestRow = {
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
    client_id: string;
    agency_id: string;
    client_org_name: string | null;
    agency_org_name: string | null;
    client_org_logo: string | null;
    agency_org_logo: string | null;
  };
  type RegularRequestRow = {
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
  type RequestRow = RpcRequestRow | RegularRequestRow;
  let requestsData: RequestRow[] | null = null;
  let requestsError: { message?: string; code?: string } | null = null;
  let useRpcSort = false; // Track if we successfully used RPC

  if (isOrgNameSort) {
    // Use RPC function for org name sorting
    try {
      const rpcParams = {
        p_connection_ids: connectionIds,
        p_sort_type: sort,
        p_limit_count: limit,
        p_offset_count: startIndex,
        p_search_query: search && search.trim().length > 0 ? search.trim() : null,
        p_assigned_to_user_id: options.assignedToUserId || null,
        p_created_by_user_id: options.createdByUserId || null
      };
      
      const rpcResult = await supabase.rpc('get_requests_sorted_by_org_name', rpcParams);
      const { data: rpcData, error: rpcError } = rpcResult;

      if (rpcError) {
        // Log error details for debugging
        if (process.env.NODE_ENV === 'development') {
          console.error('RPC call failed:', {
            message: rpcError.message,
            code: rpcError.code,
            details: rpcError.details,
            hint: rpcError.hint
          });
        }
        
        // If function doesn't exist or has issues, fall back to regular query
        if (!rpcError.message && !rpcError.code) {
          console.warn('RPC function may not exist. Falling back to regular query (will not sort by org name).');
          console.warn('Please ensure migration 20251207000001_get_requests_sorted_by_org_name.sql has been run.');
        } else {
          console.error('RPC function error:', rpcError.message || rpcError.code);
        }
        requestsData = null; // Force regular query
      } else {
        // RPC succeeded - returns JSON array
        if (rpcData === null || rpcData === undefined) {
          requestsData = [];
        } else if (Array.isArray(rpcData)) {
          requestsData = rpcData;
        } else if (typeof rpcData === 'string') {
          requestsData = JSON.parse(rpcData);
        } else {
          // Already JSON object
          requestsData = rpcData;
        }
        useRpcSort = true; // Mark that we successfully used RPC
      }
    } catch (error) {
      console.error('Exception calling RPC:', error instanceof Error ? error.message : String(error));
      if (process.env.NODE_ENV === 'development') {
        console.error('Exception stack:', error instanceof Error ? error.stack : undefined);
      }
      console.warn('Falling back to regular query due to exception.');
      requestsData = null; // Force regular query
      useRpcSort = false;
    }
  }
  
  // If RPC failed or we're not using org name sort, use regular query
  // Note: If RPC failed, we fall back to 'created' sort since org name sorting won't work
  if (!isOrgNameSort || requestsData === null) {
    // If we were trying to sort by org name but RPC failed, change sort to 'created'
    const effectiveSort = (isOrgNameSort && !useRpcSort) ? 'created' : sort;
    // Use regular Supabase query for non-org-name sorts
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

    // Apply search filter if search is provided
    if (search && search.trim().length > 0) {
      const trimmedQuery = search.trim();
      const escaped = escapeForILike(trimmedQuery);
      const matchedStatus = normalizeStatusQuery(trimmedQuery);
      const searchLower = trimmedQuery.toLowerCase();
      
      const orParts: string[] = [];
      orParts.push(`title.ilike.%${escaped}%`);
      orParts.push(`project_name_cached.ilike.%${escaped}%`);
      
      if (searchLower.includes('general')) {
        orParts.push(`project_id.is.null`);
      }
      
      if (matchedStatus) {
        orParts.push(`status.eq.${matchedStatus}`);
      }
      
      if (matchingUserIds.length > 0) {
        orParts.push(`created_by_user_id.in.(${matchingUserIds.join(',')})`);
        orParts.push(`assignee_user_id.in.(${matchingUserIds.join(',')})`);
      }
      
      // Add client/agency organization name matches (DB-level via connection IDs)
      if (matchingConnectionIds.length > 0) {
        orParts.push(`connection_id.in.(${matchingConnectionIds.join(',')})`);
      }
      
      requestsQuery = requestsQuery.or(orParts.join(','));
    }

    // Apply sorting at database level
    switch (effectiveSort) {
      case 'created':
        requestsQuery = requestsQuery.order('created_at', { ascending: false });
        break;
      case 'status':
        requestsQuery = requestsQuery.order('status', { ascending: true }).order('created_at', { ascending: false });
        break;
      default:
        requestsQuery = requestsQuery.order('created_at', { ascending: false });
    }

    // Apply pagination at database level
    requestsQuery = requestsQuery.range(startIndex, startIndex + limit - 1);

    // Execute query
    const result = await requestsQuery;
    requestsData = result.data;
    requestsError = result.error;

    if (requestsError) {
      console.error('Error fetching requests:', requestsError);
      return {
        requests: [],
        total: 0,
        unfilteredTotalCount: unfilteredTotalCount || 0,
        cursor: null,
        hasNextPage: false,
      };
    }
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

  // Check if data comes from RPC function (has org names pre-joined)
  const isRpcData = requestsData.length > 0 && 'client_org_name' in requestsData[0];

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
    // Fetch organizations only if not from RPC (RPC already includes org data)
    !isRpcData
      ? (async () => {
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
      : Promise.resolve({ data: null, error: null })
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

  // Build org maps - use RPC data if available, otherwise use fetched data
  const orgMap: Record<string, { name: string; logoUrl?: string }> = {};
  const orgTypeMap: Record<string, 'agency' | 'client'> = {};
  
  if (isRpcData) {
    // Build org map from RPC response data
    requestsData.forEach((request) => {
      const rpcRequest = request as RpcRequestRow;
      if (rpcRequest.client_id && rpcRequest.client_org_name) {
        orgMap[rpcRequest.client_id] = {
          name: rpcRequest.client_org_name || 'Unknown',
          logoUrl: rpcRequest.client_org_logo || undefined
        };
      }
      if (rpcRequest.agency_id && rpcRequest.agency_org_name) {
        orgMap[rpcRequest.agency_id] = {
          name: rpcRequest.agency_org_name || 'Unknown',
          logoUrl: rpcRequest.agency_org_logo || undefined
        };
      }
    });
    
    // Fetch org types separately (not included in RPC response)
    const uniqueOrgIds = new Set<string>();
    Object.values(connectionsMap).forEach(conn => {
      uniqueOrgIds.add(conn.clientId);
      uniqueOrgIds.add(conn.agencyId);
    });
    const orgIdsArray = Array.from(uniqueOrgIds);
    if (orgIdsArray.length > 0) {
      const { data: orgTypesData } = await supabase
        .from('organizations')
        .select('id, type')
        .in('id', orgIdsArray);
      
      if (orgTypesData) {
        orgTypesData.forEach(org => {
          if (org.type === 'agency' || org.type === 'client') {
            orgTypeMap[org.id] = org.type as 'agency' | 'client';
          }
        });
      }
    }
  } else {
    // Build org map from fetched data
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
  }

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

  // Type guard to check if request is RegularRequestRow
  const isRegularRequestRow = (request: RequestRow): request is RegularRequestRow => {
    return 'connections' in request;
  };

  // Transform requests to Request[] format using joined data and fetched maps
  const requestsWithTimestamps: Array<{ request: Request; originalCreatedAt: number }> = requestsData
    .filter(request => {
      // Filter out requests with invalid connections
      if (isRpcData) {
        // RPC data has client_id and agency_id directly
        return request.connection_id && connectionsMap[request.connection_id] !== undefined;
      } else {
        // Regular query data has nested connections
        if (!isRegularRequestRow(request)) return false;
        const connection = Array.isArray(request.connections) ? request.connections[0] : request.connections;
        return connection !== null && connection !== undefined && connectionsMap[request.connection_id] !== undefined;
      }
    })
    .map(request => {
      // Extract connection info
      let connectionInfo: { clientId: string; agencyId: string };
      
      if (isRpcData) {
        // RPC data has client_id and agency_id directly
        const rpcRequest = request as RpcRequestRow;
        connectionInfo = {
          clientId: rpcRequest.client_id,
          agencyId: rpcRequest.agency_id
        };
      } else {
        // Regular query data has nested connections
        if (!isRegularRequestRow(request)) {
          throw new Error('Expected RegularRequestRow but got RpcRequestRow');
        }
        const connection = Array.isArray(request.connections) ? request.connections[0] : request.connections;
        if (!connection) {
          throw new Error('Invalid connection');
        }
        connectionInfo = connectionsMap[request.connection_id];
        if (!connectionInfo) {
          throw new Error('Connection not found in map');
        }
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
        if (!isRpcData) {
          // Regular query has joined project data
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
        } else {
          // RPC data - use cached project name (projects not included in RPC response for performance)
          if (request.project_name_cached) {
            project = { id: request.project_id, name: request.project_name_cached };
          }
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
          createdAt: formatters.formatRequestDate(request.created_at),
          createdByOrgId: request.created_by_org_id,
          createdByOrgType: formatters.getOrgType(request.created_by_org_id, orgTypeMap)
        } as Request,
        originalCreatedAt: new Date(request.created_at).getTime()
      };
    });

  // Extract requests - database has already sorted and paginated them
  const requests: Request[] = requestsWithTimestamps.map(item => item.request);

  // Calculate pagination info
  const hasNextPage = (total || 0) > startIndex + limit;
  const nextCursor = hasNextPage ? String(startIndex + limit) : null;

  return {
    requests: requests,
    total: total || 0,
    unfilteredTotalCount: unfilteredTotalCount || 0,
    cursor: nextCursor,
    hasNextPage,
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
    createdAt: formatters.formatRequestDate(request.created_at),
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

