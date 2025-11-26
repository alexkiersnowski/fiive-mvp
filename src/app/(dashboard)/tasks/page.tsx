import { getActiveContext } from '@/lib/mode/getActiveContext';
import { validateOrgContext } from '@/lib/mode/validateContext';
import { notFound } from 'next/navigation';
import { getTasksSnapshot, getAgencyMembersForActiveOrg, getClientMembersForActiveOrg, getConnectionsForGlobalView, getMembersForAllConnections } from '@/features/tasks/server';
import { getCommentsForTasks } from '@/features/connections/server';
import { TasksContent } from './TasksContent';

interface TasksPageProps {
  searchParams: Promise<{
    search?: string;
    sort?: string;
    assigned?: string;
  }>;
}

export default async function TasksPage({ searchParams }: TasksPageProps) {
  const pageStartTime = performance.now();
  
  const context = await getActiveContext();
  
  // CRITICAL: Validate context
  if (!context || !validateOrgContext(context)) {
    notFound();
  }

  const resolvedSearchParams = await searchParams;
  const assignedToMe = resolvedSearchParams.assigned === 'me';

  const snapshotStartTime = performance.now();
  const snapshot = await getTasksSnapshot(context, {
    search: resolvedSearchParams.search || '',
    limit: 50,
    sort: resolvedSearchParams.sort || 'due_date',
    assignedToUserId: assignedToMe && context.variant === 'agency' ? context.user?.id : undefined
  });
  console.log(`[Performance] getTasksSnapshot: ${(performance.now() - snapshotStartTime).toFixed(2)}ms`);

  // Fetch all independent data in parallel after snapshot (snapshot needed for task IDs)
  const taskIds = snapshot.tasks.map(t => t.id);
  const uniqueConnectionIds = [...new Set(snapshot.tasks.map(t => t.connectionId))];
  const [
    initialComments,
    agencyMembers,
    clientMembers,
    connections,
    membersByConnection
  ] = await Promise.all([
    // Comments prefetched for instant modal visibility
    taskIds.length > 0 ? getCommentsForTasks(taskIds) : Promise.resolve({}),
    // Agency members (only for agencies) - kept for backward compatibility
    getAgencyMembersForActiveOrg(context),
    // Client members (only for clients) - for filtering "Assigned to my team"
    getClientMembersForActiveOrg(context),
    // Connections for global task creation
    getConnectionsForGlobalView(context),
    // Members for all connections (both agency and client members per connection)
    getMembersForAllConnections(context, uniqueConnectionIds)
  ]);

  console.log(`[Performance] TasksPage TOTAL: ${(performance.now() - pageStartTime).toFixed(2)}ms`);

  return (
    <TasksContent 
      snapshot={snapshot} 
      context={context}
      initialSearchValue={resolvedSearchParams.search || ''}
      initialSortValue={resolvedSearchParams.sort || 'due_date'}
      initialComments={initialComments}
      agencyMembers={agencyMembers}
      clientMembers={clientMembers}
      connections={connections}
      membersByConnection={membersByConnection}
    />
  );
}
