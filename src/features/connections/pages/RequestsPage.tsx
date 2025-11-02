import { Card } from '@/components/ui/card';
import { ErrorBoundary } from '@/components/ui/error-boundary';
import { getRequestsForConnection, getAgencyMembersForConnection } from '../server';
import RequestsPageClient from './RequestsPageClient';
import { PAGE_SIZE } from '../requests/constants';

interface RequestsPageProps {
  connectionId: string
}

// Server component that fetches data from Supabase
export async function RequestsPage({ connectionId }: RequestsPageProps) {
  const [requestsData, agencyMembers] = await Promise.all([
    getRequestsForConnection(connectionId, { limit: PAGE_SIZE, offset: 0 }),
    getAgencyMembersForConnection(connectionId)
  ]);

  return (
    <Card className="w-full gap-0 h-full">
      <ErrorBoundary>
        <RequestsPageClient 
          connectionId={connectionId} 
          initialRequests={requestsData.requests} 
          initialTotalCount={requestsData.totalCount}
          agencyMembers={agencyMembers} 
        />
      </ErrorBoundary>
    </Card>
  );
}
