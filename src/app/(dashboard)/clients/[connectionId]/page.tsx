import { redirect } from 'next/navigation';

interface ClientWorkspacePageProps {
  params: {
    connectionId: string;
  };
}

export default async function ClientWorkspacePage({ params }: ClientWorkspacePageProps) {
  const resolvedParams = await params;
  const connectionId = resolvedParams.connectionId;
  
  // Redirect to overview tab by default
  redirect(`/clients/${connectionId}/overview`);
}
