import {
  getTasksForConnection,
  getCommentsForTasks,
  getProjectOptionsForConnection,
  getConnectionMembers,
  type Task,
  type Comment as TaskComment,
  type Project,
} from '../server';
import type { MemberSummary } from '../utils/memberSorting';
import TasksCardClient from './TasksCardClient';

type ProjectOption = {
  id: string;
  name: string;
};

interface TasksCardProps {
  connectionId: string;
  fetchTasks?: (connectionId: string) => Promise<Task[]>;
  projects?: ProjectOption[]; // Optional: if provided, skip fetching projects
}

async function defaultFetchTasks(connectionId: string) {
  const { tasks } = await getTasksForConnection(connectionId, { limit: 5, offset: 0 });
  return tasks;
}

type PrefetchedComment = {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  createdAt: string;
  text: string;
};

type PrefetchedTask = {
  id: string;
  title: string;
  createdAt: string | null;
  dueDate?: string | null;
  detail: {
    taskId: string;
    title: string;
    description: string;
    client?: {
      id: string;
      name: string;
      logoUrl?: string;
    };
    agency?: {
      id: string;
      name: string;
      logoUrl?: string;
    };
    submittedBy?: {
      id: string;
      name: string;
      email: string;
      avatarUrl?: string;
    };
    assignee?: {
      id: string;
      name: string;
      email: string;
      avatarUrl?: string;
    } | null;
    project?: {
      id: string;
      name: string;
    } | null;
    status?: 'to_do' | 'in_progress' | 'on_hold' | 'done';
    createdAt?: string;
    createdByOrgId?: string;
    createdByOrgType?: 'agency' | 'client';
    dueDate?: string | null;
    dueDateRaw?: string | null;
    clientVisible?: boolean;
    clientVisibilityLocked?: boolean;
  };
  comments: PrefetchedComment[];
};

export default async function TasksCard({
  connectionId,
  fetchTasks = defaultFetchTasks,
  projects: providedProjects,
}: TasksCardProps) {
  const tasks = await fetchTasks(connectionId);
  const taskIds = tasks.map((task) => task.id);

  const commentsPromise: Promise<Record<string, TaskComment[]>> = taskIds.length > 0
    ? getCommentsForTasks(taskIds)
    : Promise.resolve({});

  // Fetch projects only if not provided (optimization: share projects across cards)
  // Use lightweight getProjectOptionsForConnection instead of full project fetch
  const projectsPromise = providedProjects 
    ? Promise.resolve({ 
        projects: providedProjects.map(p => ({ 
          id: p.id, 
          title: p.name, 
          requestsCount: 0, 
          tasksCount: 0 
        } as Pick<Project, 'id' | 'title' | 'requestsCount' | 'tasksCount'>)), 
        totalCount: providedProjects.length 
      })
    : getProjectOptionsForConnection(connectionId).then(options => ({
        projects: options.map(p => ({
          id: p.id,
          title: p.name,
          requestsCount: 0,
          tasksCount: 0
        } as Pick<Project, 'id' | 'title' | 'requestsCount' | 'tasksCount'>)),
        totalCount: options.length
      }));

  const [commentsRecord, projectsResult, memberData] = await Promise.all([
    commentsPromise,
    projectsPromise,
    getConnectionMembers(connectionId),
  ]);

  const prefetchedTasks: PrefetchedTask[] = tasks.map((task) => {
    const rawComments = commentsRecord[task.id] ?? [];
    const serializedComments: PrefetchedComment[] = rawComments.map((comment) => ({
      id: comment.id,
      userId: comment.userId,
      userName: comment.userName,
      userAvatar: comment.userAvatar,
      createdAt: comment.createdAt instanceof Date
        ? comment.createdAt.toISOString()
        : new Date(comment.createdAt).toISOString(),
      text: comment.text,
    }));

    return {
      id: task.id,
      title: task.title,
      createdAt: task.createdAt,
      dueDate: task.dueDate ?? null,
      detail: {
        taskId: task.id,
        title: task.title,
        description: task.description,
        client: task.client,
        agency: task.agency,
        submittedBy: task.submittedBy,
        assignee: task.assignee,
        project: task.project,
        status: task.status,
        createdAt: task.createdAt,
        createdByOrgId: task.createdByOrgId,
        createdByOrgType: task.createdByOrgType,
        dueDate: task.dueDate ?? null,
        dueDateRaw: task.dueDateRaw ?? null,
        clientVisible: task.clientVisible,
        clientVisibilityLocked: task.clientVisibilityLocked,
      sourceRequestId: task.sourceRequestId ?? null,
      linkedRequest: task.linkedRequest ?? null,
      },
      comments: serializedComments,
    };
  });

  // Split into displayed (first 4) and prefetched (5th)
  const displayedTasks = prefetchedTasks.slice(0, 4);
  const prefetchedNextTask = prefetchedTasks[4] || null;

  const projectOptions: ProjectOption[] = projectsResult.projects.map((project) => ({
    id: project.id,
    name: project.title || 'Untitled project',
  }));

  const assignableMembers: MemberSummary[] = (() => {
    const combined: MemberSummary[] = [...memberData.agencyMembers];
    for (const member of memberData.clientMembers) {
      if (!combined.some((existing) => existing.id === member.id)) {
        combined.push(member);
      }
    }
    return combined;
  })();

  return (
    <TasksCardClient
      connectionId={connectionId}
      tasks={displayedTasks}
      prefetchedNextTask={prefetchedNextTask}
      projects={projectOptions}
      members={assignableMembers}
    />
  );
}