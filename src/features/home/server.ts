import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import type { EnhancedModeContext } from '@/lib/mode/getActiveContext';

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

  // Count live projects for each connection
  // Live projects = status IN ['planned', 'active', 'on_hold']
  const { data: projects, error } = await supabase
    .from('projects')
    .select('connection_id')
    .in('connection_id', connectionIds)
    .in('status', ['planned', 'active', 'on_hold'])
    .is('deleted_at', null);

  if (error) {
    console.error('Error fetching live project counts:', error);
    return {};
  }

  // Build a map of connectionId -> count
  const counts: Record<string, number> = {};
  
  // Initialize all connection IDs to 0
  connectionIds.forEach(id => {
    counts[id] = 0;
  });

  // Count projects per connection
  (projects || []).forEach(project => {
    if (project.connection_id) {
      counts[project.connection_id] = (counts[project.connection_id] || 0) + 1;
    }
  });

  return counts;
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
    // For clients, we need to fetch agencies instead
    // Exclude disconnected connections (frozen/read-only)
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
      .eq('client_id', context.orgId)
      .neq('connection_status', 'disconnected')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching agency connections:', error);
      return {
        connectionCount: 0,
        connectionIds: [], // Return empty array to maintain consistent return type
        agencyPreviews: [],
        healthCounts: { healthy: 0, atRisk: 0, critical: 0, unassigned: 0 },
        contractsEndingCount: 0
      };
    }

    // Get connection IDs for project count lookup
    const connectionIds = (connections || []).map(c => c.id);
    
    // Fetch live project counts for all connections
    const projectCounts = await getLiveProjectCountsForAgencies(context, connectionIds);

    // Map agencies to preview format with actual project counts
    const agencyPreviews = (connections || []).slice(0, 5).map(conn => {
      const org = conn.organizations as { name?: string; logo_url?: string; industry?: string } | null;
      return {
        id: conn.agency_id,
        connectionId: conn.id,
        name: org?.name || 'Unknown Agency',
        logo: org?.logo_url,
        projectCount: projectCounts[conn.id] || 0
      };
    });

    return {
      connectionCount: connections?.length || 0,
      connectionIds, // Return connection IDs to avoid redundant queries
      agencyPreviews,
      healthCounts: { healthy: 0, atRisk: 0, critical: 0, unassigned: 0 },
      contractsEndingCount: 0
    };
  }

  // For agencies, fetch all connection data in one query
  // Note: We fetch all connections for accurate health counts and contract ending counts
  // For large datasets, consider implementing a separate aggregation query
  // Exclude disconnected connections (frozen/read-only)
  const { data: connections, error } = await supabase
    .from('connections')
    .select(`
      id,
      connection_status,
      health_status,
      contract_end_on,
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

  if (error) {
    console.error('Error fetching connections for home data:', error);
    return {
      connectionCount: 0,
      connectionIds: [], // Return empty array to maintain consistent return type
      agencyPreviews: [],
      healthCounts: { healthy: 0, atRisk: 0, critical: 0, unassigned: 0 },
      contractsEndingCount: 0
    };
  }

  // Process health counts
  const healthCounts = {
    healthy: 0,
    atRisk: 0,
    critical: 0,
    unassigned: 0
  };

  // Process contracts ending count
  const today = new Date();
  const ninetyDaysFromNow = new Date();
  ninetyDaysFromNow.setDate(today.getDate() + 90);
  const todayStr = today.toISOString().split('T')[0];
  const ninetyDaysStr = ninetyDaysFromNow.toISOString().split('T')[0];

  let contractsEndingCount = 0;

  (connections || []).forEach(conn => {
    // Count health status
    switch (conn.health_status) {
      case 'healthy':
        healthCounts.healthy++;
        break;
      case 'at_risk':
        healthCounts.atRisk++;
        break;
      case 'critical':
        healthCounts.critical++;
        break;
      case 'unassigned':
      default:
        healthCounts.unassigned++;
        break;
    }

    // Count contracts ending soon
    if (conn.contract_end_on && 
        conn.contract_end_on >= todayStr && 
        conn.contract_end_on <= ninetyDaysStr) {
      contractsEndingCount++;
    }
  });

  // Extract connection IDs for reuse in count queries
  const connectionIds = (connections || []).map(c => c.id);

  return {
    connectionCount: connections?.length || 0,
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
  const queries: Promise<any>[] = [
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

  // For client context, add assigned tasks count query
  if (context.variant === 'client') {
    // First get client org user IDs, then count assigned tasks
    queries.push(
      supabase
        .from('memberships')
        .select('user_id')
        .eq('org_id', context.orgId)
    );
  }

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
    const membershipsResult = restResults[0];
    if (!membershipsResult.error && membershipsResult.data) {
      const clientOrgUserIds = membershipsResult.data.map((m: { user_id: string }) => m.user_id);
      
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
