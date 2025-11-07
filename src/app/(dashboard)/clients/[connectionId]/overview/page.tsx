import { OverviewPage } from '@/features/connections/pages/OverviewPage';
import RequestsCard from '@/features/connections/cards/RequestsCard';
import TasksCard from '@/features/connections/cards/TasksCard';
import ProjectsCard from '@/features/connections/cards/ProjectsCard';

interface ClientOverviewPageProps {
  params: Promise<{ connectionId: string }>;
}

export default async function ClientOverviewPage({ params }: ClientOverviewPageProps) {
  const { connectionId } = await params;

  return (
    <OverviewPage
      requestsCard={<RequestsCard connectionId={connectionId} />}
      tasksCard={<TasksCard connectionId={connectionId} />}
      projectsCard={<ProjectsCard connectionId={connectionId} />}
    />
  );
}

