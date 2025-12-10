import { getActiveContext } from '@/lib/mode/getActiveContext';
import { validateOrgContext } from '@/lib/mode/validateContext';
import { notFound } from 'next/navigation';
import { getRequestsSnapshot, getAgencyMembersForActiveOrg, getConnectionsForGlobalView, getGlobalNewRequestsCount, getConnectionIdsForContext } from '@/features/requests/server';
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
  const [snapshot, allowedConnectionIds] = await Promise.all([
    getRequestsSnapshot(context, {
      search: resolvedSearchParams.search || '',
      limit: 20, // Number of connections to load per page (not requests)
      assignedToUserId: assignedToMe && context.variant === 'agency' ? context.user?.id : undefined,
      createdByUserId: assignedToMe && context.variant === 'client' ? context.user?.id : undefined,
      connectionIds, // Share connection IDs to avoid redundant query (but we'll still paginate)
      loadedConnectionIds: [] // Start with empty array for initial load
    }),
    allowedConnectionIdsPromise
  ]);
  console.log(`[Performance] getRequestsSnapshot: ${(performance.now() - snapshotStartTime).toFixed(2)}ms`);

  // Fetch all independent data in parallel after snapshot (snapshot needed for request IDs)
  const requestIds = snapshot.requests.map(r => r.id);
  const [
    initialComments,
    agencyMembers,
    connections,
    newRequestsCount
  ] = await Promise.all([
    // Comments prefetched for instant modal visibility
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
