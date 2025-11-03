import { Card } from '@/components/ui/card';
import { ErrorBoundary } from '@/components/ui/error-boundary';
import { getRequestsForConnection, getAgencyMembersForConnection, getProjectsForConnection } from '../server';
import RequestsPageClient from './RequestsPageClient';
import { PAGE_SIZE } from '../constants';

interface RequestsPageProps {
  connectionId: string
}

// Server component that fetches data from Supabase
export async function RequestsPage({ connectionId }: RequestsPageProps) {
  const [requestsData, agencyMembers, projectsData] = await Promise.all([
    getRequestsForConnection(connectionId, { limit: PAGE_SIZE, offset: 0 }),
    getAgencyMembersForConnection(connectionId),
    getProjectsForConnection(connectionId, { limit: 1000, offset: 0 })
  ]);

  // Transform projects to the format expected by RequestDetailContent
  const projects = projectsData.projects.map(p => ({ id: p.id, name: p.title }));

  return (
    <Card className="w-full gap-0 h-full">
      <ErrorBoundary>
        <RequestsPageClient 
          connectionId={connectionId} 
          initialRequests={requestsData.requests} 
          initialTotalCount={requestsData.totalCount}
          agencyMembers={agencyMembers}
          projects={projects}
        />
      </ErrorBoundary>
    </Card>
  );
}
