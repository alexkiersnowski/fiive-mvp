import { Card } from '@/components/ui/card';
import { getTasksForConnection, getTasksCountsForConnection, getConnectionMembers, getProjectOptionsForConnection, getCommentsForTasks } from '../server';
import TasksPageClient from './TasksPageClient';
// PAGE_SIZE imported but not used - kept for potential future use

interface TasksPageProps {
  connectionId: string
}

// Server component that fetches data from Supabase
export async function TasksPage({ connectionId }: TasksPageProps) {
  // Fetch ALL tasks upfront for connection tables (~200-1000 items max)
  // No pagination needed - connection tables are small enough to load everything
  // Fetch from each status separately to ensure we get all tasks from all statuses
  // Note: Tasks don't have a 'canceled' status (only requests do)
  const statuses: Array<'to_do' | 'in_progress' | 'on_hold' | 'done'> = ['to_do', 'in_progress', 'on_hold', 'done']
  
  // Fetch ALL tasks from each status (no limit - fetch everything)
  // Add error handling to prevent one failed status from breaking the entire fetch
  const tasksByStatusPromises = statuses.map(status => 
    getTasksForConnection(connectionId, { 
      limit: 10000, // High safety limit (10k per status = 40k total max, way more than any connection needs)
      offset: 0,
      status, // Filter by status
      sortBy: 'updated_at' // Use updated_at to get most recent tasks per status
    })
      .then(result => ({ status, tasks: result.tasks, error: null }))
      .catch(error => {
        console.error(`Error fetching tasks for status ${status}:`, error)
        return { status, tasks: [], error }
      })
  )
  
  // Fetch counts, members, and projects in parallel with tasks
  const [tasksByStatusResults, statusCounts, memberData, projects] = await Promise.all([
    Promise.all(tasksByStatusPromises),
    getTasksCountsForConnection(connectionId),
    getConnectionMembers(connectionId),
    getProjectOptionsForConnection(connectionId)
  ])
  
  // Combine ALL tasks from all statuses
  const allTasks: typeof tasksByStatusResults[0]['tasks'] = []
  const statusOrder: typeof statuses = ['to_do', 'in_progress', 'on_hold', 'done']
  for (const status of statusOrder) {
    const result = tasksByStatusResults.find(r => r.status === status)
    if (result) {
      allTasks.push(...result.tasks)
    }
  }
  
  const tasksData = {
    tasks: allTasks, // No limit - we fetched all tasks
    totalCount: statusCounts ? Object.values(statusCounts).reduce((sum, count) => sum + count, 0) : allTasks.length
  }
  
  // Now fetch comments using taskIds from the fetched tasks
  const taskIds = tasksData.tasks.map(task => task.id);
  const commentsRecord = taskIds.length > 0 
    ? await getCommentsForTasks(taskIds) 
    : {};
  const serializedComments = Object.fromEntries(
    Object.entries(commentsRecord).map(([taskId, commentList]) => [
      taskId,
      commentList.map(comment => ({
        id: comment.id,
        userId: comment.userId,
        userName: comment.userName,
        userAvatar: comment.userAvatar,
        createdAt: comment.createdAt.toISOString(),
        text: comment.text,
      })),
    ])
  );

  const assignableMembers = [...memberData.agencyMembers];
  for (const member of memberData.clientMembers) {
    if (!assignableMembers.some(existing => existing.id === member.id)) {
      assignableMembers.push(member);
    }
  }

  // getProjectOptionsForConnection already returns { id, name } format, no transformation needed

  return (
    <Card className="w-full gap-0 h-full">
      <TasksPageClient 
        connectionId={connectionId} 
        initialTasks={tasksData.tasks} 
        initialTotalCount={tasksData.totalCount}
        initialStatusCounts={statusCounts}
        agencyMembers={assignableMembers}
        projects={projects}
        initialCommentsByTask={serializedComments}
      />
    </Card>
  );
}
