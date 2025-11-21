import { getRequestsSnapshot, getAgencyMembersForActiveOrg } from '@/features/requests/server';
import { getCommentsForRequests } from '@/features/connections/server';
import type { StatsCardProps } from '../types';
import RequestsCardClient from './RequestsCardClient';

export default async function RequestsCard({ snapshot, context }: StatsCardProps) {
  // Fetch top 5 requests (4 displayed + 1 prefetched for instant replacement on delete)
  // with default sort (newest first), agency members, and comments in parallel
  const requestsSnapshot = await getRequestsSnapshot(context, {
    limit: 5,
    sort: 'created',
  });

  const requestIds = requestsSnapshot.requests.map(r => r.id);
  
  const [agencyMembers, initialComments] = await Promise.all([
    getAgencyMembersForActiveOrg(context),
    // Prefetch comments for instant modal visibility (including the 5th request)
    requestIds.length > 0 ? getCommentsForRequests(requestIds) : Promise.resolve({}),
  ]);

  // Split into displayed (first 4) and prefetched (5th)
  const displayedRequests = requestsSnapshot.requests.slice(0, 4);
  const prefetchedNextRequest = requestsSnapshot.requests[4] || null;

  return (
    <RequestsCardClient
      requests={displayedRequests}
      prefetchedNextRequest={prefetchedNextRequest}
      snapshot={snapshot}
      context={context}
      agencyMembers={agencyMembers}
      initialComments={initialComments}
    />
  );
}
