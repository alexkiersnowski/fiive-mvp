import { ProjectsPage } from '@/features/connections/pages/ProjectsPage';

interface AgencyProjectsPageProps {
  params: Promise<{ connectionId: string }>
  searchParams: Promise<{ sort?: string }>
}

export default async function AgencyProjectsPage({ params, searchParams }: AgencyProjectsPageProps) {
  const { connectionId } = await params;
  const resolvedSearchParams = await searchParams;
  return <ProjectsPage connectionId={connectionId} searchParams={resolvedSearchParams} />;
}

