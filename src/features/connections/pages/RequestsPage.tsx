import { Card } from '@/components/ui/card';
import { ErrorBoundary } from '@/components/ui/error-boundary';
import { getRequestsForConnection, getAgencyMembersForConnection, getProjectOptionsForConnection, getCommentsForRequests } from '../server';
import RequestsPageClient from './RequestsPageClient';
import { PAGE_SIZE } from '../constants';

interface RequestsPageProps {
  connectionId: string
}

// Server component that fetches data from Supabase
export async function RequestsPage({ connectionId }: RequestsPageProps) {
  const [requestsData, agencyMembers, projects] = await Promise.all([
    getRequestsForConnection(connectionId, { limit: PAGE_SIZE, offset: 0 }),
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
      <ErrorBoundary>
        <RequestsPageClient 
          connectionId={connectionId} 
          initialRequests={requestsData.requests} 
          initialTotalCount={requestsData.totalCount}
          initialNewCount={requestsData.newCount}
          agencyMembers={agencyMembers}
          projects={projects}
          initialComments={initialComments}
        />
      </ErrorBoundary>
    </Card>
  );
}
