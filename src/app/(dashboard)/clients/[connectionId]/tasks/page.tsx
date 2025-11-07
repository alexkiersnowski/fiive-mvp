import { TasksPage } from '@/features/connections/pages/TasksPage';

interface ClientTasksPageProps {
  params: Promise<{ connectionId: string }>
}

export default async function ClientTasksPage({ params }: ClientTasksPageProps) {
  const { connectionId } = await params;
  return <TasksPage connectionId={connectionId} />;
}

