import { redirect } from 'next/navigation';

interface AgencyWorkspacePageProps {
  params: {
    connectionId: string;
  };
}

export default async function AgencyWorkspacePage({ params }: AgencyWorkspacePageProps) {
  const resolvedParams = await params;
  const connectionId = resolvedParams.connectionId;
  
  // Redirect to overview tab by default
  redirect(`/agencies/${connectionId}/overview`);
}
