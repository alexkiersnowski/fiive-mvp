import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import type { EnhancedModeContext } from '@/lib/mode/getActiveContext';

export type HealthCounts = {
  healthy: number;
  atRisk: number;
  critical: number;
  unassigned: number;
};

export const getHealthCounts = cache(async (context: EnhancedModeContext): Promise<HealthCounts> => {
  const supabase = await createClient();
  
  if (context.variant !== 'agency') {
    // Clients don't have health counts - they see agencies
    return { healthy: 0, atRisk: 0, critical: 0, unassigned: 0 };
  }
  
  const { data: connections, error } = await supabase
    .from('connections')
    .select('health_status')
    .eq('agency_id', context.orgId);
  
  if (error) {
    console.error('Error fetching health counts:', error);
    return { healthy: 0, atRisk: 0, critical: 0, unassigned: 0 };
  }
  
  const counts: HealthCounts = {
    healthy: 0,
    atRisk: 0,
    critical: 0,
    unassigned: 0
  };
  
  connections?.forEach(conn => {
    switch (conn.health_status) {
      case 'healthy':
        counts.healthy++;
        break;
      case 'at_risk':
        counts.atRisk++;
        break;
      case 'critical':
        counts.critical++;
        break;
      case 'unassigned':
      default:
        counts.unassigned++;
        break;
    }
  });
  
  return counts;
});

export const getContractsEndingCount = cache(async (context: EnhancedModeContext): Promise<number> => {
  const supabase = await createClient();
  
  if (context.variant !== 'agency') {
    // Clients don't have contract ending counts - they see agencies
    return 0;
  }
  
  // Calculate 90 days from now
  const today = new Date();
  const ninetyDaysFromNow = new Date();
  ninetyDaysFromNow.setDate(today.getDate() + 90);
  
  // Format dates for PostgreSQL (YYYY-MM-DD)
  const todayStr = today.toISOString().split('T')[0];
  const ninetyDaysStr = ninetyDaysFromNow.toISOString().split('T')[0];
  
  const { data: connections, error } = await supabase
    .from('connections')
    .select('contract_end_on')
    .eq('agency_id', context.orgId)
    .not('contract_end_on', 'is', null)
    .gte('contract_end_on', todayStr)
    .lte('contract_end_on', ninetyDaysStr);
  
  if (error) {
    console.error('Error fetching contracts ending count:', error);
    return 0;
  }
  
  return connections?.length || 0;
});

export const getTasksDueSoonCount = cache(async (context: EnhancedModeContext): Promise<number> => {
  const supabase = await createClient();
  
  // Get all connection IDs that belong to this organization
  // Agency: connections where agency_id = orgId
  // Client: connections where client_id = orgId
  const connectionQuery = context.variant === 'agency'
    ? supabase
        .from('connections')
        .select('id')
        .eq('agency_id', context.orgId)
    : supabase
        .from('connections')
        .select('id')
        .eq('client_id', context.orgId);

  const { data: connections, error: connectionQueryError } = await connectionQuery;

  if (connectionQueryError || !connections) {
    console.error('Error fetching connections for tasks due soon count:', connectionQueryError);
    return 0;
  }

  const connectionIds = connections.map(c => c.id);

  if (connectionIds.length === 0) {
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
    .in('connection_id', connectionIds)
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

// Unified query that fetches all home page data in a single database call
export const getUnifiedHomeData = cache(async (context: EnhancedModeContext) => {
  const supabase = await createClient();
  
  if (context.variant !== 'agency') {
    // For clients, we need to fetch agencies instead
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
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching agency connections:', error);
      return {
        connectionCount: 0,
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
      agencyPreviews,
      healthCounts: { healthy: 0, atRisk: 0, critical: 0, unassigned: 0 },
      contractsEndingCount: 0
    };
  }

  // For agencies, fetch all connection data in one query
  // Note: We fetch all connections for accurate health counts and contract ending counts
  // For large datasets, consider implementing a separate aggregation query
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
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching connections for home data:', error);
    return {
      connectionCount: 0,
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

  return {
    connectionCount: connections?.length || 0,
    agencyPreviews: [], // Agencies don't show agency previews
    healthCounts,
    contractsEndingCount
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
