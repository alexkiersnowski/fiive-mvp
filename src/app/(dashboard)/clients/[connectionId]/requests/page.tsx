import { RequestsPage } from '@/features/connections/pages/RequestsPage';

interface ClientRequestsPageProps {
  params: Promise<{ connectionId: string }>
}

export default async function ClientRequestsPage({ params }: ClientRequestsPageProps) {
  const { connectionId } = await params;
  return <RequestsPage connectionId={connectionId} />;
}

