import { getActiveContext } from '@/lib/mode/getActiveContext';
import { validateOrgContext } from '@/lib/mode/validateContext';
import { notFound } from 'next/navigation';
import { getAgencyMembersForActiveOrg, getClientMembersForActiveOrg, getConnectionsForGlobalView, getMembersForAllConnections, getTasksCounts, searchClientsWithTasks } from '@/features/tasks/server';
import { createClient } from '@/lib/supabase/server';
import { getCommentsForTasks } from '@/features/connections/server';
import { getAllowedConnectionIds } from '@/lib/paywall/checkWorkspaceAccess';
import { getConnectionIdsForContext } from '@/features/requests/server';
import type { TasksSnapshot, Task } from '@/features/tasks/types';
import { TasksContent } from './TasksContent';

interface TasksPageProps {
  searchParams: Promise<{
    search?: string;
    assigned?: string;
  }>;
}

export default async function TasksPage({ searchParams }: TasksPageProps) {
  const pageStartTime = performance.now();
  
  const context = await getActiveContext();
  
  // CRITICAL: Validate context
  if (!context || !validateOrgContext(context)) {
    notFound();
  }

  const resolvedSearchParams = await searchParams;
  const assignedToMe = resolvedSearchParams.assigned === 'me';

  // Fetch connection IDs once and share across queries to avoid redundant fetches
  const _connectionIds = await getConnectionIdsForContext(context);

  // Prefetch allowed connection IDs for paywall checks (only for agencies)
  const billingStatus = context.organization.billing_status || 'free';
  const allowedConnectionIdsPromise = context.variant === 'agency'
    ? getAllowedConnectionIds(context.orgId, billingStatus)
    : Promise.resolve(null);

  const snapshotStartTime = performance.now();
  
  const hasActiveSearch = (resolvedSearchParams.search || '').trim().length > 0;
  
  // For accordion mode: fetch counts and metadata only (no tasks)
  // For search mode: fetch tasks via searchClientsWithTasks
  const supabase = await createClient();
  
  const [
    snapshot,
    allowedConnectionIds,
    countsData
  ] = await Promise.all([
    hasActiveSearch
      ? // Search mode: use searchClientsWithTasks (returns SearchResults)
        (async () => {
          const searchResults = await searchClientsWithTasks(context, resolvedSearchParams.search || '', {
            assignedToUserId: assignedToMe && context.variant === 'agency' ? context.user?.id : undefined,
            assignedToUserIds: assignedToMe && context.variant === 'client' ? (() => {
              // Get client team member IDs for filtering
              // This will be done in TasksContent, but we need to handle it here for initial search
              // For now, return empty array - TasksContent will handle it properly
              return undefined;
            })() : undefined,
          });
          
          // Convert SearchResults to TasksSnapshot format for compatibility
          const allTasks: Task[] = searchResults.clients.flatMap(client => client.tasks);
          
          // Fetch all connections metadata
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
          
          const { data: allConnectionsMetadataData } = await allConnectionsMetadataQuery;
          
          const allConnectionsMetadata = new Map<string, { name: string; logoUrl?: string }>();
          if (allConnectionsMetadataData) {
            for (const conn of allConnectionsMetadataData as Array<{
              id: string;
              client_id?: string;
              agency_id?: string;
              organizations: { id: string; name: string | null; logo_url: string | null } | Array<{ id: string; name: string | null; logo_url: string | null }>;
            }>) {
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
          
          return {
            tasks: allTasks,
            total: allTasks.length,
            unfilteredTotalCount: allTasks.length,
            cursor: null,
            hasNextPage: false,
            loadedConnectionIds: [],
            allConnectionsMetadata,
            statusCounts: {
              to_do: allTasks.filter(t => t.status === 'to_do').length,
              in_progress: allTasks.filter(t => t.status === 'in_progress').length,
              on_hold: allTasks.filter(t => t.status === 'on_hold').length,
              done: allTasks.filter(t => t.status === 'done').length,
            },
            totalClientCount: searchResults.totalClients,
          } as {
            tasks: Array<{
              id: string;
              connectionId: string;
              status: string;
            }>;
            total: number;
            unfilteredTotalCount: number;
            cursor: null;
            hasNextPage: boolean;
            loadedConnectionIds: string[];
            allConnectionsMetadata: Map<string, { name: string; logoUrl?: string }>;
            statusCounts: Record<string, number>;
            totalClientCount: number;
          };
        })()
      : // Accordion mode: create empty snapshot with metadata
        (async () => {
          // Fetch all connections metadata for client headers
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
          
          const { data: allConnectionsMetadataData } = await allConnectionsMetadataQuery;
          
          const allConnectionsMetadata = new Map<string, { name: string; logoUrl?: string }>();
          if (allConnectionsMetadataData) {
            for (const conn of allConnectionsMetadataData as Array<{
              id: string;
              client_id?: string;
              agency_id?: string;
              organizations: { id: string; name: string | null; logo_url: string | null } | Array<{ id: string; name: string | null; logo_url: string | null }>;
            }>) {
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
          
          return {
            tasks: [] as Task[],
            total: 0,
            unfilteredTotalCount: 0,
            cursor: null,
            hasNextPage: false,
            loadedConnectionIds: [] as string[],
            allConnectionsMetadata,
            statusCounts: {},
            clientCounts: {},
            totalClientCount: allConnectionsMetadata.size,
          } as {
            tasks: Task[];
            total: number;
            unfilteredTotalCount: number;
            cursor: null;
            hasNextPage: boolean;
            loadedConnectionIds: string[];
            allConnectionsMetadata: Map<string, { name: string; logoUrl?: string }>;
            statusCounts: Record<string, number>;
            clientCounts: Record<string, number>;
            totalClientCount: number;
          };
        })(),
    allowedConnectionIdsPromise,
    // Fetch counts for accordion headers
    // Note: For client view with assignedToMe, clientTeamMemberIds will be handled in TasksContent
    // We fetch counts without the filter here, TasksContent will refetch with filter if needed
    getTasksCounts(context, {
      assignedToUserId: assignedToMe && context.variant === 'agency' ? context.user?.id : undefined,
      assignedToUserIds: undefined, // Will be handled in TasksContent for client view
    }),
  ]);
  console.log(`[Performance] getTasksSnapshot: ${(performance.now() - snapshotStartTime).toFixed(2)}ms`);

  // Merge counts into snapshot for accordion mode
  if (!hasActiveSearch && countsData) {
    (snapshot as { statusCounts?: Record<string, number>; clientCounts?: Record<string, number> }).statusCounts = countsData.statusCounts;
    (snapshot as { statusCounts?: Record<string, number>; clientCounts?: Record<string, number> }).clientCounts = countsData.clientCounts;
  }

  // Fetch all independent data in parallel
  const taskIds = Array.isArray(snapshot.tasks) ? snapshot.tasks.map((t: { id: string }) => t.id).filter((id): id is string => typeof id === 'string') : [];
  const uniqueConnectionIds = Array.isArray(snapshot.tasks) ? [...new Set(snapshot.tasks.map((t: { connectionId: string }) => t.connectionId).filter((id): id is string => typeof id === 'string'))] : [];
  const [
    initialComments,
    agencyMembers,
    clientMembers,
    connections,
    membersByConnection
  ] = await Promise.all([
    // Comments prefetched for instant modal visibility (only in search mode)
    taskIds.length > 0 ? getCommentsForTasks(taskIds) : Promise.resolve({}),
    // Agency members (only for agencies)
    getAgencyMembersForActiveOrg(context),
    // Client members (only for clients) - for filtering "Assigned to my team"
    getClientMembersForActiveOrg(context),
    // Connections for global task creation
    getConnectionsForGlobalView(context),
    // Members for all connections (both agency and client members per connection)
    uniqueConnectionIds.length > 0 ? getMembersForAllConnections(context, uniqueConnectionIds as string[]) : Promise.resolve({})
  ]);

  console.log(`[Performance] TasksPage TOTAL: ${(performance.now() - pageStartTime).toFixed(2)}ms`);

  return (
    <TasksContent 
      snapshot={snapshot as unknown as TasksSnapshot} 
      context={context}
      initialSearchValue={resolvedSearchParams.search || ''}
      initialComments={initialComments}
      agencyMembers={agencyMembers}
      clientMembers={clientMembers}
      connections={connections}
      membersByConnection={membersByConnection}
      allowedConnectionIds={allowedConnectionIds}
    />
  );
}
