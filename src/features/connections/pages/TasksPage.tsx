import { Card } from '@/components/ui/card';
import { getTasksForConnection, getConnectionMembers, getProjectOptionsForConnection, getCommentsForTasks } from '../server';
import TasksPageClient from './TasksPageClient';
import { PAGE_SIZE } from '../constants';

interface TasksPageProps {
  connectionId: string
}

// Server component that fetches data from Supabase
export async function TasksPage({ connectionId }: TasksPageProps) {
  // Fetch tasks, members, and projects in parallel (they don't depend on each other)
  // Comments depend on taskIds, so we'll fetch them after tasks
  const [tasksData, memberData, projects] = await Promise.all([
    getTasksForConnection(connectionId, { limit: PAGE_SIZE, offset: 0 }),
    getConnectionMembers(connectionId),
    getProjectOptionsForConnection(connectionId)
  ]);
  
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
        agencyMembers={assignableMembers}
        projects={projects}
        initialCommentsByTask={serializedComments}
      />
    </Card>
  );
}
