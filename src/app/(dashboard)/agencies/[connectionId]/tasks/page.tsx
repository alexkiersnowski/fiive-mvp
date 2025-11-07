import { TasksPage } from '@/features/connections/pages/TasksPage';

interface AgencyTasksPageProps {
  params: Promise<{ connectionId: string }>
}

export default async function AgencyTasksPage({ params }: AgencyTasksPageProps) {
  const { connectionId } = await params;
  return <TasksPage connectionId={connectionId} />;
}

