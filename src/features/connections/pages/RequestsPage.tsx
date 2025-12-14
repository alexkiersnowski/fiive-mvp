import { Card } from '@/components/ui/card';
import { getRequestsForConnection, getRequestsCountsForConnection, getAgencyMembersForConnection, getProjectOptionsForConnection, getCommentsForRequests } from '../server';
import RequestsPageClient from './RequestsPageClient';
import { PAGE_SIZE } from '../constants';

interface RequestsPageProps {
  connectionId: string
}

// Server component that fetches data from Supabase
export async function RequestsPage({ connectionId }: RequestsPageProps) {
  // Fetch ALL requests upfront for connection tables (no pagination)
  // No pagination needed - connection tables are small enough to load everything
  const [requestsData, statusCounts, agencyMembers, projects] = await Promise.all([
    getRequestsForConnection(connectionId, { limit: 10000, offset: 0 }), // High safety limit (10k max, way more than any connection needs)
    getRequestsCountsForConnection(connectionId),
    getAgencyMembersForConnection(connectionId),
    getProjectOptionsForConnection(connectionId)
  ]);

  // Fetch comments for initial requests in parallel (after requests are fetched)
  const requestIds = requestsData.requests.map(r => r.id);
  const initialComments = requestIds.length > 0
    ? await getCommentsForRequests(requestIds)
    : {};

  // getProjectOptionsForConnection already returns { id, name } format, no transformation needed

  return (
    <Card className="w-full gap-0 h-full">
      <RequestsPageClient 
        connectionId={connectionId} 
        initialRequests={requestsData.requests} 
        initialTotalCount={requestsData.totalCount}
        initialNewCount={requestsData.newCount}
        initialStatusCounts={statusCounts}
        agencyMembers={agencyMembers}
        projects={projects}
        initialComments={initialComments}
      />
    </Card>
  );
}
