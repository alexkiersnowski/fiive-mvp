'use client'

import { useState, useCallback, useEffect, useRef, useMemo, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import TasksTable from '@/features/tasks/TasksTable';
import { TasksHeader } from '@/features/tasks/TasksHeader';
import { TaskDetailModal } from '@/features/connections/tasks/TaskDetailModal';
import { NewTaskModal } from '@/features/connections/tasks/NewTaskModal';
import { fetchMoreTasks, refreshTasksData, fetchTaskByIdGlobal, fetchCommentsForTaskGlobal, searchTasksGlobal } from '@/features/tasks/actions';
import { fetchProjectsForConnection } from '@/features/connections/tasks/actions';
import { PaywallModal } from '@/components/ui/paywall-modal';
import { runWithPaywallCheck } from '@/lib/tasks-requests-helpers';
import type { TasksSnapshot, Task } from '@/features/tasks/types';
import type { EnhancedModeContext } from '@/lib/mode/getActiveContext';
import type { Comment } from '@/features/connections/server';

interface TasksContentProps {
  snapshot: TasksSnapshot;
  context: EnhancedModeContext;
  initialSearchValue?: string;
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
    orgId: string // Organization ID (client_id for agencies, agency_id for clients)
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
  allowedConnectionIds?: string[] | null; // Array of allowed connection IDs (null = no limit for paid plans)
}

export function TasksContent({ 
  snapshot, 
  context, 
  initialSearchValue = '', 
  initialComments = {},
  agencyMembers = [],
  clientMembers = [],
  connections = [],
  membersByConnection = {},
  allowedConnectionIds = null
}: TasksContentProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rootRef = useRef<HTMLDivElement>(null);
  const parentRef = useRef<HTMLDivElement | null>(null);
  const headerWrapperRef = useRef<HTMLDivElement>(null);
  const isNavigatingRef = useRef(false);
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
  const [loadedConnectionIds, setLoadedConnectionIds] = useState<string[]>(snapshot.loadedConnectionIds || []);
  const [searchValue, setSearchValue] = useState(initialSearchValue);
  const [debouncedSearchValue, setDebouncedSearchValue] = useState(initialSearchValue);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingServerResults, setIsFetchingServerResults] = useState(false);
  const [, startTransition] = useTransition();
  
  // Modal state
  const [isTaskDetailModalOpen, setIsTaskDetailModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isNewTaskModalOpen, setIsNewTaskModalOpen] = useState(false);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  const [projectsForConnection, setProjectsForConnection] = useState<Array<{ id: string; name: string }>>([]);
  
  // Comments map keyed by taskId for instant lookup
  const [commentsByTask, setCommentsByTask] = useState<Record<string, Comment[]>>(initialComments);
  
  // Paywall modal state
  const [isPaywallModalOpen, setIsPaywallModalOpen] = useState(false);

  // Calculate client team member IDs (all members of the client organization)
  // This filters tasks where assignee_user_id is a member of the client organization
  const clientTeamMemberIds = useMemo(() => {
    if (context.variant !== 'client') return [] as string[];
    // Use the directly fetched client members (all members of context.orgId)
    return clientMembers.map(member => member.id).filter((id): id is string => Boolean(id));
  }, [context.variant, clientMembers]);

  // Sync local state with server snapshot when props change
  // But if search is active or assignedToMe is true for clients, we need to refetch with appropriate filters
  useEffect(() => {
    // Check URL param directly to avoid timing issues with debounced value
    const currentSearchParam = searchParams.get('search') || '';
    const hasActiveSearch = currentSearchParam.trim().length > 0;
    
    // If search is active, don't sync snapshot - we'll fetch search results instead
    // This prevents the count from updating before search results load
    if (hasActiveSearch) {
      return;
    }
    
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
      setLoadedConnectionIds(snapshot.loadedConnectionIds || []);
      setIsFetchingServerResults(false);
    });
  }, [snapshot, startTransition, assignedToMe, context.variant, clientTeamMemberIds, searchParams]);

  // Sync comments when initialComments prop changes
  useEffect(() => {
    setCommentsByTask(prev => ({
      ...prev,
      ...initialComments
    }));
  }, [initialComments]);

  // Debounce server fetch (150ms)
  // But immediately update debounced value if search is cleared (better UX - no delay when clearing)
  useEffect(() => {
    // If search is cleared, immediately update debounced value (triggers URL clear and refetch)
    if (searchValue.trim() === '') {
      setDebouncedSearchValue('');
      return;
    }
    
    // Otherwise, debounce the update
    const timer = setTimeout(() => {
      setDebouncedSearchValue(searchValue);
    }, 150);

    return () => clearTimeout(timer);
  }, [searchValue]);

  // Trigger server fetch when debounced search or assignedToMe changes
  useEffect(() => {
    const currentSearchParam = searchParams.get('search') || '';
    const currentAssignedParam = searchParams.get('assigned') === 'me';
    const hasActiveSearch = debouncedSearchValue.trim().length > 0;
    
    // For clients with assignedToMe, we need clientTeamMemberIds to be available before fetching
    if (assignedToMe && context.variant === 'client' && clientTeamMemberIds.length === 0) {
      // Wait for client members to be loaded
      return;
    }
    
    // Check if values match - if so, reset navigation flag and return early
    const valuesMatch = debouncedSearchValue === currentSearchParam && 
                       assignedToMe === currentAssignedParam;
    
    if (valuesMatch) {
      isNavigatingRef.current = false;
      return;
    }
    
    // Only navigate if values actually differ - always allow navigation for new values
    setIsFetchingServerResults(true);
    const params = new URLSearchParams(searchParams.toString());
    if (debouncedSearchValue.trim()) {
      params.set('search', debouncedSearchValue.trim());
    } else {
      params.delete('search');
    }
    if (assignedToMe) {
      params.set('assigned', 'me');
    } else {
      params.delete('assigned');
    }
    
    // Reset navigation flag before pushing to allow subsequent updates
    isNavigatingRef.current = false;
    router.push(`/tasks?${params.toString()}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearchValue, assignedToMe, context.variant, clientTeamMemberIds]);

  // Fetch search results when search query is active
  useEffect(() => {
    const hasActiveSearch = debouncedSearchValue.trim().length > 0;
    
    // Only fetch search results if search is active
    if (!hasActiveSearch) {
      return;
    }
    
    // For clients with assignedToMe, we need clientTeamMemberIds to be available
    if (assignedToMe && context.variant === 'client' && clientTeamMemberIds.length === 0) {
      return;
    }
    
    setIsFetchingServerResults(true);
    searchTasksGlobal(context, {
      search: debouncedSearchValue,
      limit: 50, // Search-based pagination: 50 tasks per page
      assignedToUserId: assignedToMe && context.variant === 'agency' ? context.user?.id : undefined,
      assignedToUserIds: assignedToMe && context.variant === 'client' && clientTeamMemberIds.length > 0 ? clientTeamMemberIds : undefined,
      cursor: undefined // Start from beginning for new search
    }).then(snapshot => {
      startTransition(() => {
        setTasks(snapshot.tasks);
        setTotalCount(snapshot.total);
        setUnfilteredTotalCount(snapshot.unfilteredTotalCount);
        setCursor(snapshot.cursor || null);
        setHasNextPage(snapshot.hasNextPage);
        setLoadedConnectionIds([]); // Not used for search mode
        setIsFetchingServerResults(false);
      });
    }).catch(error => {
      console.error('Error searching tasks:', error);
      setIsFetchingServerResults(false);
    });
  }, [debouncedSearchValue, assignedToMe, context, clientTeamMemberIds, startTransition]);
  
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
      limit: 20,
      assignedToUserIds: clientTeamMemberIds,
      loadedConnectionIds: [] // Reset when filtering changes
    }).then(snapshot => {
      startTransition(() => {
        setTasks(snapshot.tasks);
        setTotalCount(snapshot.total);
        setUnfilteredTotalCount(snapshot.unfilteredTotalCount);
        setCursor(snapshot.cursor || null);
        setHasNextPage(snapshot.hasNextPage);
        setLoadedConnectionIds(snapshot.loadedConnectionIds || []);
        setIsFetchingServerResults(false);
      });
    }).catch(error => {
      console.error('Error fetching filtered tasks:', error);
      setIsFetchingServerResults(false);
    });
  }, [assignedToMe, context, debouncedSearchValue, clientTeamMemberIds, startTransition]);

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
    
    const hasActiveSearch = debouncedSearchValue.trim().length > 0;
    
    setIsLoading(true);
    try {
      let snapshot: TasksSnapshot;
      
      if (hasActiveSearch) {
        // Use search-based pagination (offset-based)
        snapshot = await searchTasksGlobal(context, {
          search: debouncedSearchValue,
          limit: 50, // Search-based pagination: 50 tasks per page
          cursor, // Offset-based cursor for search
          assignedToUserId: assignedToMe && context.variant === 'agency' ? context.user?.id : undefined,
          assignedToUserIds: assignedToMe && context.variant === 'client' && clientTeamMemberIds.length > 0 ? clientTeamMemberIds : undefined,
        });
      } else {
        // Use connection-based pagination (normal mode)
        snapshot = await fetchMoreTasks(context, {
        cursor,
        search: debouncedSearchValue,
        limit: 20, // Number of connections to load per page
        assignedToUserId: assignedToMe && context.variant === 'agency' ? context.user?.id : undefined,
        assignedToUserIds: assignedToMe && context.variant === 'client' && clientTeamMemberIds.length > 0 ? clientTeamMemberIds : undefined,
        loadedConnectionIds: loadedConnectionIds // Pass already loaded connection IDs to avoid duplicates
      });
      }
      
      startTransition(() => {
        // Merge new tasks with existing ones (avoid duplicates)
        setTasks(prev => {
          const existingIds = new Set(prev.map(t => t.id));
          const newTasks = snapshot.tasks.filter(t => !existingIds.has(t.id));
          return [...prev, ...newTasks];
        });
        setTotalCount(snapshot.total);
        setUnfilteredTotalCount(snapshot.unfilteredTotalCount);
        setCursor(snapshot.cursor || null);
        setHasNextPage(snapshot.hasNextPage);
        setLoadedConnectionIds(snapshot.loadedConnectionIds || []);
      });
    } catch (error) {
      console.error('Error loading more tasks:', error);
      setHasNextPage(false);
    } finally {
      setIsLoading(false);
    }
  }, [hasNextPage, isLoading, cursor, context, debouncedSearchValue, assignedToMe, clientTeamMemberIds, loadedConnectionIds, startTransition]);

  const handleSearchChange = useCallback((value: string) => {
    setSearchValue(value);
    // Show skeleton immediately when search changes (better UX feedback)
    // Keep count persistent (less jarring than showing 0)
    if (value.trim() !== debouncedSearchValue.trim()) {
      setIsFetchingServerResults(true);
      // Clear tasks immediately to show skeletons, but keep count persistent
      setTasks([]);
      // Don't clear totalCount - keep it persistent until new results arrive
    }
  }, [debouncedSearchValue]);

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
    // Use orgId (organization ID) instead of connection ID for client/agency
    // This ensures the optimistic task groups correctly with server-returned tasks
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
            id: selectedConnection.orgId, // Use organization ID, not connection ID
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
            id: selectedConnection.orgId, // Use organization ID, not connection ID
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

  // Track pending task creations to show toast when task appears
  const pendingTaskCreationsRef = useRef<Set<string>>(new Set());

  const handleTaskCreated = useCallback(async ({ taskId, tempId, connectionId }: { taskId: string; tempId?: string; connectionId: string }) => {
    console.log('[TasksContent] handleTaskCreated called', { taskId, tempId, connectionId });
    
    if (!connectionId) {
      console.warn('[TasksContent] handleTaskCreated: No connectionId provided');
      return;
    }
    
    if (!taskId) {
      console.warn('[TasksContent] handleTaskCreated: No taskId');
      return;
    }
    
    // Mark this task as pending creation
    pendingTaskCreationsRef.current.add(taskId);
    
    try {
      console.log('[TasksContent] Fetching task from server...', { taskId, connectionId });
      // Use connectionId from callback (captured before modal closed) to avoid race condition
      // Skip cache for immediate post-insert fetch to avoid stale data
      const task = await fetchTaskByIdGlobal(taskId, context, connectionId, true);
      if (!task) {
        console.error('[TasksContent] Failed to fetch newly created task');
        pendingTaskCreationsRef.current.delete(taskId);
        toast.error('Failed to create task');
        return;
      }
      
      console.log('[TasksContent] Task fetched successfully, updating state and showing toast');
      
      // Replace temp row if present; otherwise prepend and increment count
      setTasks(prev => {
        const without = prev.filter(t => t.id !== tempId && t.id !== task.id);
        const next = [task, ...without];
        return next;
      });
      
      // Show success toast after server confirms and task is successfully fetched
      // Only show if this was a pending creation (to avoid duplicate toasts)
      if (pendingTaskCreationsRef.current.has(taskId)) {
        pendingTaskCreationsRef.current.delete(taskId);
        console.log('[TasksContent] Showing success toast');
        toast.success('Task created successfully');
      }
      
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
      console.error('[TasksContent] Failed to fetch newly created task:', error, { 
        taskId, 
        tempId, 
        connectionId,
        orgId: context.orgId,
        variant: context.variant,
        errorMessage: error instanceof Error ? error.message : String(error)
      });
      pendingTaskCreationsRef.current.delete(taskId);
      toast.error('Failed to create task');
    }
  }, [context]);

  const handleTaskClick = useCallback(async (taskId: string) => {
    // Try to get task from local state first
    const localTask = tasks.find(t => t.id === taskId);
    
    if (!localTask) {
      // If not in local state, fetch from server (will trigger paywall check)
      await runWithPaywallCheck(
        async () => {
          const task = await fetchTaskByIdGlobal(taskId, context);
          if (!task) {
            throw new Error('Task not found');
          }
          return task;
        },
        (task) => {
          setSelectedTask(task);
          setIsTaskDetailModalOpen(true);
          
          if (commentsByTask[taskId]) {
            // Comments already available
          } else {
            fetchCommentsForTaskGlobal(taskId).then(comments => {
              setCommentsByTask(prev => ({
                ...prev,
                [taskId]: comments
              }));
            }).catch(error => {
              console.error('Error fetching comments:', error);
            });
          }
        },
        () => {
          setIsPaywallModalOpen(true);
        }
      );
      return;
    }

    // Check paywall client-side using prefetched allowedConnectionIds
    const billingStatus = context.organization.billing_status || 'free';
    if (context.variant === 'agency' && billingStatus === 'free' && allowedConnectionIds != null) {
      if (!allowedConnectionIds.includes(localTask.connectionId)) {
        // Restricted connection - show paywall immediately
        setIsPaywallModalOpen(true);
        return;
      }
    }

    // Allowed - open modal instantly with local data
    setSelectedTask(localTask);
    setIsTaskDetailModalOpen(true);
    
    if (commentsByTask[taskId]) {
      // Comments already available
    } else {
      fetchCommentsForTaskGlobal(taskId).then(comments => {
        setCommentsByTask(prev => ({
          ...prev,
          [taskId]: comments
        }));
      }).catch(error => {
        console.error('Error fetching comments:', error);
      });
    }
  }, [tasks, context, commentsByTask, allowedConnectionIds]);
  
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

  const handleTaskUpdate = useCallback((taskId: string, updates: { title?: string; description?: string; status?: 'to_do' | 'in_progress' | 'on_hold' | 'done'; assignee?: Task['assignee']; project?: { id: string; name: string } | null; dueDate?: string | null; dueDateRaw?: string | null; completedAtRaw?: string | null; clientVisible?: boolean; clientVisibilityLocked?: boolean }) => {
    setTasks(prev => {
      // Update the task
      const updated = prev.map(t => 
      t.id === taskId 
        ? { ...t, ...updates }
        : t
      );
      
      return updated;
    });
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
          isBootstrapping={isFetchingServerResults}
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
          allowedConnectionIds={allowedConnectionIds}
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
          isDisconnected={false}
          isGlobalView={true}
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
          allowedConnectionIds={allowedConnectionIds}
          onPaywallBlocked={() => setIsPaywallModalOpen(true)}
        />
      )}

      {/* Paywall Modal */}
      <PaywallModal 
        open={isPaywallModalOpen} 
        onOpenChange={setIsPaywallModalOpen} 
      />
    </div>
  );
}

