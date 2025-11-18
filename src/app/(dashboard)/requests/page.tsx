import { getActiveContext } from '@/lib/mode/getActiveContext';
import { validateOrgContext } from '@/lib/mode/validateContext';
import { notFound } from 'next/navigation';
import { getRequestsSnapshot, getAgencyMembersForActiveOrg, getConnectionsForGlobalView, getGlobalNewRequestsCount } from '@/features/requests/server';
import { getCommentsForRequests } from '@/features/connections/server';
import { RequestsContent } from './RequestsContent';

interface RequestsPageProps {
  searchParams: Promise<{
    search?: string;
    sort?: string;
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

  const snapshotStartTime = performance.now();
  const snapshot = await getRequestsSnapshot(context, {
    search: resolvedSearchParams.search || '',
    limit: 50,
    sort: resolvedSearchParams.sort || 'created',
    assignedToUserId: assignedToMe && context.variant === 'agency' ? context.user?.id : undefined,
    createdByUserId: assignedToMe && context.variant === 'client' ? context.user?.id : undefined
  });
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
    // Global count of new requests
    getGlobalNewRequestsCount(context)
  ]);

  console.log(`[Performance] RequestsPage TOTAL: ${(performance.now() - pageStartTime).toFixed(2)}ms`);

  return (
    <RequestsContent 
      snapshot={snapshot} 
      context={context}
      initialSearchValue={resolvedSearchParams.search || ''}
      initialSortValue={resolvedSearchParams.sort || 'created'}
      initialComments={initialComments}
      agencyMembers={agencyMembers}
      connections={connections}
      newRequestsCount={newRequestsCount}
    />
  );
}
