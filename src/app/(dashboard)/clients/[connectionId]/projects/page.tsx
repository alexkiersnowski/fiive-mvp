import { ProjectsPage } from '@/features/connections/pages/ProjectsPage';

interface ClientProjectsPageProps {
  params: Promise<{ connectionId: string }>
  searchParams: Promise<{ sort?: string }>
}

export default async function ClientProjectsPage({ params, searchParams }: ClientProjectsPageProps) {
  const { connectionId } = await params;
  const resolvedSearchParams = await searchParams;
  return <ProjectsPage connectionId={connectionId} searchParams={resolvedSearchParams} />;
}

