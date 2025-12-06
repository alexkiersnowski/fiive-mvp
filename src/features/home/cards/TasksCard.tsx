import { getAgencyMembersForActiveOrg } from '@/features/tasks/server';
import { getCommentsForTasks } from '@/features/connections/server';
import { getTasksPreview } from '@/features/home/server';
import type { StatsCardProps } from '../types';
import TasksCardClient from './TasksCardClient';

interface TasksCardProps extends StatsCardProps {
  allowedConnectionIds?: string[] | null;
}

export default async function TasksCard({ snapshot, context, allowedConnectionIds }: TasksCardProps) {
  // Fetch top 5 tasks (4 displayed + 1 prefetched for instant replacement on delete)
  // using lightweight preview query
  const tasks = await getTasksPreview(context, 5);

  const taskIds = tasks.map(t => t.id);
  
  const [agencyMembers, initialComments] = await Promise.all([
    getAgencyMembersForActiveOrg(context),
    // Prefetch comments for instant modal visibility (including the 5th task)
    taskIds.length > 0 ? getCommentsForTasks(taskIds) : Promise.resolve({}),
  ]);

  // Split into displayed (first 4) and prefetched (5th)
  const displayedTasks = tasks.slice(0, 4);
  const prefetchedNextTask = tasks[4] || null;

  return (
    <TasksCardClient
      tasks={displayedTasks}
      prefetchedNextTask={prefetchedNextTask}
      snapshot={snapshot}
      context={context}
      agencyMembers={agencyMembers}
      initialComments={initialComments}
      allowedConnectionIds={allowedConnectionIds}
    />
  );
}
