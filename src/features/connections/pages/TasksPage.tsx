import { Card } from '@/components/ui/card';
import { ErrorBoundary } from '@/components/ui/error-boundary';
import { getTasksForConnection, getConnectionMembers, getProjectsForConnection } from '../server';
import TasksPageClient from './TasksPageClient';
import { PAGE_SIZE } from '../constants';

interface TasksPageProps {
  connectionId: string
}

// Server component that fetches data from Supabase
export async function TasksPage({ connectionId }: TasksPageProps) {
  const [tasksData, memberData, projectsData] = await Promise.all([
    getTasksForConnection(connectionId, { limit: PAGE_SIZE, offset: 0 }),
    getConnectionMembers(connectionId),
    getProjectsForConnection(connectionId, { limit: 1000, offset: 0 })
  ]);

  const assignableMembers = [...memberData.agencyMembers];
  for (const member of memberData.clientMembers) {
    if (!assignableMembers.some(existing => existing.id === member.id)) {
      assignableMembers.push(member);
    }
  }

  // Transform projects to the format expected by TaskDetailContent
  const projects = projectsData.projects.map(p => ({ id: p.id, name: p.title }));

  return (
    <Card className="w-full gap-0 h-full">
      <ErrorBoundary>
        <TasksPageClient 
          connectionId={connectionId} 
          initialTasks={tasksData.tasks} 
          initialTotalCount={tasksData.totalCount}
          agencyMembers={assignableMembers}
          projects={projects}
        />
      </ErrorBoundary>
    </Card>
  );
}
