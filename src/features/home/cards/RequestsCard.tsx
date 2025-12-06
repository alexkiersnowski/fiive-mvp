import { getAgencyMembersForActiveOrg } from '@/features/requests/server';
import { getCommentsForRequests } from '@/features/connections/server';
import { getRequestsPreview } from '@/features/home/server';
import type { StatsCardProps } from '../types';
import RequestsCardClient from './RequestsCardClient';

interface RequestsCardProps extends StatsCardProps {
  allowedConnectionIds?: string[] | null;
}

export default async function RequestsCard({ snapshot, context, allowedConnectionIds }: RequestsCardProps) {
  // Fetch top 5 requests (4 displayed + 1 prefetched for instant replacement on delete)
  // using lightweight preview query
  const requests = await getRequestsPreview(context, 5);

  const requestIds = requests.map(r => r.id);
  
  const [agencyMembers, initialComments] = await Promise.all([
    getAgencyMembersForActiveOrg(context),
    // Prefetch comments for instant modal visibility (including the 5th request)
    requestIds.length > 0 ? getCommentsForRequests(requestIds) : Promise.resolve({}),
  ]);

  // Split into displayed (first 4) and prefetched (5th)
  const displayedRequests = requests.slice(0, 4);
  const prefetchedNextRequest = requests[4] || null;

  return (
    <RequestsCardClient
      requests={displayedRequests}
      prefetchedNextRequest={prefetchedNextRequest}
      snapshot={snapshot}
      context={context}
      agencyMembers={agencyMembers}
      initialComments={initialComments}
      allowedConnectionIds={allowedConnectionIds}
    />
  );
}
