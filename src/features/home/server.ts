import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import type { EnhancedModeContext } from '@/lib/mode/getActiveContext';
import type { Request } from '@/features/requests/types';
import type { Task } from '@/features/tasks/types';
import * as formatters from '@/features/connections/formatters';

export type HealthCounts = {
  healthy: number;
  atRisk: number;
  critical: number;
  unassigned: number;
};

/**
 * Get count of tasks due within the next 7 days for the current organization
 * @param context - The enhanced mode context
 * @param connectionIds - Optional array of connection IDs to use instead of fetching connections
 *                        This avoids redundant queries when connection IDs are already available
 */
export const getTasksDueSoonCount = cache(async (
  context: EnhancedModeContext,
  connectionIds?: string[]
): Promise<number> => {
  const supabase = await createClient();
  
  // Use provided connection IDs or fetch them
  let finalConnectionIds: string[] = connectionIds || [];
  
  if (finalConnectionIds.length === 0) {
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
      console.error('Error fetching connections for tasks due soon count:', connectionQueryError);
      return 0;
    }

    finalConnectionIds = connections.map(c => c.id);
  }

  if (finalConnectionIds.length === 0) {
    // No connections, return 0
    return 0;
  }

  // Calculate 7 days from now
  const today = new Date();
  const sevenDaysFromNow = new Date();
  sevenDaysFromNow.setDate(today.getDate() + 7);
  
  // Format dates for PostgreSQL (YYYY-MM-DD)
  const todayStr = today.toISOString().split('T')[0];
  const sevenDaysStr = sevenDaysFromNow.toISOString().split('T')[0];

  // Query tasks that are due within the next 7 days
  // Rules: status != 'done', due_date IS NOT NULL, due_date >= today, due_date <= today + 7 days
  const { count, error } = await supabase
    .from('tasks')
    .select('id', { count: 'exact', head: true })
    .in('connection_id', finalConnectionIds)
    .is('deleted_at', null)
    .neq('status', 'done')
    .not('due_date', 'is', null)
    .gte('due_date', todayStr)
    .lte('due_date', sevenDaysStr);

  if (error) {
    console.error('Error fetching tasks due soon count:', error);
    return 0;
  }

  return count || 0;
});

/**
 * Get live project counts for all agency connections (client context only)
 * Returns a map of connectionId -> projectCount
 */
export const getLiveProjectCountsForAgencies = cache(async (
  context: EnhancedModeContext,
  connectionIds: string[]
): Promise<Record<string, number>> => {
  // Only works for client context
  if (context.variant !== 'client') {
    return {};
  }

  if (connectionIds.length === 0) {
    return {};
  }

  const supabase = await createClient();

  // Use COUNT queries per connection instead of fetching all projects
  // Live projects = status IN ['planned', 'active', 'on_hold']
  const counts: Record<string, number> = {};
  
  // Initialize all connection IDs to 0
  connectionIds.forEach(id => {
    counts[id] = 0;
  });

  // Fetch counts in parallel for each connection
  const countPromises = connectionIds.map(async (connectionId) => {
    const { count, error } = await supabase
      .from('projects')
      .select('id', { count: 'exact', head: true })
      .eq('connection_id', connectionId)
      .in('status', ['planned', 'active', 'on_hold'])
      .is('deleted_at', null);

    if (error) {
      console.error(`Error fetching project count for connection ${connectionId}:`, error);
      return { connectionId, count: 0 };
    }

    return { connectionId, count: count || 0 };
  });

  const results = await Promise.all(countPromises);
  results.forEach(({ connectionId, count }) => {
    counts[connectionId] = count;
  });

  return counts;
});

/**
 * Lightweight preview of requests for home page
 * Only fetches minimal fields needed for preview display
 */
export const getRequestsPreview = cache(async (
  context: EnhancedModeContext,
  limit: number = 5
): Promise<Request[]> => {
  const supabase = await createClient();

  // Get connection IDs
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

  const { data: connections, error: connectionError } = await connectionQuery;

  if (connectionError || !connections || connections.length === 0) {
    return [];
  }

  const connectionIds = connections.map(c => c.id);

  // Fetch request data with necessary fields for modal display
  const { data: requestsData, error: requestsError } = await supabase
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
    .order('created_at', { ascending: false })
    .limit(limit);

  if (requestsError || !requestsData || requestsData.length === 0) {
    return [];
  }

  // Extract unique user IDs and connection IDs for parallel lookups
  const userIds = new Set<string>();
  const uniqueConnectionIds = [...new Set(requestsData.map(r => r.connection_id))];
  requestsData.forEach(request => {
    if (request.created_by_user_id) userIds.add(request.created_by_user_id);
    if (request.assignee_user_id) userIds.add(request.assignee_user_id);
  });

  // Fetch data in parallel - need profiles, connections, orgs, and memberships for org info
  const userIdArray = Array.from(userIds);
  const orgIdsForLookup = [
    ...new Set(
      requestsData.flatMap(r => {
        const conn = Array.isArray(r.connections) ? r.connections[0] : r.connections;
        return conn ? [conn.client_id, conn.agency_id] : [];
      })
    )
  ];
  if (requestsData.some(r => r.created_by_org_id)) {
    requestsData.forEach(r => {
      if (r.created_by_org_id) orgIdsForLookup.push(r.created_by_org_id);
    });
  }

  const [profilesResult, connectionsResult, orgsResult, membershipsResult, orgTypesResult] = await Promise.all([
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
    supabase
      .from('organizations')
      .select('id, name, logo_url')
      .in('id', orgIdsForLookup),
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
    requestsData.some(r => r.created_by_org_id)
      ? supabase
          .from('organizations')
          .select('id, type')
          .in('id', [...new Set(requestsData.map(r => r.created_by_org_id).filter(Boolean))])
      : Promise.resolve({ data: null, error: null })
  ]);

  // Build maps
  const profilesMap: Record<string, { first_name: string; last_name: string; email: string; avatar_url?: string; job_title?: string }> = {};
  if (!profilesResult.error && profilesResult.data) {
    profilesResult.data.forEach(profile => {
      profilesMap[profile.id] = profile;
    });
  }

  const connectionsMap: Record<string, { clientId: string; agencyId: string }> = {};
  if (!connectionsResult.error && connectionsResult.data) {
    connectionsResult.data.forEach(conn => {
      connectionsMap[conn.id] = { clientId: conn.client_id, agencyId: conn.agency_id };
    });
  }

  const orgMap: Record<string, { name: string; logoUrl?: string }> = {};
  if (!orgsResult.error && orgsResult.data) {
    orgsResult.data.forEach(org => {
      orgMap[org.id] = {
        name: org.name || 'Unknown',
        logoUrl: org.logo_url || undefined
      };
    });
  }

  // Build user org map for submittedBy org info
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

  // Build org type map
  const orgTypeMap: Record<string, 'agency' | 'client'> = {};
  if (!orgTypesResult.error && orgTypesResult.data) {
    orgTypesResult.data.forEach(org => {
      if (org.type === 'agency' || org.type === 'client') {
        orgTypeMap[org.id] = org.type as 'agency' | 'client';
      }
    });
  }

  // Transform to Request format
  return requestsData.map(request => {
    const connection = Array.isArray(request.connections) ? request.connections[0] : request.connections;
    if (!connection) {
      throw new Error('Invalid connection');
    }

    const connectionInfo = connectionsMap[request.connection_id];
    if (!connectionInfo) {
      throw new Error('Connection not found in map');
    }

    const clientOrg = orgMap[connectionInfo.clientId];
    const agencyOrg = orgMap[connectionInfo.agencyId];
    const submittedByProfile = request.created_by_user_id ? profilesMap[request.created_by_user_id] || null : null;
    const assigneeProfile = request.assignee_user_id ? profilesMap[request.assignee_user_id] || null : null;

    // Extract project data
    const requestWithJoins = request as typeof request & { projects?: { id: string; name: string } | Array<{ id: string; name: string }> };
    const projectData = request.project_id && requestWithJoins.projects
      ? (Array.isArray(requestWithJoins.projects) ? requestWithJoins.projects[0] : requestWithJoins.projects)
      : null;
    
    let project = null;
    if (request.project_id) {
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
      project,
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
    } as Request;
  });
});

/**
 * Lightweight preview of tasks for home page
 * Only fetches minimal fields needed for preview display
 */
export const getTasksPreview = cache(async (
  context: EnhancedModeContext,
  limit: number = 5
): Promise<Task[]> => {
  const supabase = await createClient();

  // Get connection IDs
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

  const { data: connections, error: connectionError } = await connectionQuery;

  if (connectionError || !connections || connections.length === 0) {
    return [];
  }

  const connectionIds = connections.map(c => c.id);

  // Fetch task data with necessary fields for modal display
  const { data: tasksData, error: tasksError } = await supabase
    .from('tasks')
    .select(`
      id,
      title,
      description,
      status,
      due_date,
      connection_id,
      project_id,
      assignee_user_id,
      created_by_user_id,
      created_at,
      updated_at,
      completed_at,
      client_visible,
      source_request_id,
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
    .neq('status', 'done')
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(limit);

  if (tasksError || !tasksData || tasksData.length === 0) {
    return [];
  }

  // Extract unique user IDs and connection IDs for parallel lookups
  const userIds = new Set<string>();
  const uniqueConnectionIds = [...new Set(tasksData.map(t => t.connection_id))];
  tasksData.forEach(task => {
    if (task.created_by_user_id) userIds.add(task.created_by_user_id);
    if (task.assignee_user_id) userIds.add(task.assignee_user_id);
  });

  // Fetch data in parallel - need profiles, connections, orgs, and memberships for org info
  const userIdArray = Array.from(userIds);
  const orgIdsForLookup = [
    ...new Set(
      tasksData.flatMap(t => {
        const conn = Array.isArray(t.connections) ? t.connections[0] : t.connections;
        return conn ? [conn.client_id, conn.agency_id] : [];
      })
    )
  ];

  const [profilesResult, connectionsResult, orgsResult, membershipsResult] = await Promise.all([
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
    supabase
      .from('organizations')
      .select('id, name, logo_url')
      .in('id', orgIdsForLookup),
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
      : Promise.resolve({ data: null, error: null })
  ]);

  // Build maps
  const profilesMap: Record<string, { first_name: string; last_name: string; email: string; avatar_url?: string; job_title?: string }> = {};
  if (!profilesResult.error && profilesResult.data) {
    profilesResult.data.forEach(profile => {
      profilesMap[profile.id] = profile;
    });
  }

  const connectionsMap: Record<string, { clientId: string; agencyId: string }> = {};
  if (!connectionsResult.error && connectionsResult.data) {
    connectionsResult.data.forEach(conn => {
      connectionsMap[conn.id] = { clientId: conn.client_id, agencyId: conn.agency_id };
    });
  }

  const orgMap: Record<string, { name: string; logoUrl?: string }> = {};
  if (!orgsResult.error && orgsResult.data) {
    orgsResult.data.forEach(org => {
      orgMap[org.id] = {
        name: org.name || 'Unknown',
        logoUrl: org.logo_url || undefined
      };
    });
  }

  // Build user org map for submittedBy org info
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

  // Transform to Task format
  return tasksData.map(task => {
    const connection = Array.isArray(task.connections) ? task.connections[0] : task.connections;
    if (!connection) {
      throw new Error('Invalid connection');
    }

    const connectionInfo = connectionsMap[task.connection_id];
    if (!connectionInfo) {
      throw new Error('Connection not found in map');
    }

    const clientOrg = orgMap[connectionInfo.clientId];
    const agencyOrg = orgMap[connectionInfo.agencyId];
    const submittedByProfile = task.created_by_user_id ? profilesMap[task.created_by_user_id] || null : null;
    const assigneeProfile = task.assignee_user_id ? profilesMap[task.assignee_user_id] || null : null;

    // Extract project data
    const taskWithJoins = task as typeof task & { projects?: { id: string; name: string } | Array<{ id: string; name: string }> };
    const projectData = task.project_id && taskWithJoins.projects
      ? (Array.isArray(taskWithJoins.projects) ? taskWithJoins.projects[0] : taskWithJoins.projects)
      : null;
    
    const project = task.project_id && projectData
      ? { id: projectData.id, name: projectData.name }
      : null;

    // Get createdByOrgId from userOrgMap
    const createdByOrgId = task.created_by_user_id ? userOrgMap[task.created_by_user_id]?.orgId : undefined;

    return {
      id: task.id,
      connectionId: task.connection_id,
      title: task.title,
      description: task.description || '',
      status: task.status as 'to_do' | 'in_progress' | 'on_hold' | 'done',
      project,
      submittedBy: formatters.buildSubmittedBy(
        task.created_by_user_id,
        submittedByProfile,
        userOrgMap
      ),
      assignee: formatters.buildAssignee(task.assignee_user_id, assigneeProfile),
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
      createdAt: formatters.formatRequestDate(task.created_at),
      createdAtRaw: task.created_at,
      updatedAt: task.updated_at ? formatters.formatRequestDate(task.updated_at) : undefined,
      dueDate: task.due_date ? formatters.formatRequestDate(task.due_date) : undefined,
      dueDateRaw: task.due_date,
      completedAt: task.completed_at ? formatters.formatRequestDate(task.completed_at) : undefined,
      completedAtRaw: task.completed_at,
      createdByUserId: task.created_by_user_id,
      createdByOrgId,
      createdByOrgType: formatters.getOrgType(createdByOrgId || null, {}), // Org type not critical for preview
      clientVisible: Boolean(task.client_visible),
      clientVisibilityLocked: false, // Will be calculated if needed
      sourceRequestId: task.source_request_id ?? null,
      linkedRequest: null // Not needed for preview - can be fetched on-demand if modal needs it
    } as Task;
  });
});

/**
 * Unified query that fetches all home page data in a single database call.
 * 
 * Performance optimization: This function fetches connections once and returns
 * connectionIds to be reused by count functions, eliminating redundant queries.
 * 
 * All count functions (getGlobalNewRequestsCount, getGlobalInReviewRequestsCount,
 * getTasksDueSoonCount, getGlobalAssignedTasksCount) accept an optional connectionIds
 * parameter to avoid fetching connections again.
 * 
 * @param context - The enhanced mode context
 * @returns Unified home data including connectionIds for reuse in count queries
 */
export const getUnifiedHomeData = cache(async (context: EnhancedModeContext) => {
  const supabase = await createClient();
  
  if (context.variant !== 'agency') {
    // For clients, fetch top 5 agencies for preview and use COUNT for total
    const [topConnectionsResult, totalCountResult] = await Promise.all([
      // Fetch only top 5 connections for preview
      supabase
        .from('connections')
        .select(`
          id,
          agency_id,
          organizations!connections_agency_id_fkey (
            id,
            name,
            logo_url,
            industry
          )
        `)
        .eq('client_id', context.orgId)
        .neq('connection_status', 'disconnected')
        .order('created_at', { ascending: false })
        .limit(5),
      // Get total count separately
      supabase
        .from('connections')
        .select('id', { count: 'exact', head: true })
        .eq('client_id', context.orgId)
        .neq('connection_status', 'disconnected')
    ]);

    if (topConnectionsResult.error) {
      console.error('Error fetching agency connections:', topConnectionsResult.error);
      return {
        connectionCount: 0,
        connectionIds: [],
        agencyPreviews: [],
        healthCounts: { healthy: 0, atRisk: 0, critical: 0, unassigned: 0 },
        contractsEndingCount: 0
      };
    }

    const topConnections = topConnectionsResult.data || [];
    const connectionCount = totalCountResult.count || 0;

    // Get connection IDs for project count lookup (only top 5)
    const topConnectionIds = topConnections.map(c => c.id);
    
    // Fetch live project counts for top 5 connections
    const projectCounts = await getLiveProjectCountsForAgencies(context, topConnectionIds);

    // Map agencies to preview format with actual project counts
    const agencyPreviews = topConnections.map(conn => {
      const org = conn.organizations as { name?: string; logo_url?: string; industry?: string } | null;
      return {
        id: conn.agency_id,
        connectionId: conn.id,
        name: org?.name || 'Unknown Agency',
        logo: org?.logo_url,
        projectCount: projectCounts[conn.id] || 0
      };
    });

    // Get all connection IDs for count queries (needed for other functions)
    const { data: allConnections } = await supabase
      .from('connections')
      .select('id')
      .eq('client_id', context.orgId)
      .neq('connection_status', 'disconnected');

    const allConnectionIds = (allConnections || []).map(c => c.id);

    return {
      connectionCount,
      connectionIds: allConnectionIds, // Return all connection IDs for count queries
      agencyPreviews,
      healthCounts: { healthy: 0, atRisk: 0, critical: 0, unassigned: 0 },
      contractsEndingCount: 0
    };
  }

  // For agencies, use COUNT queries instead of fetching all connections
  // Calculate date range for contracts ending
  const today = new Date();
  const ninetyDaysFromNow = new Date();
  ninetyDaysFromNow.setDate(today.getDate() + 90);
  const todayStr = today.toISOString().split('T')[0];
  const ninetyDaysStr = ninetyDaysFromNow.toISOString().split('T')[0];

  // Fetch counts and connection IDs in parallel
  const [
    connectionCountResult,
    healthyCountResult,
    atRiskCountResult,
    criticalCountResult,
    unassignedCountResult,
    contractsEndingResult,
    connectionIdsResult
  ] = await Promise.all([
    // Total connection count
    supabase
      .from('connections')
      .select('id', { count: 'exact', head: true })
      .eq('agency_id', context.orgId)
      .neq('connection_status', 'disconnected'),
    // Healthy count
    supabase
      .from('connections')
      .select('id', { count: 'exact', head: true })
      .eq('agency_id', context.orgId)
      .neq('connection_status', 'disconnected')
      .eq('health_status', 'healthy'),
    // At risk count
    supabase
      .from('connections')
      .select('id', { count: 'exact', head: true })
      .eq('agency_id', context.orgId)
      .neq('connection_status', 'disconnected')
      .eq('health_status', 'at_risk'),
    // Critical count
    supabase
      .from('connections')
      .select('id', { count: 'exact', head: true })
      .eq('agency_id', context.orgId)
      .neq('connection_status', 'disconnected')
      .eq('health_status', 'critical'),
    // Unassigned count (default)
    supabase
      .from('connections')
      .select('id', { count: 'exact', head: true })
      .eq('agency_id', context.orgId)
      .neq('connection_status', 'disconnected')
      .in('health_status', ['unassigned', null]),
    // Contracts ending count
    supabase
      .from('connections')
      .select('id', { count: 'exact', head: true })
      .eq('agency_id', context.orgId)
      .neq('connection_status', 'disconnected')
      .not('contract_end_on', 'is', null)
      .gte('contract_end_on', todayStr)
      .lte('contract_end_on', ninetyDaysStr),
    // Connection IDs (minimal fetch - only id field)
    supabase
      .from('connections')
      .select('id')
      .eq('agency_id', context.orgId)
      .neq('connection_status', 'disconnected')
  ]);

  if (connectionIdsResult.error) {
    console.error('Error fetching connection IDs:', connectionIdsResult.error);
    return {
      connectionCount: 0,
      connectionIds: [],
      agencyPreviews: [],
      healthCounts: { healthy: 0, atRisk: 0, critical: 0, unassigned: 0 },
      contractsEndingCount: 0
    };
  }

  const connectionIds = (connectionIdsResult.data || []).map(c => c.id);
  const connectionCount = connectionCountResult.count || 0;
  const healthCounts = {
    healthy: healthyCountResult.count || 0,
    atRisk: atRiskCountResult.count || 0,
    critical: criticalCountResult.count || 0,
    unassigned: unassignedCountResult.count || 0
  };
  const contractsEndingCount = contractsEndingResult.count || 0;

  return {
    connectionCount,
    connectionIds, // Return connection IDs to avoid redundant queries
    agencyPreviews: [], // Agencies don't show agency previews
    healthCounts,
    contractsEndingCount
  };
});

/**
 * Get all home page counts in optimized parallel queries.
 * This combines 4 separate count queries into parallel execution with shared connection IDs.
 * 
 * @param context - The enhanced mode context
 * @param connectionIds - Array of connection IDs to use (should be provided from getUnifiedHomeData)
 * @returns Object containing all counts needed for the home page
 */
export const getHomeCountsAggregated = cache(async (
  context: EnhancedModeContext,
  connectionIds: string[]
): Promise<{
  newRequestsCount: number;
  inReviewRequestsCount: number;
  tasksDueSoonCount: number;
  assignedTasksCount: number;
}> => {
  const supabase = await createClient();

  if (connectionIds.length === 0) {
    return {
      newRequestsCount: 0,
      inReviewRequestsCount: 0,
      tasksDueSoonCount: 0,
      assignedTasksCount: 0,
    };
  }

  // Calculate date ranges for tasks due soon
  const today = new Date();
  const sevenDaysFromNow = new Date();
  sevenDaysFromNow.setDate(today.getDate() + 7);
  const todayStr = today.toISOString().split('T')[0];
  const sevenDaysStr = sevenDaysFromNow.toISOString().split('T')[0];

  // Prepare all count queries in parallel
  // For client context, we also need to fetch memberships for assigned tasks
  // Note: Supabase query builders are thenable and work with Promise.all
  const baseQueries = [
    // New requests count
    supabase
      .from('requests')
      .select('id', { count: 'exact', head: true })
      .in('connection_id', connectionIds)
      .eq('status', 'new')
      .is('deleted_at', null),
    
    // In-review requests count
    supabase
      .from('requests')
      .select('id', { count: 'exact', head: true })
      .in('connection_id', connectionIds)
      .eq('status', 'in_review')
      .is('deleted_at', null),
    
    // Tasks due soon count
    supabase
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .in('connection_id', connectionIds)
      .is('deleted_at', null)
      .neq('status', 'done')
      .not('due_date', 'is', null)
      .gte('due_date', todayStr)
      .lte('due_date', sevenDaysStr),
  ];

  // For client context, add memberships query to get user IDs for assigned tasks
  const queries = context.variant === 'client'
    ? [
        ...baseQueries,
        supabase
          .from('memberships')
          .select('user_id')
          .eq('org_id', context.orgId),
      ]
    : baseQueries;

  // Execute all queries in parallel
  const results = await Promise.all(queries);

  // Extract counts
  const [
    newRequestsResult,
    inReviewRequestsResult,
    tasksDueSoonResult,
    ...restResults
  ] = results;

  const newRequestsCount = newRequestsResult.error ? 0 : (newRequestsResult.count || 0);
  const inReviewRequestsCount = inReviewRequestsResult.error ? 0 : (inReviewRequestsResult.count || 0);
  const tasksDueSoonCount = tasksDueSoonResult.error ? 0 : (tasksDueSoonResult.count || 0);

  // Handle assigned tasks count (client context only)
  let assignedTasksCount = 0;
  if (context.variant === 'client' && restResults.length > 0) {
    const membershipsResult = restResults[0] as { data: Array<{ user_id: string }> | null; error: { message: string } | null };
    if (!membershipsResult.error && membershipsResult.data) {
      const clientOrgUserIds = membershipsResult.data.map((m) => m.user_id);
      
      if (clientOrgUserIds.length > 0) {
        const assignedTasksResult = await supabase
          .from('tasks')
          .select('id', { count: 'exact', head: true })
          .in('connection_id', connectionIds)
          .in('assignee_user_id', clientOrgUserIds)
          .is('completed_at', null)
          .is('deleted_at', null);
        
        assignedTasksCount = assignedTasksResult.error ? 0 : (assignedTasksResult.count || 0);
      }
    }
  }

  // Log errors if any
  if (newRequestsResult.error) {
    console.error('Error fetching new requests count:', newRequestsResult.error);
  }
  if (inReviewRequestsResult.error) {
    console.error('Error fetching in-review requests count:', inReviewRequestsResult.error);
  }
  if (tasksDueSoonResult.error) {
    console.error('Error fetching tasks due soon count:', tasksDueSoonResult.error);
  }

  return {
    newRequestsCount,
    inReviewRequestsCount,
    tasksDueSoonCount,
    assignedTasksCount,
  };
});

export const getOrganizationResources = cache(async (
  context: EnhancedModeContext
): Promise<Array<{
  id: string;
  url: string;
  label: string | null;
  createdAt: string | null;
}>> => {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('organization_resources')
    .select('id, url, label, created_at')
    .eq('organization_id', context.orgId)
    .order('created_at', { ascending: false });

  if (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Failed to load organization resources:', error);
    }
    return [];
  }

  const rows = (data ?? []) as Array<{
    id: string;
    url: string;
    label: string | null;
    created_at: string | null;
  }>;

  return rows.map((item) => ({
    id: item.id,
    url: item.url,
    label: item.label,
    createdAt: item.created_at,
  }));
});
