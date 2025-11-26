import { RequestsPage } from '@/features/connections/pages/RequestsPage';

interface AgencyRequestsPageProps {
  params: Promise<{ connectionId: string }>
}

export default async function AgencyRequestsPage({ params }: AgencyRequestsPageProps) {
  const { connectionId } = await params;
  return <RequestsPage connectionId={connectionId} />;
}

