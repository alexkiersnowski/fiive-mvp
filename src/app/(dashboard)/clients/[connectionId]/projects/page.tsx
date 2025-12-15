import { ProjectsPage } from '@/features/connections/pages/ProjectsPage';

interface ClientProjectsPageProps {
  params: Promise<{ connectionId: string }>
}

export default async function ClientProjectsPage({ params }: ClientProjectsPageProps) {
  const { connectionId } = await params;
  return <ProjectsPage connectionId={connectionId} />;
}

