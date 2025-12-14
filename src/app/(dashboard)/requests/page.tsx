import { getActiveContext } from '@/lib/mode/getActiveContext';
import { validateOrgContext } from '@/lib/mode/validateContext';
import { notFound } from 'next/navigation';
import { getRequestsSnapshot, getAgencyMembersForActiveOrg, getConnectionsForGlobalView, getGlobalNewRequestsCount, getConnectionIdsForContext, getRequestsCounts } from '@/features/requests/server';
import { createClient } from '@/lib/supabase/server';
import type { Request } from '@/features/requests/types';
import { getCommentsForRequests } from '@/features/connections/server';
import { getAllowedConnectionIds } from '@/lib/paywall/checkWorkspaceAccess';
import { RequestsContent } from './RequestsContent';

interface RequestsPageProps {
  searchParams: Promise<{
    search?: string;
    assigned?: string;
  }>;
}

export default async function RequestsPage({ searchParams }: RequestsPageProps) {
  const pageStartTime = performance.now();
  
  const context = await getActiveContext();
  
  // CRITICAL: Validate context
  if (!context || !validateOrgContext(context)) {
    notFound();
  }

  const resolvedSearchParams = await searchParams;
  const assignedToMe = resolvedSearchParams.assigned === 'me';

  // Fetch connection IDs once and share across queries to avoid redundant fetches
  const connectionIds = await getConnectionIdsForContext(context);

  // Prefetch allowed connection IDs for paywall checks (only for agencies)
  const billingStatus = context.organization.billing_status || 'free';
  const allowedConnectionIdsPromise = context.variant === 'agency'
    ? getAllowedConnectionIds(context.orgId, billingStatus)
    : Promise.resolve(null);

  const snapshotStartTime = performance.now();
  
  const hasActiveSearch = (resolvedSearchParams.search || '').trim().length > 0;
  
  // For accordion mode: fetch counts and metadata only (no requests)
  // For search mode: fetch requests via getRequestsSnapshot
  const supabase = await createClient();
  
  const [
    snapshot,
    allowedConnectionIds,
    countsData
  ] = await Promise.all([
    hasActiveSearch
      ? // Search mode: use global snapshot (still fetches requests for search)
        getRequestsSnapshot(context, {
          search: resolvedSearchParams.search || '',
          limit: 20,
          assignedToUserId: assignedToMe && context.variant === 'agency' ? context.user?.id : undefined,
          createdByUserId: assignedToMe && context.variant === 'client' ? context.user?.id : undefined,
        })
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
            requests: [],
            total: 0,
            unfilteredTotalCount: 0,
            offset: 0,
            hasMore: false,
            allConnectionsMetadata,
            statusCounts: {},
            clientCounts: {},
          } as any;
        })(),
    allowedConnectionIdsPromise,
    // Fetch counts for accordion headers
    getRequestsCounts(context, {
      assignedToUserId: assignedToMe && context.variant === 'agency' ? context.user?.id : undefined,
      createdByUserId: assignedToMe && context.variant === 'client' ? context.user?.id : undefined,
    }),
  ]);
  console.log(`[Performance] getRequestsSnapshot: ${(performance.now() - snapshotStartTime).toFixed(2)}ms`);

  // Merge counts into snapshot for accordion mode
  if (!hasActiveSearch && countsData) {
    (snapshot as any).statusCounts = countsData.statusCounts
    ;(snapshot as any).clientCounts = countsData.clientCounts
  }

  // Fetch all independent data in parallel
  const requestIds = snapshot.requests.map((r: Request) => r.id);
  const [
    initialComments,
    agencyMembers,
    connections,
    newRequestsCount
  ] = await Promise.all([
    // Comments prefetched for instant modal visibility (only in search mode)
    requestIds.length > 0 ? getCommentsForRequests(requestIds) : Promise.resolve({}),
    // Agency members (only for agencies)
    getAgencyMembersForActiveOrg(context),
    // Connections for global request creation
    getConnectionsForGlobalView(context),
    // Global count of new requests (share connection IDs to avoid redundant query)
    getGlobalNewRequestsCount(context, connectionIds)
  ]);

  console.log(`[Performance] RequestsPage TOTAL: ${(performance.now() - pageStartTime).toFixed(2)}ms`);

  return (
    <RequestsContent 
      snapshot={snapshot} 
      context={context}
      initialSearchValue={resolvedSearchParams.search || ''}
      initialComments={initialComments}
      agencyMembers={agencyMembers}
      connections={connections}
      newRequestsCount={newRequestsCount}
      allowedConnectionIds={allowedConnectionIds}
    />
  );
}
