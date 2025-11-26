"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TaskBadge } from "@/components/ui/task-badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowRight, Plus } from "@phosphor-icons/react/dist/ssr";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TaskDetailModal } from "@/features/connections/tasks/TaskDetailModal";
import { fetchTaskByIdGlobal, fetchCommentsForTaskGlobal, fetchTasksSnapshot } from "@/features/tasks/actions";
import { toast } from "sonner";
import type { Task } from "@/features/tasks/types";
import type { StatsCardProps } from "../types";
import type { Comment } from "@/features/connections/server";
import { dispatchTaskDueDateChanged, dispatchTaskStatusChanged, dispatchTaskDeleted } from "./stats/TasksDueCard";
import { dispatchTaskAssignedChanged, dispatchTaskAssignedDeleted } from "./stats/TasksAssignedCard";
import { createClient as createSupabaseBrowserClient } from '@/lib/supabase/client';

interface TasksCardClientProps extends StatsCardProps {
  tasks: Task[];
  prefetchedNextTask?: Task | null;
  agencyMembers?: Array<{
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    avatarUrl?: string;
    jobTitle?: string;
  }>;
  initialComments?: Record<string, Comment[]>;
}

export default function TasksCardClient({
  tasks,
  prefetchedNextTask = null,
  snapshot: _snapshot,
  context,
  agencyMembers = [],
  initialComments = {},
}: TasksCardClientProps) {
  const router = useRouter();
  const isAgency = context.variant === "agency";
  const title = "Tasks";
  const description = isAgency
    ? "No tasks yet. Start adding action items for your team or clients and choose which tasks are visible to clients."
    : "No tasks yet. Your agency manages all tasks. Submit a request to kick things off or share what you need next.";
  const linkText = "View all tasks";

  // Local state for tasks (to allow optimistic updates)
  const [localTasks, setLocalTasks] = useState<Task[]>(tasks);
  // Store prefetched next task for instant replacement on delete
  const [prefetchedTask, setPrefetchedTask] = useState<Task | null>(prefetchedNextTask);

  const hasTasks = localTasks.length > 0;

  // Modal state
  const [isTaskDetailModalOpen, setIsTaskDetailModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  // Initialize comments with prefetched data
  const [commentsByTask, setCommentsByTask] = useState<Record<string, Comment[]>>(initialComments);
  
  // Track client org user IDs for event dispatching (only for client context)
  const [clientOrgUserIds, setClientOrgUserIds] = useState<Set<string>>(new Set());

  // Fetch client org user IDs on mount (only for client context)
  useEffect(() => {
    if (context.variant !== 'client') {
      return;
    }

    const fetchClientOrgUserIds = async () => {
      const supabase = createSupabaseBrowserClient();
      const { data: memberships, error } = await supabase
        .from('memberships')
        .select('user_id')
        .eq('org_id', context.orgId);

      if (error || !memberships) {
        console.error('Error fetching client organization members:', error);
        return;
      }

      setClientOrgUserIds(new Set(memberships.map(m => m.user_id)));
    };

    fetchClientOrgUserIds();
  }, [context.orgId, context.variant]);

  // Sync local tasks when props change
  useEffect(() => {
    setLocalTasks(tasks);
  }, [tasks]);

  // Sync prefetched task when prop changes
  useEffect(() => {
    setPrefetchedTask(prefetchedNextTask);
  }, [prefetchedNextTask]);

  // Sync comments when initialComments prop changes (when snapshot changes, card re-fetches comments)
  useEffect(() => {
    setCommentsByTask(prev => ({
      ...prev,
      ...initialComments
    }));
  }, [initialComments]);

  const handleRowClick = useCallback(async (taskId: string) => {
    // Try to get task from local state first
    const localTask = localTasks.find(t => t.id === taskId);
    
    if (localTask) {
      // Use local task data
      setSelectedTask(localTask);
      setIsTaskDetailModalOpen(true);
      
      // Use prefetched comments if available, otherwise fetch
      if (commentsByTask[taskId]) {
        // Comments already available, no need to fetch
      } else {
        // Fetch comments if not prefetched
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
      // Fetch task if not in local state
      try {
        const task = await fetchTaskByIdGlobal(taskId, context);
        if (task) {
          setSelectedTask(task);
          setIsTaskDetailModalOpen(true);
          
          // Use prefetched comments if available, otherwise fetch
          if (commentsByTask[taskId]) {
            // Comments already available, no need to fetch
          } else {
            // Fetch comments if not prefetched
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
  }, [localTasks, context, commentsByTask]);

  const handleTaskDetailModalClose = useCallback(() => {
    setIsTaskDetailModalOpen(false);
    setSelectedTask(null);
  }, []);

  const handleExpandTask = useCallback(() => {
    if (selectedTask && selectedTask.connectionId) {
      // Determine baseRoute based on context variant
      // Agencies view clients, clients view agencies
      const baseRoute = context.variant === 'agency' ? 'clients' : 'agencies';
      const url = `/${baseRoute}/${selectedTask.connectionId}/tasks/${selectedTask.id}`;
      window.location.href = url;
    }
  }, [selectedTask, context.variant]);

  const handleTaskUpdate = useCallback((taskId: string, updates: { title?: string; description?: string; status?: 'to_do' | 'in_progress' | 'on_hold' | 'done'; assignee?: Task['assignee']; project?: { id: string; name: string } | null; dueDate?: string | null; dueDateRaw?: string | null; completedAt?: string | null; completedAtRaw?: string | null; clientVisible?: boolean; clientVisibilityLocked?: boolean }) => {
    // Find the original task to check what changed
    const originalTask = localTasks.find(t => t.id === taskId);
    const oldDueDate = originalTask?.dueDateRaw ?? null;
    const newDueDate = updates.dueDateRaw ?? originalTask?.dueDateRaw ?? null;
    const oldStatus = originalTask?.status ?? 'to_do';
    const newStatus = updates.status ?? originalTask?.status ?? 'to_do';
    const oldAssigneeUserId = originalTask?.assignee?.id ?? null;
    const newAssigneeUserId = updates.assignee?.id ?? (updates.assignee === null ? null : originalTask?.assignee?.id ?? null);
    const oldCompletedAt = originalTask?.completedAtRaw ?? null;
    const newCompletedAt = updates.completedAtRaw ?? (updates.completedAt !== undefined ? (updates.completedAt === null ? null : originalTask?.completedAtRaw ?? null) : originalTask?.completedAtRaw ?? null);

    // Optimistic update - update both the table and modal
    setLocalTasks(prev => prev.map(t => 
      t.id === taskId 
        ? { ...t, ...updates }
        : t
    ));
    // Also update selectedTask if it's the current one
    if (selectedTask && selectedTask.id === taskId) {
      setSelectedTask(prev => prev ? { ...prev, ...updates } : null);
    }

    // Dispatch events if due date or status changed (affects due soon count)
    const dueDateChanged = oldDueDate !== newDueDate;
    const statusChanged = oldStatus !== newStatus;

    if (dueDateChanged || statusChanged) {
      // If both changed, dispatch due date changed event (includes status)
      if (dueDateChanged) {
        dispatchTaskDueDateChanged({
          taskId,
          oldDueDate,
          newDueDate,
          oldStatus,
          newStatus,
        });
      } else if (statusChanged) {
        // Only status changed
        dispatchTaskStatusChanged({
          taskId,
          oldStatus,
          newStatus,
          dueDate: newDueDate,
        });
      }
    }

    // Dispatch events if assignee or completed_at changed (affects assigned count) - only for client context
    if (context.variant === 'client' && clientOrgUserIds.size > 0) {
      const assigneeChanged = oldAssigneeUserId !== newAssigneeUserId;
      const completedAtChanged = oldCompletedAt !== newCompletedAt;

      if (assigneeChanged || completedAtChanged) {
        dispatchTaskAssignedChanged({
          taskId,
          oldAssigneeUserId,
          newAssigneeUserId,
          oldCompletedAt,
          newCompletedAt,
        });
      }
    }
  }, [selectedTask, localTasks, context.variant, clientOrgUserIds]);

  const handleTaskDeleted = useCallback(async (taskId: string) => {
    // Store the deleted task for potential rollback
    const deletedTask = localTasks.find(t => t.id === taskId);
    const deletedIndex = localTasks.findIndex(t => t.id === taskId);
    const deletedStatus = deletedTask?.status ?? 'to_do';
    const deletedDueDate = deletedTask?.dueDateRaw ?? null;
    const deletedAssigneeUserId = deletedTask?.assignee?.id ?? null;
    const deletedCompletedAt = deletedTask?.completedAtRaw ?? null;
    
    // Dispatch event if deleted task was due soon
    dispatchTaskDeleted({
      taskId,
      status: deletedStatus,
      dueDate: deletedDueDate,
    });
    
    // Dispatch event if deleted task was assigned to client org member and active - only for client context
    if (context.variant === 'client' && clientOrgUserIds.size > 0) {
      dispatchTaskAssignedDeleted({
        taskId,
        assigneeUserId: deletedAssigneeUserId,
        completedAt: deletedCompletedAt,
      });
    }
    
    // Store the original prefetched task before we use it
    const originalPrefetchedTask = prefetchedTask;
    
    // Optimistically remove task from table immediately
    setLocalTasks(prev => prev.filter(t => t.id !== taskId));
    
    // Close modal immediately
    setIsTaskDetailModalOpen(false);
    setSelectedTask(null);
    
    // Instantly display prefetched next task if available
    let nextTask: Task | null = null;
    if (prefetchedTask) {
      nextTask = prefetchedTask;
      setLocalTasks(prev => {
        // Only add if we don't already have it (avoid duplicates)
        if (!prev.find(t => t.id === nextTask!.id)) {
          return [...prev, nextTask!];
        }
        return prev;
      });
      // Clear the prefetched task since we've used it
      setPrefetchedTask(null);
      
      // Prefetch the next task (6th one) for future deletions
      // Fetch starting from cursor 5 with limit 1
      fetchTasksSnapshot(context, {
        limit: 1,
        cursor: '5',
        sort: 'due_date',
      }).then(nextSnapshot => {
        if (nextSnapshot.tasks.length > 0) {
          const newPrefetched = nextSnapshot.tasks[0];
          setPrefetchedTask(newPrefetched);
          
          // Prefetch comments for the new prefetched task
          fetchCommentsForTaskGlobal(newPrefetched.id).then(comments => {
            setCommentsByTask(prev => ({
              ...prev,
              [newPrefetched.id]: comments
            }));
          }).catch(error => {
            console.error('Error fetching comments for prefetched task:', error);
          });
        }
      }).catch(error => {
        console.error('Error prefetching next task:', error);
      });
    }
    
    // Delete from database in the background
    try {
      const { deleteTask } = await import('@/features/connections/tasks/actions');
      await deleteTask(taskId);
      
      // Show success toast after server confirms
      toast.success('Task deleted');
    } catch (error) {
      // Revert optimistic updates on error
      if (deletedTask) {
        setLocalTasks(prev => {
          // Remove the optimistically added next task if it was added
          const withoutNext = nextTask 
            ? prev.filter(t => t.id !== nextTask!.id)
            : prev;
          // Insert deleted task back in the same position
          if (deletedIndex >= 0 && deletedIndex < withoutNext.length) {
            return [...withoutNext.slice(0, deletedIndex), deletedTask, ...withoutNext.slice(deletedIndex)];
          } else {
            return [...withoutNext, deletedTask];
          }
        });
        
        // Restore prefetched task if we used it
        if (nextTask && originalPrefetchedTask) {
          setPrefetchedTask(originalPrefetchedTask);
        }
        
        // Remove comments for next task if they were added
        if (nextTask) {
          setCommentsByTask(prev => {
            const { [nextTask!.id]: _, ...rest } = prev;
            return rest;
          });
        }
      }
      console.error('Error deleting task:', error);
      toast.error('Failed to delete task');
    }
  }, [localTasks, prefetchedTask, context, clientOrgUserIds]);

  return (
    <Card className="w-full h-full min-h-[370px] pt-5 pb-6 px-5 flex flex-col gap-3">
      <CardTitle className="text-xl-medium" style={{ color: "var(--color-base-text-primary)" }}>
        {title}
      </CardTitle>

      {hasTasks ? (
        <div className="mt-1">
          <Table className="table-fixed w-full border-collapse">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[40%] text-xs-regular text-[var(--color-base-text-tertiary)] truncate">
                  Name
                </TableHead>
                <TableHead className="w-[20%] text-xs-regular text-[var(--color-base-text-tertiary)] truncate">
                  Status
                </TableHead>
                <TableHead className="w-[20%] text-xs-regular text-[var(--color-base-text-tertiary)] truncate">
                  {isAgency ? "Client" : "Agency"}
                </TableHead>
                <TableHead className="w-[20%] text-xs-regular text-[var(--color-base-text-tertiary)] truncate">
                  Due
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {localTasks.map((task) => (
                <TableRow
                  key={task.id}
                  tabIndex={0}
                  className="cursor-pointer transition-colors duration-75 hover:bg-[var(--color-interactive-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--color-interactive-border-focus)]"
                  onClick={() => handleRowClick(task.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      handleRowClick(task.id);
                    }
                  }}
                >
                  <TableCell className="w-[40%] py-2">
                    <span
                      className="text-sm-regular truncate"
                      style={{ color: "var(--color-base-text-primary)" }}
                    >
                      {task.title?.trim() || "Untitled task"}
                    </span>
                  </TableCell>
                  <TableCell className="w-[20%] py-2">
                    <TaskBadge
                      variant={task.status}
                      size="sm"
                      showText
                      className="inline-flex"
                    />
                  </TableCell>
                  <TableCell className="w-[20%] py-2">
                    <div className="flex items-center gap-2">
                      {isAgency ? (
                        <>
                          <Avatar className="w-5 h-5">
                            <AvatarImage src={task.client.logoUrl} alt={task.client.name} />
                            <AvatarFallback
                              className="text-[10px] font-medium text-white"
                              style={{ background: "var(--color-neutral-9, #8B8D98)" }}
                            >
                              {task.client.name.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span
                            className="text-sm-regular truncate"
                            style={{ color: "var(--color-base-text-primary)" }}
                          >
                            {task.client.name}
                          </span>
                        </>
                      ) : (
                        <>
                          <Avatar className="w-5 h-5">
                            <AvatarImage src={task.agency?.logoUrl} alt={task.agency?.name || ""} />
                            <AvatarFallback
                              className="text-[10px] font-medium text-white"
                              style={{ background: "var(--color-neutral-9, #8B8D98)" }}
                            >
                              {task.agency?.name?.charAt(0).toUpperCase() || "A"}
                            </AvatarFallback>
                          </Avatar>
                          <span
                            className="text-sm-regular truncate"
                            style={{ color: "var(--color-base-text-primary)" }}
                          >
                            {task.agency?.name || "Unknown"}
                          </span>
                        </>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="w-[20%] py-2">
                    <span
                      className="text-sm-regular"
                      style={task.dueDate ? { color: "var(--color-base-text-primary)" } : { color: "var(--color-base-text-tertiary)" }}
                    >
                      {task.dueDate || "No due date"}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <p className="text-xs-regular text-tertiary">{description}</p>
      )}

      <div className="mt-auto flex justify-end">
        {hasTasks ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-auto p-2 text-xs-regular cursor-pointer hover:bg-interactive-surface-hover transition-all duration-75 mt-1"
            onClick={() => router.push("/tasks")}
          >
            <span className="mr-1">{linkText}</span>
            <ArrowRight size={16} weight="regular" />
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="h-6 shadow-none cursor-pointer transition-all duration-75"
            onClick={() => router.push("/tasks")}
          >
            <Plus size={16} weight="regular" />
            {isAgency ? "Add task" : "View all tasks"}
          </Button>
        )}
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
          agencyMembers={agencyMembers}
          projects={[]} // Projects not needed for card view
          isOpen={isTaskDetailModalOpen}
          onClose={handleTaskDetailModalClose}
          onExpand={handleExpandTask}
          onTaskUpdate={(taskId, updates) => {
            handleTaskUpdate(taskId, updates);
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
          isGlobalView={true}
        />
      )}
    </Card>
  );
}

