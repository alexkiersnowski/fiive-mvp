import { Card } from '@/components/ui/card';
import { getRequestsForConnection, getAgencyMembersForConnection } from '../server';
import RequestsPageClient from './RequestsPageClient';

interface RequestsPageProps {
  connectionId: string
}

// Server component that fetches data from Supabase
export async function RequestsPage({ connectionId }: RequestsPageProps) {
  const [requests, agencyMembers] = await Promise.all([
    getRequestsForConnection(connectionId),
    getAgencyMembersForConnection(connectionId)
  ]);

  return (
    <Card className="w-full gap-0">
      <RequestsPageClient connectionId={connectionId} initialRequests={requests} agencyMembers={agencyMembers} />
    </Card>
  );
}
