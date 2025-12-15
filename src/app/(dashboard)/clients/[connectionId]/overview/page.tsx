import { OverviewPage } from '@/features/connections/pages/OverviewPage';
import RequestsCard from '@/features/connections/cards/RequestsCard';
import TasksCard from '@/features/connections/cards/TasksCard';
import ProjectsCard from '@/features/connections/cards/ProjectsCard';
import ResourcesCard from '@/features/connections/cards/ResourcesCard';
import { getProjectOptionsForConnection } from '@/features/connections/server';

interface ClientOverviewPageProps {
  params: Promise<{ connectionId: string }>;
}

export default async function ClientOverviewPage({ params }: ClientOverviewPageProps) {
  const { connectionId } = await params;

  // Fetch lightweight project options for RequestsCard/TasksCard dropdowns
  // ProjectsCard will fetch its own 5 full projects independently
  const projectOptions = await getProjectOptionsForConnection(connectionId);

  // Render cards in parallel (React server components parallelize automatically)
  // ResourcesCard gets snapshot from ConnectionContext (via OverviewPage client component)
  return (
    <OverviewPage
      requestsCard={<RequestsCard connectionId={connectionId} projects={projectOptions} />}
      tasksCard={<TasksCard connectionId={connectionId} projects={projectOptions} />}
      projectsCard={<ProjectsCard connectionId={connectionId} />}
      resourcesCard={<ResourcesCard connectionId={connectionId} />}
    />
  );
}

