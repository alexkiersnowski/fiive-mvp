'use client'

import { useState, useCallback, useEffect, useRef, useMemo, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import TasksTable from '@/features/tasks/TasksTable';
import { TasksHeader } from '@/features/tasks/TasksHeader';
import { TaskDetailModal } from '@/features/connections/tasks/TaskDetailModal';
import { NewTaskModal } from '@/features/connections/tasks/NewTaskModal';
import { fetchMoreTasks, refreshTasksData, fetchTaskByIdGlobal, fetchCommentsForTaskGlobal } from '@/features/tasks/actions';
import { createTask } from '@/features/connections/tasks/actions';
import { fetchProjectsForConnection } from '@/features/connections/tasks/actions';
import type { TasksSnapshot, Task } from '@/features/tasks/types';
import type { EnhancedModeContext } from '@/lib/mode/getActiveContext';
import type { Comment } from '@/features/connections/server';

interface TasksContentProps {
  snapshot: TasksSnapshot;
  context: EnhancedModeContext;
  initialSearchValue?: string;
  initialSortValue?: string;
  initialComments?: Record<string, Comment[]>;
  agencyMembers?: Array<{
    id: string
    firstName: string
    lastName: string
    email: string
    avatarUrl?: string
    jobTitle?: string
  }>;
  clientMembers?: Array<{
    id: string
    firstName: string
    lastName: string
    email: string
    avatarUrl?: string
    jobTitle?: string
  }>;
  connections?: Array<{
    id: string
    name: string
    logoUrl?: string
  }>;
  membersByConnection?: Record<string, Array<{
    id: string
    firstName: string
    lastName: string
    email: string
    avatarUrl?: string
    jobTitle?: string
    orgId?: string
    orgName?: string
    orgType?: 'agency' | 'client'
  }>>;
}

export function TasksContent({ 
  snapshot, 
  context, 
  initialSearchValue = '', 
  initialSortValue = 'due_date',
  initialComments = {},
  agencyMembers = [],
  clientMembers = [],
  connections = [],
  membersByConnection = {},
}: TasksContentProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rootRef = useRef<HTMLDivElement>(null);
  const parentRef = useRef<HTMLDivElement | null>(null);
  const headerWrapperRef = useRef<HTMLDivElement>(null);
  const [headerOffset, setHeaderOffset] = useState(0);
  const initiallyAssigned = (() => {
    try { return searchParams.get('assigned') === 'me' } catch { return false }
  })()
  const [assignedToMe, setAssignedToMe] = useState(initiallyAssigned);
  
  const [tasks, setTasks] = useState<Task[]>(snapshot.tasks);
  const [totalCount, setTotalCount] = useState(snapshot.total);
  const [unfilteredTotalCount, setUnfilteredTotalCount] = useState(snapshot.unfilteredTotalCount);
  const [cursor, setCursor] = useState<string | null>(snapshot.cursor || null);
  const [hasNextPage, setHasNextPage] = useState(snapshot.hasNextPage);
  const [searchValue, setSearchValue] = useState(initialSearchValue);
  const [debouncedSearchValue, setDebouncedSearchValue] = useState(initialSearchValue);
  const [sortValue, setSortValue] = useState(initialSortValue || 'due_date');
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingServerResults, setIsFetchingServerResults] = useState(false);
  const [isPending, startTransition] = useTransition();
  
  // Modal state
  const [isTaskDetailModalOpen, setIsTaskDetailModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isNewTaskModalOpen, setIsNewTaskModalOpen] = useState(false);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  const [projectsForConnection, setProjectsForConnection] = useState<Array<{ id: string; name: string }>>([]);
  
  // Comments map keyed by taskId for instant lookup
  const [commentsByTask, setCommentsByTask] = useState<Record<string, Comment[]>>(initialComments);

  // Calculate client team member IDs (all members of the client organization)
  // This filters tasks where assignee_user_id is a member of the client organization
  const clientTeamMemberIds = useMemo(() => {
    if (context.variant !== 'client') return [] as string[];
    // Use the directly fetched client members (all members of context.orgId)
    return clientMembers.map(member => member.id).filter((id): id is string => Boolean(id));
  }, [context.variant, clientMembers]);

  // Sort options - different for agency vs client views (MVP: only 3 sorts)
  const sortOptions = context.variant === 'agency'
    ? [
        { value: 'due_date', label: 'Due date', buttonLabel: 'Due date' },
        { value: 'client_asc', label: 'Client (A-Z)', buttonLabel: 'Client (A-Z)' },
        { value: 'client_desc', label: 'Client (Z-A)', buttonLabel: 'Client (Z-A)' }
      ]
    : [
        { value: 'due_date', label: 'Due date', buttonLabel: 'Due date' },
        { value: 'agency_asc', label: 'Agency (A-Z)', buttonLabel: 'Agency (A-Z)' },
        { value: 'agency_desc', label: 'Agency (Z-A)', buttonLabel: 'Agency (Z-A)' }
      ];

  // Sync local state with server snapshot when props change
  // But if assignedToMe is true for clients, we need to refetch with the client member filter
  useEffect(() => {
    // If client has assignedToMe enabled, we need to fetch with clientTeamMemberIds filter
    // The initial snapshot doesn't have this filter applied
    if (assignedToMe && context.variant === 'client' && clientTeamMemberIds.length > 0) {
      // Don't sync snapshot - we'll fetch filtered data instead
      return;
    }
    
    startTransition(() => {
      setTasks(snapshot.tasks);
      setTotalCount(snapshot.total);
      setUnfilteredTotalCount(snapshot.unfilteredTotalCount);
      setCursor(snapshot.cursor || null);
      setHasNextPage(snapshot.hasNextPage);
      setIsFetchingServerResults(false);
    });
  }, [snapshot, startTransition, assignedToMe, context.variant, clientTeamMemberIds]);

  // Sync comments when initialComments prop changes
  useEffect(() => {
    setCommentsByTask(prev => ({
      ...prev,
      ...initialComments
    }));
  }, [initialComments]);

  // Debounce server fetch (150ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchValue(searchValue);
    }, 150);

    return () => clearTimeout(timer);
  }, [searchValue]);

  // Trigger server fetch when debounced search, sort, or assignedToMe changes
  useEffect(() => {
    const currentSearchParam = searchParams.get('search') || '';
    const currentSortParam = searchParams.get('sort') || 'due_date';
    const currentAssignedParam = searchParams.get('assigned') === 'me';
    
    // For clients with assignedToMe, we need clientTeamMemberIds to be available before fetching
    if (assignedToMe && context.variant === 'client' && clientTeamMemberIds.length === 0) {
      // Wait for client members to be loaded
      return;
    }
    
    if (debouncedSearchValue !== currentSearchParam || sortValue !== currentSortParam || assignedToMe !== currentAssignedParam) {
      setIsFetchingServerResults(true);
      const params = new URLSearchParams(searchParams.toString());
      if (debouncedSearchValue.trim()) {
        params.set('search', debouncedSearchValue.trim());
      } else {
        params.delete('search');
      }
      params.set('sort', sortValue);
      if (assignedToMe) {
        params.set('assigned', 'me');
      } else {
        params.delete('assigned');
      }
      router.push(`/tasks?${params.toString()}`, { scroll: false });
    }
  }, [debouncedSearchValue, sortValue, assignedToMe, router, searchParams, context.variant, clientTeamMemberIds]);
  
  // Fetch filtered data when assignedToMe is true for clients (after clientTeamMemberIds is available)
  // This runs when assignedToMe changes or when clientTeamMemberIds becomes available
  useEffect(() => {
    // Only fetch if assignedToMe is true, we're a client, and we have client member IDs
    if (!assignedToMe || context.variant !== 'client' || clientTeamMemberIds.length === 0) {
      return;
    }
    
    setIsFetchingServerResults(true);
    refreshTasksData(context, {
      search: debouncedSearchValue,
      sort: sortValue,
      limit: 50,
      assignedToUserIds: clientTeamMemberIds
    }).then(snapshot => {
      startTransition(() => {
        setTasks(snapshot.tasks);
        setTotalCount(snapshot.total);
        setUnfilteredTotalCount(snapshot.unfilteredTotalCount);
        setCursor(snapshot.cursor || null);
        setHasNextPage(snapshot.hasNextPage);
        setIsFetchingServerResults(false);
      });
    }).catch(error => {
      console.error('Error fetching filtered tasks:', error);
      setIsFetchingServerResults(false);
    });
  }, [assignedToMe, context, debouncedSearchValue, sortValue, clientTeamMemberIds, startTransition]);

  // Display: Use server results directly (no optimistic filtering)
  const displayedTasks = tasks;
  const displayedTotal = totalCount;

  // Track header height for sticky table offset
  useEffect(() => {
    if (!headerWrapperRef.current) return;
    const node = headerWrapperRef.current;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setHeaderOffset(entry.contentRect.height);
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const loadMore = useCallback(async () => {
    if (!hasNextPage || isLoading || !cursor) return;
    
    setIsLoading(true);
    try {
      const snapshot = await fetchMoreTasks(context, {
        cursor,
        search: debouncedSearchValue,
        sort: sortValue,
        limit: 50,
        assignedToUserId: assignedToMe && context.variant === 'agency' ? context.user?.id : undefined,
        assignedToUserIds: assignedToMe && context.variant === 'client' && clientTeamMemberIds.length > 0 ? clientTeamMemberIds : undefined
      });
      
      startTransition(() => {
        setTasks(prev => {
          const existingIds = new Set(prev.map(t => t.id));
          const newTasks = snapshot.tasks.filter(t => !existingIds.has(t.id));
          return [...prev, ...newTasks];
        });
        setTotalCount(snapshot.total);
        setUnfilteredTotalCount(snapshot.unfilteredTotalCount);
        setCursor(snapshot.cursor || null);
        setHasNextPage(snapshot.hasNextPage);
      });
    } catch (error) {
      console.error('Error loading more tasks:', error);
      setHasNextPage(false);
    } finally {
      setIsLoading(false);
    }
  }, [hasNextPage, isLoading, cursor, context, debouncedSearchValue, sortValue, assignedToMe, clientTeamMemberIds, startTransition]);

  const handleSearchChange = useCallback((value: string) => {
    setSearchValue(value);
  }, []);

  const handleSortChange = useCallback((newSortValue: string) => {
    setSortValue(newSortValue);
  }, []);

  const handleNewTask = useCallback(() => {
    setIsNewTaskModalOpen(true);
  }, []);

  const handleNewTaskModalClose = useCallback(() => {
    setIsNewTaskModalOpen(false);
    setSelectedConnectionId(null);
    setProjectsForConnection([]);
  }, []);

  const handleConnectionSelect = useCallback(async (connectionId: string) => {
    setSelectedConnectionId(connectionId);
    try {
      const projects = await fetchProjectsForConnection(connectionId);
      setProjectsForConnection(projects);
    } catch (error) {
      console.error('Error fetching projects:', error);
      setProjectsForConnection([]);
    }
  }, []);

  const handleTaskOptimistic = useCallback((payload: {
    tempId: string
    title: string
    description: string
    projectId: string | null
    projectName?: string | null
    assigneeUserId: string | null
    assignee?: {
      id: string
      name: string
      email: string
      avatarUrl?: string
    } | null
    clientVisible?: boolean
    clientVisibilityLocked?: boolean
  }) => {
    if (!selectedConnectionId) return;
    
    const selectedConnection = connections.find(c => c.id === selectedConnectionId);
    if (!selectedConnection) return;

    const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    
    const isAgency = context.variant === 'agency';
    const optimisticTask: Task = {
      id: payload.tempId,
      connectionId: selectedConnectionId,
      title: payload.title,
      description: payload.description,
      status: 'to_do',
      project: payload.projectId && payload.projectName ? { id: payload.projectId, name: payload.projectName } : null,
      submittedBy: {
        id: context.user?.id || '',
        name: `${context.user?.firstName || ''} ${context.user?.lastName || ''}`.trim() || 'You',
        email: context.user?.email || '',
        avatarUrl: context.user?.avatarUrl || undefined,
        jobTitle: context.user?.jobTitle || undefined,
        orgId: context.organization.id,
        orgName: context.organization.name || '',
        orgLogo: undefined,
      },
      assignee: payload.assignee || null,
      client: isAgency 
        ? {
            id: selectedConnection.id,
            name: selectedConnection.name,
            logoUrl: selectedConnection.logoUrl,
          }
        : {
            id: context.organization.id,
            name: context.organization.name || '',
            logoUrl: context.organization.logoUrl,
          },
      agency: isAgency
        ? {
            id: context.organization.id,
            name: context.organization.name || '',
            logoUrl: context.organization.logoUrl,
          }
        : {
            id: selectedConnection.id,
            name: selectedConnection.name,
            logoUrl: selectedConnection.logoUrl,
          },
      createdAt: today,
      createdAtRaw: new Date().toISOString(),
      createdByUserId: context.user?.id || '',
      createdByOrgId: context.organization.id,
      createdByOrgType: context.variant,
      clientVisible: payload.clientVisible ?? false,
      clientVisibilityLocked: payload.clientVisibilityLocked ?? false,
      sourceRequestId: null,
      linkedRequest: null,
    };

    setTasks(prev => [optimisticTask, ...prev]);
    setTotalCount(prev => prev + 1);
    setUnfilteredTotalCount(prev => prev + 1);
  }, [selectedConnectionId, connections, context]);

  const handleTaskCreated = useCallback(async ({ taskId, tempId }: { taskId: string; tempId?: string }) => {
    if (!selectedConnectionId) {
      return;
    }
    
    if (!taskId) {
      return;
    }
    
    try {
      // Use connectionId directly (like the working connection-specific version)
      // Skip cache for immediate post-insert fetch to avoid stale data
      const task = await fetchTaskByIdGlobal(taskId, context, selectedConnectionId, true);
      if (!task) {
        console.error('Failed to fetch newly created task');
        return;
      }
      
      // Replace temp row if present; otherwise prepend and increment count
      setTasks(prev => {
        const hadTemp = tempId ? prev.some(t => t.id === tempId) : false;
        const without = prev.filter(t => t.id !== tempId && t.id !== task.id);
        const next = [task, ...without];
        return next;
      });
      
      // Update selectedTask if it matches tempId (using functional update to avoid stale closure)
      if (tempId) {
        setSelectedTask(prev => {
          if (prev?.id === tempId) {
            return task;
          }
          return prev;
        });
      }
      
      try {
        const comments = await fetchCommentsForTaskGlobal(taskId);
        setCommentsByTask(prev => ({
          ...prev,
          [taskId]: comments
        }));
      } catch (error) {
        console.error('Error fetching comments:', error);
      }
    } catch (error) {
      console.error('Failed to fetch newly created task:', error, { 
        taskId, 
        tempId, 
        selectedConnectionId,
        orgId: context.orgId,
        variant: context.variant,
        errorMessage: error instanceof Error ? error.message : String(error)
      });
    }
  }, [selectedConnectionId, context]);

  const handleTaskClick = useCallback(async (taskId: string) => {
    const localTask = tasks.find(t => t.id === taskId);
    
    if (localTask) {
      setSelectedTask(localTask);
      setIsTaskDetailModalOpen(true);
      
      if (commentsByTask[taskId]) {
        // Comments already available
      } else {
        try {
          const comments = await fetchCommentsForTaskGlobal(taskId);
          setCommentsByTask(prev => ({
            ...prev,
            [taskId]: comments
          }));
        } catch (error) {
          console.error('Error fetching comments:', error);
        }
      }
    } else {
      try {
        const task = await fetchTaskByIdGlobal(taskId, context);
        if (task) {
          setSelectedTask(task);
          setIsTaskDetailModalOpen(true);
          
          if (commentsByTask[taskId]) {
            // Comments already available
          } else {
            const comments = await fetchCommentsForTaskGlobal(taskId);
            setCommentsByTask(prev => ({
              ...prev,
              [taskId]: comments
            }));
          }
        } else {
          toast.error('Task not found');
        }
      } catch (error) {
        console.error('Error fetching task:', error);
        toast.error('Failed to load task');
      }
    }
  }, [tasks, context, commentsByTask]);
  
  const handleTaskDetailModalClose = useCallback(() => {
    setIsTaskDetailModalOpen(false);
    setSelectedTask(null);
  }, []);
  
  const handleExpandTask = useCallback(() => {
    if (selectedTask && selectedTask.connectionId) {
      if (selectedTask.id.startsWith('temp-')) {
        toast.error('Please wait for the task to finish creating');
        return;
      }
      
      const baseRoute = context.variant === 'agency' ? 'clients' : 'agencies';
      const url = `/${baseRoute}/${selectedTask.connectionId}/tasks/${selectedTask.id}`;
      window.location.href = url;
    }
  }, [selectedTask, context.variant]);

  const handleTaskUpdate = useCallback((taskId: string, updates: { title?: string; description?: string; status?: 'to_do' | 'in_progress' | 'on_hold' | 'done'; assignee?: Task['assignee']; project?: { id: string; name: string } | null; dueDate?: string | null; dueDateRaw?: string | null; clientVisible?: boolean; clientVisibilityLocked?: boolean }) => {
    setTasks(prev => prev.map(t => 
      t.id === taskId 
        ? { ...t, ...updates }
        : t
    ));
    if (selectedTask && selectedTask.id === taskId) {
      setSelectedTask(prev => prev ? { ...prev, ...updates } : null);
    }
  }, [selectedTask]);

  const handleTaskDeleted = useCallback(async (taskId: string) => {
    const deletedIndex = tasks.findIndex(t => t.id === taskId);
    const deletedTask = deletedIndex >= 0 ? tasks[deletedIndex] : null;
    
    // Optimistically remove from UI
    setTasks(prev => prev.filter(t => t.id !== taskId));
    setTotalCount(prev => Math.max(0, prev - 1));
    setUnfilteredTotalCount(prev => Math.max(0, prev - 1));
    
    if (selectedTask?.id === taskId) {
      setIsTaskDetailModalOpen(false);
      setSelectedTask(null);
    }
    
    try {
      const { deleteTask } = await import('@/features/connections/tasks/actions');
      await deleteTask(taskId);
      // Only show success toast after server confirms
      toast.success('Task deleted');
    } catch (error) {
      // Rollback optimistic update on error
      if (deletedTask && deletedIndex >= 0) {
        setTasks(prev => {
          return [...prev.slice(0, deletedIndex), deletedTask, ...prev.slice(deletedIndex)];
        });
        setTotalCount(prev => prev + 1);
        setUnfilteredTotalCount(prev => prev + 1);
      }
      console.error('Error deleting task:', error);
      toast.error('Failed to delete task');
    }
  }, [tasks, selectedTask]);

  const handleToggleAssignedToMe = useCallback(() => {
    setAssignedToMe(prev => !prev);
  }, []);

  // Use organization logo for clients, user avatar for agencies (matching connection-specific behavior)
  const userAvatar = context.variant === 'agency'
    ? (context.user?.avatarUrl || '')
    : (context.organization.logoUrl || '');
  
  const userInitials = context.variant === 'agency'
    ? ((context.user?.firstName?.[0] || '') + (context.user?.lastName?.[0] || '') || 'U')
    : (context.organization.name ? context.organization.name.slice(0, 2).toUpperCase() : 'TM');
  
  const isAgency = context.variant === 'agency';

  // Find selected connection for NewTaskModal
  const selectedConnection = selectedConnectionId 
    ? connections.find(c => c.id === selectedConnectionId)
    : null;

  return (
    <div ref={rootRef} className="flex flex-col" style={{ padding: '0 16px 24px 24px' }}>
      <div
        ref={headerWrapperRef}
        className="sticky z-20"
        style={{
          top: 0,
          backgroundColor: 'var(--color-neutral-2)',
          backdropFilter: 'saturate(180%) blur(12px)',
        }}
      >
        <TasksHeader
          onNewTask={handleNewTask}
          isAgency={isAgency}
        />
      </div>

      <div ref={parentRef}>
        <TasksTable
          tasks={displayedTasks}
          isBootstrapping={isFetchingServerResults && displayedTasks.length === 0}
          unfilteredTotalCount={unfilteredTotalCount}
          onLoadMore={loadMore}
          onNewTask={handleNewTask}
          onTaskClick={handleTaskClick}
          onTaskUpdate={handleTaskUpdate}
          onTaskDeleted={handleTaskDeleted}
          parentRef={parentRef}
          headerOffset={headerOffset}
          currentOrgId={context.orgId}
          totalCount={displayedTotal}
          assignedToMe={assignedToMe}
          onToggleAssignedToMe={handleToggleAssignedToMe}
          userAvatar={userAvatar}
          userInitials={userInitials}
          isAgency={isAgency}
          agencyMembers={agencyMembers}
          membersByConnection={membersByConnection}
          onSearchChange={handleSearchChange}
          sortOptions={sortOptions}
          sortValue={sortValue}
          onSortChange={handleSortChange}
        />
      </div>

      {/* Task Detail Modal */}
      {selectedTask && (
        <TaskDetailModal
          taskData={{
            taskId: selectedTask.id,
            title: selectedTask.title,
            description: selectedTask.description,
            client: selectedTask.client,
            agency: selectedTask.agency,
            submittedBy: selectedTask.submittedBy,
            assignee: selectedTask.assignee,
            project: selectedTask.project,
            status: selectedTask.status,
            dueDate: selectedTask.dueDate,
            dueDateRaw: selectedTask.dueDateRaw,
            createdAt: selectedTask.createdAt,
            createdByOrgId: selectedTask.createdByOrgId,
            createdByOrgType: selectedTask.createdByOrgType,
            clientVisible: selectedTask.clientVisible,
            clientVisibilityLocked: selectedTask.clientVisibilityLocked,
            sourceRequestId: selectedTask.sourceRequestId,
            linkedRequest: selectedTask.linkedRequest,
          }}
          agencyMembers={membersByConnection[selectedTask.connectionId] || agencyMembers}
          projects={[]} // TODO: Fetch projects for global tasks
          isOpen={isTaskDetailModalOpen}
          onClose={handleTaskDetailModalClose}
          onExpand={handleExpandTask}
          onTaskUpdate={(taskId, updates) => {
            handleTaskUpdate(taskId, updates);
            if (selectedTask && selectedTask.id === taskId) {
              setSelectedTask(prev => prev ? { ...prev, ...updates } : null);
            }
          }}
          onTaskDeleted={handleTaskDeleted}
          connectionId={selectedTask.connectionId}
          currentOrgId={context.orgId}
          variant={context.variant}
          activeUser={context.user ? {
            id: context.user.id,
            firstName: context.user.firstName,
            lastName: context.user.lastName,
            avatarUrl: context.user.avatarUrl,
          } : undefined}
          initialComments={commentsByTask[selectedTask.id] || []}
          onCommentsUpdate={(comments) => {
            setCommentsByTask(prev => ({
              ...prev,
              [selectedTask.id]: comments
            }));
          }}
        />
      )}

      {/* New Task Modal - Global Mode */}
      {isNewTaskModalOpen && (
        <NewTaskModal
          client={selectedConnectionId ? connections.find(c => c.id === selectedConnectionId) : undefined}
          connections={connections}
          agencyMembers={agencyMembers}
          projects={projectsForConnection}
          isOpen={isNewTaskModalOpen}
          onClose={handleNewTaskModalClose}
          onTaskOptimistic={handleTaskOptimistic}
          onTaskCreated={handleTaskCreated}
          connectionId={selectedConnectionId || undefined}
          currentOrgId={context.orgId}
          variant={context.variant}
          isGlobal={true}
          onConnectionSelect={handleConnectionSelect}
        />
      )}
    </div>
  );
}

