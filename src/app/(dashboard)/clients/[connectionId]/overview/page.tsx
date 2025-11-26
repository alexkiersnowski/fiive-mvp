import { OverviewPage } from '@/features/connections/pages/OverviewPage';
import RequestsCard from '@/features/connections/cards/RequestsCard';
import TasksCard from '@/features/connections/cards/TasksCard';
import ProjectsCard from '@/features/connections/cards/ProjectsCard';
import ResourcesCard from '@/features/connections/cards/ResourcesCard';
import { getProjectsForConnection } from '@/features/connections/server';

interface ClientOverviewPageProps {
  params: Promise<{ connectionId: string }>;
}

export default async function ClientOverviewPage({ params }: ClientOverviewPageProps) {
  const { connectionId } = await params;

  // Fetch projects once and share with all cards (optimization: single fetch instead of 3)
  // Snapshot is already loaded in ConnectionLayoutWrapper and available via ConnectionContext
  // Cards will naturally parallelize when rendered as siblings
  const projectsResult = await getProjectsForConnection(connectionId, { limit: 1000, offset: 0 });

  // Extract project options to share with cards
  const projectOptions = projectsResult.projects.map((project) => ({
    id: project.id,
    name: project.title || 'Untitled project',
  }));

  // Render cards in parallel (React server components parallelize automatically)
  // ResourcesCard gets snapshot from ConnectionContext (via OverviewPage client component)
  return (
    <OverviewPage
      requestsCard={<RequestsCard connectionId={connectionId} projects={projectOptions} />}
      tasksCard={<TasksCard connectionId={connectionId} projects={projectOptions} />}
      projectsCard={<ProjectsCard connectionId={connectionId} projects={projectsResult.projects} />}
      resourcesCard={<ResourcesCard connectionId={connectionId} />}
    />
  );
}

