import { ProjectsPage } from '@/features/connections/pages/ProjectsPage';

interface AgencyProjectsPageProps {
  params: Promise<{ connectionId: string }>
}

export default async function AgencyProjectsPage({ params }: AgencyProjectsPageProps) {
  const { connectionId } = await params;
  return <ProjectsPage connectionId={connectionId} />;
}

