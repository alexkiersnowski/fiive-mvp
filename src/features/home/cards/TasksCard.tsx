import { getTasksSnapshot, getAgencyMembersForActiveOrg } from '@/features/tasks/server';
import { getCommentsForTasks } from '@/features/connections/server';
import type { StatsCardProps } from '../types';
import TasksCardClient from './TasksCardClient';

export default async function TasksCard({ snapshot, context }: StatsCardProps) {
  // Fetch top 5 tasks (4 displayed + 1 prefetched for instant replacement on delete)
  // with default sort (due_date), agency members, and comments in parallel
  const tasksSnapshot = await getTasksSnapshot(context, {
    limit: 5,
    sort: 'due_date',
  });

  const taskIds = tasksSnapshot.tasks.map(t => t.id);
  
  const [agencyMembers, initialComments] = await Promise.all([
    getAgencyMembersForActiveOrg(context),
    // Prefetch comments for instant modal visibility (including the 5th task)
    taskIds.length > 0 ? getCommentsForTasks(taskIds) : Promise.resolve({}),
  ]);

  // Split into displayed (first 4) and prefetched (5th)
  const displayedTasks = tasksSnapshot.tasks.slice(0, 4);
  const prefetchedNextTask = tasksSnapshot.tasks[4] || null;

  return (
    <TasksCardClient
      tasks={displayedTasks}
      prefetchedNextTask={prefetchedNextTask}
      snapshot={snapshot}
      context={context}
      agencyMembers={agencyMembers}
      initialComments={initialComments}
    />
  );
}
