import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import { escapeForILike } from '@/lib/utils';
import type { EnhancedModeContext } from '@/lib/mode/getActiveContext';
import type { TasksSnapshot, Task, TasksPaginationOptions } from './types';
import * as formatters from '../connections/formatters';

type _TaskRow = {
  id: string
  connection_id: string
  project_id: string | null
  title: string
  description: string | null
  status: 'to_do' | 'in_progress' | 'on_hold' | 'done'
  due_date: string | null
  assignee_user_id: string | null
  client_visible: boolean | null
  created_by_user_id: string
  created_at: string
  updated_at: string | null
  completed_at: string | null
  source_request_id?: string | null
}

type ProfileRow = {
  id: string
  first_name: string
  last_name: string
  email: string
  avatar_url?: string
  job_title?: string
}

type _MembershipRow = {
  user_id: string
  org_id: string
  organizations: {
    id: string
    name: string | null
    logo_url?: string | null
  } | Array<{
    id: string
    name: string | null
    logo_url?: string | null
  }>
}

type _OrganizationRow = {
  id: string
  name?: string | null
  logo_url?: string | null
}

const TASK_STATUS_KEYWORDS: Record<string, 'to_do' | 'in_progress' | 'on_hold' | 'done'> = {
  'to do': 'to_do',
  todo: 'to_do',
  open: 'to_do',
  backlog: 'to_do',
  'in progress': 'in_progress',
  progress: 'in_progress',
  active: 'in_progress',
  working: 'in_progress',
  'on hold': 'on_hold',
  hold: 'on_hold',
  paused: 'on_hold',
  blocked: 'on_hold',
  completed: 'done',
  complete: 'done',
  done: 'done',
  finished: 'done'
}

const normalizeTaskStatusQuery = (query: string): 'to_do' | 'in_progress' | 'on_hold' | 'done' | null => {
  const normalized = query.toLowerCase().trim()
  return TASK_STATUS_KEYWORDS[normalized] ?? null
}

/**
 * Get all tasks across all connections for the current organization
 * This is a global view that aggregates tasks from all connections
 */
export const getTasksSnapshot = cache(async (
  context: EnhancedModeContext,
  options: TasksPaginationOptions = {}
): Promise<TasksSnapshot> => {
  const { search = '', cursor, limit = 50, sort = 'status' } = options;
  
  // Validate context before proceeding
  if (!context || !context.orgId || !context.userId) {
    console.error('Invalid context provided to getTasksSnapshot:', { context });
    return {
      tasks: [],
      total: 0,
      unfilteredTotalCount: 0,
      cursor: null,
      hasNextPage: false,
    };
  }

  const supabase = await createClient();
  
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
    return {
      tasks: [],
      total: 0,
      unfilteredTotalCount: 0,
      cursor: null,
      hasNextPage: false,
    };
  }

  const connectionIds = connections.map(c => c.id);

  if (connectionIds.length === 0) {
    // No connections, return empty result
    return {
      tasks: [],
      total: 0,
      unfilteredTotalCount: 0,
      cursor: null,
      hasNextPage: false,
    };
  }

  // Always fetch unfiltered total count (needed to distinguish empty state vs "No results" during search)
  const { count: unfilteredTotalCountRaw, error: unfilteredCountError } = await supabase
    .from('tasks')
    .select('id', { count: 'exact', head: true })
    .in('connection_id', connectionIds)
    .is('deleted_at', null);

  const unfilteredTotalCount = unfilteredCountError ? 0 : (unfilteredTotalCountRaw ?? 0);
  
  if (unfilteredCountError) {
    console.error('Error fetching unfiltered total count:', unfilteredCountError);
  }

  // When searching, find matching profile IDs and connection IDs in parallel
  let matchingUserIds: string[] = [];
  let matchingConnectionIds: string[] = [];
  let projectIdsMatchingSearch: string[] = [];
  
  if (search && search.trim().length > 0) {
    const trimmedQuery = search.trim();
    const escaped = escapeForILike(trimmedQuery);
    const searchPattern = `%${escaped}%`;
    const searchTerms = trimmedQuery.toLowerCase().split(' ').filter(t => t.length > 0);
    
    // Parallelize profile search and connection/org search queries
    const [profilesResult, connectionsForOrgSearchResult, projectsResult] = await Promise.all([
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
            .eq('client_id', context.orgId),
      // Query projects table for matching project names
      supabase
        .from('projects')
        .select('id')
        .in('connection_id', connectionIds)
        .is('deleted_at', null)
        .ilike('name', `%${escaped}%`)
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

    // Process project search results
    const { data: matchingProjects, error: projectSearchError } = projectsResult;
    if (!projectSearchError && matchingProjects) {
      projectIdsMatchingSearch = matchingProjects.map(project => project.id);
    }
  }

  // Build the base query for filtering (used for both count and data)
  let baseQuery = supabase
    .from('tasks')
    .select('*', { count: 'exact', head: true })
    .in('connection_id', connectionIds)
    .is('deleted_at', null);

  if (options.assignedToUserId) {
    baseQuery = baseQuery.eq('assignee_user_id', options.assignedToUserId);
  } else if (options.assignedToUserIds && options.assignedToUserIds.length > 0) {
    baseQuery = baseQuery.in('assignee_user_id', options.assignedToUserIds);
  }

  // Apply search filter if search is provided (DB-level for all fields)
  if (search && search.trim().length > 0) {
    const trimmedQuery = search.trim();
    const escaped = escapeForILike(trimmedQuery);
    const matchedStatus = normalizeTaskStatusQuery(trimmedQuery);
    
    // Build OR list for search (all DB-level)
    const orParts: string[] = [];
    orParts.push(`title.ilike.%${escaped}%`);
    orParts.push(`description.ilike.%${escaped}%`);
    
    if (matchedStatus) {
      orParts.push(`status.eq.${matchedStatus}`);
    }
    
    // Add profile name matches (DB-level via user IDs) - only search by assignee, not creator
    if (matchingUserIds.length > 0) {
      orParts.push(`assignee_user_id.in.(${matchingUserIds.join(',')})`);
    }
    
    // Add client/agency organization name matches (DB-level via connection IDs)
    if (matchingConnectionIds.length > 0) {
      orParts.push(`connection_id.in.(${matchingConnectionIds.join(',')})`);
    }

    // Add project name matches (DB-level via project IDs)
    if (projectIdsMatchingSearch.length > 0) {
      const inClause = projectIdsMatchingSearch.map(id => `"${id}"`).join(',')
      orParts.push(`project_id.in.(${inClause})`)
    }
    
    baseQuery = baseQuery.or(orParts.join(','));
  }

  // Get total count with filters applied
  const { count: total, error: countError } = await baseQuery;

  if (countError) {
    console.error('Error fetching tasks count:', countError);
  }

  // Determine if we're sorting by organization name
  const isClientNameSort = sort === 'client_asc' || sort === 'client_desc';
  const isAgencyNameSort = sort === 'agency_asc' || sort === 'agency_desc';
  const isOrgNameSort = isClientNameSort || isAgencyNameSort;
  const isDueDateSort = sort === 'due_date';
  const isStatusSort = sort === 'status';
  const startIndex = cursor ? parseInt(cursor, 10) : 0;

  // Use RPC functions for all sort types to enable proper DB-level pagination
  type RpcTaskRow = {
    id: string;
    connection_id: string;
    project_id: string | null;
    title: string;
    description: string | null;
    status: string;
    due_date: string | null;
    assignee_user_id: string | null;
    client_visible: boolean | null;
    created_by_user_id: string;
    created_at: string;
    updated_at: string | null;
    completed_at: string | null;
    source_request_id: string | null;
    client_id: string;
    agency_id: string;
    client_org_name: string | null;
    agency_org_name: string | null;
    client_org_logo: string | null;
    agency_org_logo: string | null;
  };
  type RegularTaskRow = {
    id: string;
    connection_id: string;
    project_id: string | null;
    title: string;
    description: string | null;
    status: string;
    due_date: string | null;
    assignee_user_id: string | null;
    client_visible: boolean | null;
    created_by_user_id: string;
    created_at: string;
    updated_at: string | null;
    completed_at: string | null;
    source_request_id: string | null;
    connections: {
      id: string;
      client_id: string;
      agency_id: string;
    } | Array<{
      id: string;
      client_id: string;
      agency_id: string;
    }>;
  };
  type TaskRow = RpcTaskRow | RegularTaskRow;
  let tasksData: TaskRow[] | null = null;
  let tasksError: { message?: string; code?: string } | null = null;
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
        p_assigned_to_user_ids: options.assignedToUserIds || null
      };
      
      const rpcResult = await supabase.rpc('get_tasks_sorted_by_org_name', rpcParams);
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
          console.warn('Please ensure migration 20251207000002_get_tasks_sorted_by_org_name.sql has been run.');
        } else {
          console.error('RPC function error:', rpcError.message || rpcError.code);
        }
        tasksData = null; // Force regular query
      } else {
        // RPC succeeded - returns JSON array
        if (rpcData === null || rpcData === undefined) {
          tasksData = [];
        } else if (Array.isArray(rpcData)) {
          tasksData = rpcData;
        } else if (typeof rpcData === 'string') {
          tasksData = JSON.parse(rpcData);
        } else {
          // Already JSON object
          tasksData = rpcData;
        }
        useRpcSort = true; // Mark that we successfully used RPC
      }
    } catch (error) {
      console.error('Exception calling RPC:', error instanceof Error ? error.message : String(error));
      if (process.env.NODE_ENV === 'development') {
        console.error('Exception stack:', error instanceof Error ? error.stack : undefined);
      }
      console.warn('Falling back to regular query due to exception.');
      tasksData = null; // Force regular query
      useRpcSort = false;
    }
  } else if (isDueDateSort) {
    // Use RPC function for due_date sorting
    try {
      const rpcParams = {
        p_connection_ids: connectionIds,
        p_limit_count: limit,
        p_offset_count: startIndex,
        p_search_query: search && search.trim().length > 0 ? search.trim() : null,
        p_assigned_to_user_id: options.assignedToUserId || null,
        p_assigned_to_user_ids: options.assignedToUserIds || null,
        p_matching_user_ids: matchingUserIds.length > 0 ? matchingUserIds : null,
        p_matching_connection_ids: matchingConnectionIds.length > 0 ? matchingConnectionIds : null,
        p_project_ids_matching_search: projectIdsMatchingSearch.length > 0 ? projectIdsMatchingSearch : null
      };
      
      const rpcResult = await supabase.rpc('get_tasks_sorted_by_due_date', rpcParams);
      const { data: rpcData, error: rpcError } = rpcResult;

      if (rpcError) {
        if (process.env.NODE_ENV === 'development') {
          console.error('RPC call failed:', {
            message: rpcError.message,
            code: rpcError.code,
            details: rpcError.details,
            hint: rpcError.hint
          });
        }
        tasksData = null;
      } else {
        if (rpcData === null || rpcData === undefined) {
          tasksData = [];
        } else if (Array.isArray(rpcData)) {
          tasksData = rpcData;
        } else if (typeof rpcData === 'string') {
          tasksData = JSON.parse(rpcData);
        } else {
          tasksData = rpcData;
        }
        useRpcSort = true;
      }
    } catch (error) {
      console.error('Exception calling RPC:', error instanceof Error ? error.message : String(error));
      if (process.env.NODE_ENV === 'development') {
        console.error('Exception stack:', error instanceof Error ? error.stack : undefined);
      }
      tasksData = null;
      useRpcSort = false;
    }
  } else if (isStatusSort) {
    // Use RPC function for status sorting
    try {
      const rpcParams = {
        p_connection_ids: connectionIds,
        p_limit_count: limit,
        p_offset_count: startIndex,
        p_search_query: search && search.trim().length > 0 ? search.trim() : null,
        p_assigned_to_user_id: options.assignedToUserId || null,
        p_assigned_to_user_ids: options.assignedToUserIds || null,
        p_matching_user_ids: matchingUserIds.length > 0 ? matchingUserIds : null,
        p_matching_connection_ids: matchingConnectionIds.length > 0 ? matchingConnectionIds : null,
        p_project_ids_matching_search: projectIdsMatchingSearch.length > 0 ? projectIdsMatchingSearch : null
      };
      
      const rpcResult = await supabase.rpc('get_tasks_sorted_by_status', rpcParams);
      const { data: rpcData, error: rpcError } = rpcResult;

      if (rpcError) {
        if (process.env.NODE_ENV === 'development') {
          console.error('RPC call failed:', {
            message: rpcError.message,
            code: rpcError.code,
            details: rpcError.details,
            hint: rpcError.hint
          });
        }
        tasksData = null;
      } else {
        if (rpcData === null || rpcData === undefined) {
          tasksData = [];
        } else if (Array.isArray(rpcData)) {
          tasksData = rpcData;
        } else if (typeof rpcData === 'string') {
          tasksData = JSON.parse(rpcData);
        } else {
          tasksData = rpcData;
        }
        useRpcSort = true;
      }
    } catch (error) {
      console.error('Exception calling RPC:', error instanceof Error ? error.message : String(error));
      if (process.env.NODE_ENV === 'development') {
        console.error('Exception stack:', error instanceof Error ? error.stack : undefined);
      }
      tasksData = null;
      useRpcSort = false;
    }
  }
  
  // If RPC failed or we're using a sort that doesn't have an RPC function, use regular query
  // Note: This fallback should rarely be needed in production
  if (!useRpcSort || tasksData === null) {
    // Build the tasks query with joins for fetching data
    let tasksQuery = supabase
      .from('tasks')
      .select(`
        id,
        connection_id,
        project_id,
        title,
        description,
        status,
        due_date,
        assignee_user_id,
        client_visible,
        created_by_user_id,
        created_at,
        updated_at,
        completed_at,
        source_request_id,
        connections!inner (
          id,
          client_id,
          agency_id
        )
      `)
      .in('connection_id', connectionIds)
      .is('deleted_at', null);

    if (options.assignedToUserId) {
      tasksQuery = tasksQuery.eq('assignee_user_id', options.assignedToUserId);
    } else if (options.assignedToUserIds && options.assignedToUserIds.length > 0) {
      tasksQuery = tasksQuery.in('assignee_user_id', options.assignedToUserIds);
    }

    // Apply search filter if search is provided
    if (search && search.trim().length > 0) {
      const trimmedQuery = search.trim();
      const escaped = escapeForILike(trimmedQuery);
      const matchedStatus = normalizeTaskStatusQuery(trimmedQuery);
      
      const orParts: string[] = [];
      orParts.push(`title.ilike.%${escaped}%`);
      orParts.push(`description.ilike.%${escaped}%`);
      
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

      // Add project name matches (DB-level via project IDs)
      if (projectIdsMatchingSearch.length > 0) {
        const inClause = projectIdsMatchingSearch.map(id => `"${id}"`).join(',')
        orParts.push(`project_id.in.(${inClause})`)
      }
      
      tasksQuery = tasksQuery.or(orParts.join(','));
    }

    // Apply sorting at database level
    const effectiveSort = (isOrgNameSort && !useRpcSort) ? 'due_date' : sort;
    
    switch (effectiveSort) {
      case 'status':
        tasksQuery = tasksQuery.order('status', { ascending: true }).order('created_at', { ascending: false });
        break;
      case 'due_date':
        tasksQuery = tasksQuery.order('due_date', { ascending: true, nullsFirst: false }).order('created_at', { ascending: false });
        break;
      default:
        tasksQuery = tasksQuery.order('created_at', { ascending: false });
    }

    // Apply pagination at database level
    tasksQuery = tasksQuery.range(startIndex, startIndex + limit - 1);

    // Execute query
    const queryResult = await tasksQuery;
    tasksData = queryResult.data;
    tasksError = queryResult.error;
  }

  if (tasksError) {
    console.error('Error fetching tasks:', tasksError);
    return {
      tasks: [],
      total: 0,
      unfilteredTotalCount: unfilteredTotalCount || 0,
      cursor: null,
      hasNextPage: false,
    };
  }

  // If no tasks, return early
  if (!tasksData || tasksData.length === 0) {
    return {
      tasks: [],
      total: total || 0,
      unfilteredTotalCount: unfilteredTotalCount || 0,
      cursor: null,
      hasNextPage: false,
    };
  }

  // Check if data comes from RPC function
  // All RPC functions return client_org_name/agency_org_name, or have client_id/agency_id without nested connections
  const isRpcData = tasksData.length > 0 && tasksData[0] && (
    'client_org_name' in tasksData[0] || 
    ('client_id' in tasksData[0] && 'agency_id' in tasksData[0] && !('connections' in tasksData[0]))
  );

  // Extract unique connection IDs and user IDs for parallel lookups
  const uniqueConnectionIds = [...new Set(tasksData.map(t => t.connection_id))];
  const userIds = new Set<string>();
  const requestIds = new Set<string>();
  tasksData.forEach(task => {
    if (task.created_by_user_id) userIds.add(task.created_by_user_id);
    if (task.assignee_user_id) userIds.add(task.assignee_user_id);
    if (task.source_request_id) requestIds.add(task.source_request_id);
  });

  // Fetch profiles, organizations, memberships, projects, and linked requests in parallel
  const userIdArray = Array.from(userIds);
  const requestIdArray = Array.from(requestIds);
  const [profilesResult, connectionsResult, membershipsResult, projectsResult, requestsResult] = await Promise.all([
    // Fetch profiles for submitted_by and assignee
    userIdArray.length > 0
      ? supabase
          .from('profiles')
          .select('id, first_name, last_name, email, avatar_url, job_title')
          .in('id', userIdArray)
      : Promise.resolve({ data: null, error: null }),
    // Fetch connection info with organization IDs
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
    // Fetch projects
    supabase
      .from('projects')
      .select('id, name, connection_id')
      .in('connection_id', uniqueConnectionIds)
      .is('deleted_at', null),
    // Fetch linked requests
    requestIdArray.length > 0
      ? supabase
          .from('requests')
          .select('id, title, created_by_user_id, created_at')
          .in('id', requestIdArray)
          .is('deleted_at', null)
      : Promise.resolve({ data: null, error: null })
  ]);

  const { data: profilesData, error: profilesError } = profilesResult;
  const { data: connectionsData, error: connectionsError } = connectionsResult;
  const { data: membershipsData, error: membershipsError } = membershipsResult;
  const { data: projectsData, error: projectsError } = projectsResult;
  const { data: requestsData, error: requestsError } = requestsResult;

  // Build profiles map
  const profilesMap: Record<string, ProfileRow> = {};
  if (!profilesError && profilesData) {
    profilesData.forEach(profile => {
      profilesMap[profile.id] = {
        id: profile.id,
        first_name: profile.first_name || '',
        last_name: profile.last_name || '',
        email: profile.email || '',
        avatar_url: profile.avatar_url || undefined,
        job_title: profile.job_title || undefined
      };
    });
  }

  if (connectionsError) {
    console.error('Error fetching connections:', connectionsError);
    return {
      tasks: [],
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

  // Get unique org IDs (client and agency)
  const uniqueOrgIds = new Set<string>();
  Object.values(connectionsMap).forEach(conn => {
    uniqueOrgIds.add(conn.clientId);
    uniqueOrgIds.add(conn.agencyId);
  });

  // Fetch organizations
  const orgIdsArray = Array.from(uniqueOrgIds);
  const { data: orgsData, error: orgsError } = await supabase
    .from('organizations')
    .select('id, name, logo_url, type')
    .in('id', orgIdsArray);

  if (orgsError) {
    console.error('Error fetching organizations:', orgsError);
  }

  // Build org maps - use RPC data if available, otherwise use fetched data
  const orgMap: Record<string, { name: string; logoUrl?: string }> = {};
  const orgTypeMap: Record<string, 'agency' | 'client'> = {};
  
  if (isRpcData) {
    // Build org map from RPC response data
    tasksData.forEach((task) => {
      const rpcTask = task as RpcTaskRow;
      if (rpcTask.client_id && rpcTask.client_org_name) {
        orgMap[rpcTask.client_id] = {
          name: rpcTask.client_org_name || 'Unknown',
          logoUrl: rpcTask.client_org_logo || undefined
        };
      }
      if (rpcTask.agency_id && rpcTask.agency_org_name) {
        orgMap[rpcTask.agency_id] = {
          name: rpcTask.agency_org_name || 'Unknown',
          logoUrl: rpcTask.agency_org_logo || undefined
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

  // Build projects map
  const projectMap: Record<string, { id: string; name: string }> = {};
  if (!projectsError && projectsData) {
    projectsData.forEach(project => {
      projectMap[project.id] = { id: project.id, name: project.name };
    });
  }

  // Build requests map and collect request creator user IDs
  const requestMap: Record<string, { id: string; title: string | null; created_by_user_id: string | null; created_at: string | null }> = {};
  const requestCreatorUserIds = new Set<string>();
  if (!requestsError && requestsData) {
    requestsData.forEach(request => {
      requestMap[request.id] = request;
      if (request.created_by_user_id) {
        requestCreatorUserIds.add(request.created_by_user_id);
      }
    });
  }

  // Fetch profiles for request creators if we don't already have them
  const missingCreatorIds = Array.from(requestCreatorUserIds).filter(id => !userIds.has(id));
  const requestCreatorProfilesMap: Record<string, ProfileRow> = {};
  if (missingCreatorIds.length > 0) {
    const { data: creatorProfilesData } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, email, avatar_url, job_title')
      .in('id', missingCreatorIds);
    
    if (creatorProfilesData) {
      creatorProfilesData.forEach(profile => {
        requestCreatorProfilesMap[profile.id] = {
          id: profile.id,
          first_name: profile.first_name || '',
          last_name: profile.last_name || '',
          email: profile.email || '',
          avatar_url: profile.avatar_url || undefined,
          job_title: profile.job_title || undefined
        };
      });
    }
  }

  // Type guard to check if task is RegularTaskRow
  const isRegularTaskRow = (task: TaskRow): task is RegularTaskRow => {
    return 'connections' in task;
  };

  // Transform tasks to Task[] format using joined data and fetched maps
  // Preserve original created_at, due_date, and completed_at for sorting
  const tasksWithTimestamps: Array<{ task: Task; originalCreatedAt: number; originalDueDate: number | null; originalCompletedAt: number | null }> = tasksData
    .filter(taskRow => {
      // Filter out tasks with invalid connections
      if (isRpcData) {
        // RPC data has client_id and agency_id directly
        return taskRow.connection_id && connectionsMap[taskRow.connection_id] !== undefined;
      } else {
        // Regular query data has nested connections
        if (!isRegularTaskRow(taskRow)) return false;
        const connection = Array.isArray(taskRow.connections) ? taskRow.connections[0] : taskRow.connections;
        return connection !== null && connection !== undefined && connectionsMap[taskRow.connection_id] !== undefined;
      }
    })
    .map(taskRow => {
      // Extract connection info
      let connectionInfo: { clientId: string; agencyId: string };
      
      if (isRpcData) {
        // RPC data has client_id and agency_id directly
        const rpcTask = taskRow as RpcTaskRow;
        connectionInfo = {
          clientId: rpcTask.client_id,
          agencyId: rpcTask.agency_id
        };
      } else {
        // Regular query data has nested connections
        if (!isRegularTaskRow(taskRow)) {
          throw new Error('Expected RegularTaskRow but got RpcTaskRow');
        }
        const connection = Array.isArray(taskRow.connections) ? taskRow.connections[0] : taskRow.connections;
        if (!connection) {
          throw new Error('Invalid connection');
        }
        connectionInfo = connectionsMap[taskRow.connection_id];
        if (!connectionInfo) {
          throw new Error('Connection not found in map');
        }
      }

      // Get organization data from maps (or RPC data)
      const clientOrg = orgMap[connectionInfo.clientId];
      const agencyOrg = orgMap[connectionInfo.agencyId];
      
      // Extract profile data from fetched map
      const submittedByProfile = taskRow.created_by_user_id ? profilesMap[taskRow.created_by_user_id] || null : null;
      const assigneeProfile = taskRow.assignee_user_id ? profilesMap[taskRow.assignee_user_id] || null : null;
      
      // Extract project data
      const project = taskRow.project_id ? projectMap[taskRow.project_id] : null;

      return {
        task: {
          id: taskRow.id,
          connectionId: taskRow.connection_id,
          title: taskRow.title,
          description: taskRow.description || '',
          status: taskRow.status as 'to_do' | 'in_progress' | 'on_hold' | 'done',
          project: project || null,
          submittedBy: formatters.buildSubmittedBy(
            taskRow.created_by_user_id,
            submittedByProfile,
            userOrgMap
          ),
          assignee: formatters.buildAssignee(taskRow.assignee_user_id, assigneeProfile),
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
          createdAt: formatters.formatRequestDate(taskRow.created_at),
          createdAtRaw: taskRow.created_at,
          updatedAt: taskRow.updated_at ? formatters.formatRequestDate(taskRow.updated_at) : undefined,
          dueDate: taskRow.due_date ? formatters.formatRequestDate(taskRow.due_date) : undefined,
          dueDateRaw: taskRow.due_date,
          completedAt: taskRow.completed_at ? formatters.formatRequestDate(taskRow.completed_at) : undefined,
          completedAtRaw: taskRow.completed_at,
          createdByUserId: taskRow.created_by_user_id,
          createdByOrgId: userOrgMap[taskRow.created_by_user_id]?.orgId,
          createdByOrgType: formatters.getOrgType(userOrgMap[taskRow.created_by_user_id]?.orgId || null, orgTypeMap),
          clientVisible: Boolean(taskRow.client_visible),
          clientVisibilityLocked: false, // Will be calculated if needed
          sourceRequestId: taskRow.source_request_id ?? null,
          linkedRequest: (() => {
            if (!taskRow.source_request_id) return null;
            const requestData = requestMap[taskRow.source_request_id];
            if (!requestData) return null;
            
            // Get creator profile (check both maps)
            const creatorProfile = requestData.created_by_user_id
              ? (profilesMap[requestData.created_by_user_id] || requestCreatorProfilesMap[requestData.created_by_user_id])
              : undefined;
            
            const creatorNameRaw = creatorProfile
              ? `${creatorProfile.first_name || ''} ${creatorProfile.last_name || ''}`.trim()
              : undefined;
            const creatorName = creatorNameRaw && creatorNameRaw.length > 0
              ? creatorNameRaw
              : creatorProfile?.email;
            
            return {
              id: requestData.id,
              title: (requestData.title || '').trim() || 'Untitled request',
              createdAt: requestData.created_at ? formatters.formatRequestDate(requestData.created_at) : '',
              createdByUserId: requestData.created_by_user_id ?? undefined,
              createdByName: creatorName,
            };
          })(),
        } as Task,
        originalCreatedAt: new Date(taskRow.created_at).getTime(),
        originalDueDate: taskRow.due_date ? new Date(taskRow.due_date).getTime() : null,
        originalCompletedAt: taskRow.completed_at ? new Date(taskRow.completed_at).getTime() : null
      };
    });

  // Tasks are already sorted and paginated by RPC functions or fallback query
  // Extract tasks (no need for in-memory sorting/pagination)
  const sortedTasks = tasksWithTimestamps.map(item => item.task);

  // Calculate pagination info
  // Use total count from filtered query to determine if there are more pages
  const hasNextPage = (total || 0) > startIndex + sortedTasks.length;
  const nextCursor = hasNextPage ? String(startIndex + limit) : null;

  return {
    tasks: sortedTasks,
    total: total || 0, // Use count from filtered query, not length of returned tasks
    unfilteredTotalCount: unfilteredTotalCount || 0,
    cursor: nextCursor,
    hasNextPage,
  };
});

/**
 * Get a single task by ID (works across all connections) - NON-CACHED version for immediate post-insert fetches
 * @param connectionId - Optional connection ID. If provided, filters directly by connection_id (faster, more reliable)
 */
export async function getTaskByIdGlobalUncached(
  taskId: string,
  context: EnhancedModeContext,
  connectionId?: string
): Promise<Task | null> {
  if (!context || !context.orgId || !context.userId) {
    return null;
  }

  const supabase = await createClient();

  // CRITICAL: Query task WITHOUT inner join (matches working getTaskById pattern)
  // Inner joins can fail if the FK relationship isn't immediately visible after insert
  let taskQuery = supabase
    .from('tasks')
    .select(`
      id,
      connection_id,
      project_id,
      title,
      description,
      status,
      due_date,
      assignee_user_id,
      client_visible,
      created_by_user_id,
      created_at,
      updated_at,
      completed_at,
      source_request_id
    `)
    .eq('id', taskId)
    .is('deleted_at', null);

  // If connectionId is provided, filter by it directly (faster and more reliable)
  if (connectionId) {
    taskQuery = taskQuery.eq('connection_id', connectionId);
  }

  const { data: task, error } = await taskQuery.single();

  if (error || !task) {
    return null;
  }

  // Fetch connection info separately (no inner join)
  const { data: connection, error: connectionError } = await supabase
    .from('connections')
    .select('agency_id, client_id')
    .eq('id', task.connection_id)
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
      task.connection_id,
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
  if (task.created_by_user_id) userIds.add(task.created_by_user_id);
  if (task.assignee_user_id) userIds.add(task.assignee_user_id);

  // Fetch user profiles, memberships, project, and linked request in parallel
  const userIdArray = Array.from(userIds);
  const [profilesResult, membershipsResult, projectResult, requestResult] = await Promise.all([
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
    task.project_id
      ? supabase
          .from('projects')
          .select('id, name')
          .eq('id', task.project_id)
          .is('deleted_at', null)
          .single()
      : Promise.resolve({ data: null, error: null }),
    task.source_request_id
      ? supabase
          .from('requests')
          .select('id, title, created_by_user_id, created_at')
          .eq('id', task.source_request_id)
          .is('deleted_at', null)
          .single()
      : Promise.resolve({ data: null, error: null })
  ]);

  // Build profiles map
  const profilesMap: Record<string, ProfileRow> = {};
  if (!profilesResult.error && profilesResult.data) {
    profilesResult.data.forEach(profile => {
      profilesMap[profile.id] = {
        id: profile.id,
        first_name: profile.first_name || '',
        last_name: profile.last_name || '',
        email: profile.email || '',
        avatar_url: profile.avatar_url || undefined,
        job_title: profile.job_title || undefined
      };
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

  // Get org type map
  const orgTypeMap: Record<string, 'agency' | 'client'> = {};
  const createdByOrgId = userOrgMap[task.created_by_user_id]?.orgId;
  if (createdByOrgId) {
    // Fetch org type for created_by org
    const { data: orgTypeData } = await supabase
      .from('organizations')
      .select('type')
      .eq('id', createdByOrgId)
      .single();
    
    if (orgTypeData && (orgTypeData.type === 'agency' || orgTypeData.type === 'client')) {
      orgTypeMap[createdByOrgId] = orgTypeData.type as 'agency' | 'client';
    }
  }

  // Get project
  let project = null;
  if (task.project_id) {
    if (!projectResult.error && projectResult.data) {
      project = { id: projectResult.data.id, name: projectResult.data.name };
    }
  }

  const submittedByProfile = task.created_by_user_id ? profilesMap[task.created_by_user_id] : null;
  const assigneeProfile = task.assignee_user_id ? profilesMap[task.assignee_user_id] : null;

  // Build linkedRequest if source_request_id exists
  let linkedRequest = null;
  if (task.source_request_id && !requestResult.error && requestResult.data) {
    const requestData = requestResult.data;
    // Fetch request creator profile if not already fetched
    let requestCreatorProfile: ProfileRow | undefined;
    if (requestData.created_by_user_id) {
      if (profilesMap[requestData.created_by_user_id]) {
        requestCreatorProfile = profilesMap[requestData.created_by_user_id];
      } else {
        // Fetch creator profile if not already in map
        const { data: creatorProfileData } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, email, avatar_url, job_title')
          .eq('id', requestData.created_by_user_id)
          .single();
        
        if (creatorProfileData) {
          requestCreatorProfile = {
            id: creatorProfileData.id,
            first_name: creatorProfileData.first_name || '',
            last_name: creatorProfileData.last_name || '',
            email: creatorProfileData.email || '',
            avatar_url: creatorProfileData.avatar_url || undefined,
            job_title: creatorProfileData.job_title || undefined
          };
        }
      }
    }
    
    const creatorNameRaw = requestCreatorProfile
      ? `${requestCreatorProfile.first_name || ''} ${requestCreatorProfile.last_name || ''}`.trim()
      : undefined;
    const creatorName = creatorNameRaw && creatorNameRaw.length > 0
      ? creatorNameRaw
      : requestCreatorProfile?.email;
    
    linkedRequest = {
      id: requestData.id,
      title: (requestData.title || '').trim() || 'Untitled request',
      createdAt: requestData.created_at ? formatters.formatRequestDate(requestData.created_at) : '',
      createdByUserId: requestData.created_by_user_id ?? undefined,
      createdByName: creatorName,
    };
  }

  return {
    id: task.id,
    connectionId: task.connection_id,
    title: task.title,
    description: task.description || '',
    status: task.status as 'to_do' | 'in_progress' | 'on_hold' | 'done',
    project: project || null,
    submittedBy: formatters.buildSubmittedBy(
      task.created_by_user_id,
      submittedByProfile,
      userOrgMap
    ),
    assignee: formatters.buildAssignee(task.assignee_user_id, assigneeProfile),
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
    createdAt: formatters.formatRequestDate(task.created_at),
    createdAtRaw: task.created_at,
    updatedAt: task.updated_at ? formatters.formatRequestDate(task.updated_at) : undefined,
    dueDate: task.due_date ? formatters.formatRequestDate(task.due_date) : undefined,
    dueDateRaw: task.due_date,
    completedAt: task.completed_at ? formatters.formatRequestDate(task.completed_at) : undefined,
    completedAtRaw: task.completed_at,
    createdByUserId: task.created_by_user_id,
    createdByOrgId: userOrgMap[task.created_by_user_id]?.orgId,
    createdByOrgType: formatters.getOrgType(userOrgMap[task.created_by_user_id]?.orgId || null, orgTypeMap),
    clientVisible: Boolean(task.client_visible),
    clientVisibilityLocked: false, // Can be calculated if needed
    sourceRequestId: task.source_request_id ?? null,
    linkedRequest,
  };
}

/**
 * Get a single task by ID (works across all connections) - CACHED version
 * @param connectionId - Optional connection ID. If provided, filters directly by connection_id (faster, more reliable)
 */
export const getTaskByIdGlobal = cache(getTaskByIdGlobalUncached);

/**
 * Get client members for the active organization
 * Only fetches when context.variant === 'client'
 */
export const getClientMembersForActiveOrg = cache(async (
  context: EnhancedModeContext
): Promise<Array<{
  id: string
  firstName: string
  lastName: string
  email: string
  avatarUrl?: string
  jobTitle?: string
}>> => {
  // Only fetch for clients
  if (context.variant !== 'client') {
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

  // Fetch client members
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
      console.error('Error fetching client members:', membersError);
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
 * Get all connections for the current organization (for global task creation)
 * Returns connections with partner organization data
 */
export const getConnectionsForGlobalView = cache(async (
  context: EnhancedModeContext
): Promise<Array<{
  id: string
  name: string
  logoUrl?: string
  orgId: string // Organization ID (client_id for agencies, agency_id for clients)
}>> => {
  const supabase = await createClient();
  
  if (context.variant === 'agency') {
    // Agency viewing clients - get all client connections
    // Exclude disconnected connections (frozen/read-only)
    const { data: connections, error } = await supabase
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
      .order('created_at', { ascending: false });
    
    if (error || !connections) {
      console.error('Error fetching client connections:', error);
      return [];
    }
    
    return connections
      .filter((conn): conn is typeof conn & { organizations: { name: string; logo_url: string | null }; client_id: string } => !!conn.organizations && !!conn.client_id)
      .map(conn => ({
        id: conn.id,
        name: conn.organizations.name,
        logoUrl: conn.organizations.logo_url || undefined,
        orgId: conn.client_id
      }));
  } else {
    // Client viewing agencies - get all agency connections
    // Exclude disconnected connections (frozen/read-only)
    const { data: connections, error } = await supabase
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
      .neq('connection_status', 'disconnected')
      .order('created_at', { ascending: false });
    
    if (error || !connections) {
      console.error('Error fetching agency connections:', error);
      return [];
    }
    
    return connections
      .filter((conn): conn is typeof conn & { organizations: { name: string; logo_url: string | null }; agency_id: string } => !!conn.organizations && !!conn.agency_id)
      .map(conn => ({
        id: conn.id,
        name: conn.organizations.name,
        logoUrl: conn.organizations.logo_url || undefined,
        orgId: conn.agency_id
      }));
  }
});

/**
 * Get members for all connections (both agency and client members)
 * Returns a map of connectionId -> array of members
 * Only fetches when context.variant === 'agency' (clients can't assign assignees)
 */
export const getMembersForAllConnections = cache(async (
  context: EnhancedModeContext,
  connectionIds: string[]
): Promise<Record<string, Array<{
  id: string
  firstName: string
  lastName: string
  email: string
  avatarUrl?: string
  jobTitle?: string
  orgId?: string
  orgName?: string
  orgType?: 'agency' | 'client'
}>>> => {
  if (connectionIds.length === 0) {
    return {};
  }

  const supabase = await createClient();

  // Fetch all connections with their agency_id and client_id
  // For agencies: get connections where agency_id = orgId
  // For clients: get connections where client_id = orgId
  // Exclude disconnected connections (frozen/read-only)
  const { data: connections, error: connectionsError } = await supabase
    .from('connections')
    .select('id, agency_id, client_id')
    .in('id', connectionIds)
    .eq(context.variant === 'agency' ? 'agency_id' : 'client_id', context.orgId)
    .neq('connection_status', 'disconnected');

  if (connectionsError || !connections) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Error fetching connections:', connectionsError);
    }
    return {};
  }

  // Get unique organization IDs (both agency and client)
  const orgIds = new Set<string>();
  const connectionOrgMap: Record<string, { agencyId: string; clientId: string }> = {};
  
  connections.forEach(conn => {
    if (conn.agency_id) orgIds.add(conn.agency_id);
    if (conn.client_id) orgIds.add(conn.client_id);
    connectionOrgMap[conn.id] = {
      agencyId: conn.agency_id,
      clientId: conn.client_id
    };
  });

  const orgIdsArray = Array.from(orgIds);
  if (orgIdsArray.length === 0) {
    return {};
  }

  // Fetch organization details
  const { data: orgsData, error: orgsError } = await supabase
    .from('organizations')
    .select('id, name, type')
    .in('id', orgIdsArray);

  if (orgsError) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Error fetching organizations:', orgsError);
    }
    return {};
  }

  const orgMap: Record<string, { name: string; type: 'agency' | 'client' }> = {};
  (orgsData || []).forEach(org => {
    if (org.type === 'agency' || org.type === 'client') {
      orgMap[org.id] = {
        name: org.name || 'Unknown',
        type: org.type as 'agency' | 'client'
      };
    }
  });

  // Fetch all memberships for these organizations
  const { data: memberships, error: membershipsError } = await supabase
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
    .in('org_id', orgIdsArray)
    .is('profiles.deleted_at', null)
    .order('profiles(first_name)');

  if (membershipsError) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Error fetching memberships:', membershipsError);
    }
    return {};
  }

  // Build members map by org_id
  const membersByOrg: Record<string, Array<{
    id: string
    firstName: string
    lastName: string
    email: string
    avatarUrl?: string
    jobTitle?: string
    orgId: string
    orgName: string
    orgType: 'agency' | 'client'
  }>> = {};

  (memberships || []).forEach(membership => {
    const profile = Array.isArray(membership.profiles) ? membership.profiles[0] : membership.profiles;
    const orgInfo = orgMap[membership.org_id];
    
    if (!orgInfo) return;

    if (!membersByOrg[membership.org_id]) {
      membersByOrg[membership.org_id] = [];
    }

    membersByOrg[membership.org_id].push({
      id: profile.id,
      firstName: profile.first_name || '',
      lastName: profile.last_name || '',
      email: profile.email || '',
      avatarUrl: profile.avatar_url || undefined,
      jobTitle: profile.job_title || undefined,
      orgId: membership.org_id,
      orgName: orgInfo.name,
      orgType: orgInfo.type
    });
  });

  // Build result map: connectionId -> combined members (agency + client)
  const result: Record<string, Array<{
    id: string
    firstName: string
    lastName: string
    email: string
    avatarUrl?: string
    jobTitle?: string
    orgId?: string
    orgName?: string
    orgType?: 'agency' | 'client'
  }>> = {};

  Object.entries(connectionOrgMap).forEach(([connectionId, orgs]) => {
    const combinedMembers: Array<{
      id: string
      firstName: string
      lastName: string
      email: string
      avatarUrl?: string
      jobTitle?: string
      orgId?: string
      orgName?: string
      orgType?: 'agency' | 'client'
    }> = [];

    // Add agency members
    if (orgs.agencyId && membersByOrg[orgs.agencyId]) {
      combinedMembers.push(...membersByOrg[orgs.agencyId]);
    }

    // Add client members (deduplicate by id)
    if (orgs.clientId && membersByOrg[orgs.clientId]) {
      const existingIds = new Set(combinedMembers.map(m => m.id));
      membersByOrg[orgs.clientId].forEach(member => {
        if (!existingIds.has(member.id)) {
          combinedMembers.push(member);
        }
      });
    }

    result[connectionId] = combinedMembers;
  });

  return result;
});

/**
 * Get global count of tasks assigned to any member of the client organization
 * Only works for client context (returns 0 for agency context)
 */
/**
 * Get global count of tasks assigned to client organization members
 * @param context - The enhanced mode context
 * @param connectionIds - Optional array of connection IDs to use instead of fetching connections
 *                        This avoids redundant queries when connection IDs are already available
 */
export const getGlobalAssignedTasksCount = cache(async (
  context: EnhancedModeContext,
  connectionIds?: string[]
): Promise<number> => {
  // Only works for client context
  if (context.variant !== 'client') {
    return 0;
  }

  // Validate context before proceeding
  if (!context || !context.orgId || !context.userId) {
    return 0;
  }

  const supabase = await createClient();
  
  // Use provided connection IDs or fetch them
  let finalConnectionIds: string[] = connectionIds || [];
  
  if (finalConnectionIds.length === 0) {
    // Get all connection IDs where this client is the client-side org
    // Exclude disconnected connections (frozen/read-only)
    const { data: connections, error: connectionQueryError } = await supabase
      .from('connections')
      .select('id')
      .eq('client_id', context.orgId)
      .neq('connection_status', 'disconnected');

    if (connectionQueryError || !connections) {
      console.error('Error fetching connections for assigned tasks count:', connectionQueryError);
      return 0;
    }

    finalConnectionIds = connections.map(c => c.id);
  }

  if (finalConnectionIds.length === 0) {
    return 0;
  }

  // Get all user IDs that belong to the client organization
  const { data: memberships, error: membershipsError } = await supabase
    .from('memberships')
    .select('user_id')
    .eq('org_id', context.orgId);

  if (membershipsError || !memberships) {
    console.error('Error fetching client organization members:', membershipsError);
    return 0;
  }

  const clientOrgUserIds = memberships.map(m => m.user_id);

  if (clientOrgUserIds.length === 0) {
    return 0;
  }

  // Count tasks where:
  // - connection_id is in the connection IDs
  // - assignee_user_id is in the set of client organization user IDs
  // - completed_at IS NULL (task is active/not completed)
  // - deleted_at IS NULL (task is not deleted)
  const { count, error: countError } = await supabase
    .from('tasks')
    .select('id', { count: 'exact', head: true })
    .in('connection_id', finalConnectionIds)
    .in('assignee_user_id', clientOrgUserIds)
    .is('completed_at', null)
    .is('deleted_at', null);

  if (countError) {
    console.error('Error fetching assigned tasks count:', countError);
    return 0;
  }

  return count || 0;
});

