"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { ListRow } from "@/components/ui/list-row";
import { Plus, ClipboardText, LockSimple, ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { CheckCircle, Eye, EyeSlash } from "@phosphor-icons/react";
import { toast } from "sonner";

import { useConnection } from "../ConnectionContext";
import { TaskDetailModal } from "../tasks/TaskDetailModal";
import { NewTaskModal } from "../tasks/NewTaskModal";
import { deleteTask } from "../tasks/actions";
import type { Task } from "../server";
import { sortMembersWithActiveFirst, type MemberSummary } from "../utils/memberSorting";

type PrefetchedComment = {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  createdAt: string;
  text: string;
};

type CommentItem = {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  createdAt: Date;
  text: string;
};

type ProjectOption = {
  id: string;
  name: string;
};

type TaskDetailPayload = {
  taskId: string;
  title: string;
  description: string;
  client?: { id: string; name: string; logoUrl?: string };
  agency?: { id: string; name: string; logoUrl?: string };
  submittedBy?: { id: string; name: string; email: string; avatarUrl?: string };
  assignee?: { id: string; name: string; email: string; avatarUrl?: string } | null;
  project?: { id: string; name: string } | null;
  status?: "to_do" | "in_progress" | "on_hold" | "done";
  createdAt?: string;
  createdByOrgId?: string;
  createdByOrgType?: "agency" | "client";
  dueDate?: string | null;
  dueDateRaw?: string | null;
  clientVisible?: boolean;
  clientVisibilityLocked?: boolean;
  sourceRequestId?: string | null;
  linkedRequest?: {
    id: string;
    title: string;
    createdAt: string;
    createdByUserId?: string;
    createdByName?: string;
  } | null;
};

type PrefetchedTask = {
  id: string;
  title: string;
  createdAt: string | null;
  dueDate?: string | null;
  detail: TaskDetailPayload;
  comments: PrefetchedComment[];
};

interface TasksCardClientProps {
  connectionId: string;
  tasks: PrefetchedTask[];
  prefetchedNextTask?: PrefetchedTask | null;
  projects: ProjectOption[];
  members: MemberSummary[];
}

const formatTaskDate = (isoDate: string | null | undefined) => {
  if (!isoDate) return "";

  const parsedDate = new Date(isoDate);
  if (Number.isNaN(parsedDate.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(parsedDate);
};

const getTaskMetadata = (task: PrefetchedTask) => {
  if (task.dueDate) {
    return formatTaskDate(task.dueDate) || "—";
  }
  return formatTaskDate(task.createdAt) || "—";
};

export function TasksCardClient({ connectionId, tasks, prefetchedNextTask = null, projects: initialProjects, members }: TasksCardClientProps) {
  const { snapshot, context, isDisconnected } = useConnection();
  const router = useRouter();
  const pathname = usePathname();

  const [prefetchedTasks, setPrefetchedTasks] = useState<PrefetchedTask[]>(tasks);
  // Store prefetched next task for instant replacement on delete
  const [prefetchedTask, setPrefetchedTask] = useState<PrefetchedTask | null>(prefetchedNextTask);
  // Maintain projects in state to keep in sync with events
  const [projects, setProjects] = useState<ProjectOption[]>(initialProjects);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<TaskDetailPayload | null>(null);
  const [selectedComments, setSelectedComments] = useState<CommentItem[]>([]);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  
  // Track if modal is closing to prevent reopening during close animation
  const isClosingModalRef = useRef(false);

  useEffect(() => {
    setPrefetchedTasks(tasks);
  }, [tasks]);

  // Sync prefetched task when prop changes
  useEffect(() => {
    setPrefetchedTask(prefetchedNextTask);
  }, [prefetchedNextTask]);

  // Sync projects when prop changes (e.g., on page refresh)
  useEffect(() => {
    setProjects(initialProjects);
  }, [initialProjects]);

  // Listen for project creation and updates to keep projects list in sync
  useEffect(() => {
    const handleProjectCreated = (event: CustomEvent) => {
      const { projectId, connectionId: eventConnectionId, title } = event.detail;
      
      // Only handle events for this connection
      if (eventConnectionId !== connectionId) {
        return;
      }

      // Add new project to projects list (avoid duplicates)
      setProjects((prev) => {
        if (prev.some(p => p.id === projectId)) {
          return prev;
        }
        return [{ id: projectId, name: title }, ...prev];
      });
    };

    const handleProjectUpdated = (event: CustomEvent) => {
      const { projectId, connectionId: eventConnectionId, title } = event.detail;
      
      // Only handle events for this connection
      if (eventConnectionId !== connectionId) {
        return;
      }

      // Update project name in projects list
      setProjects((prev) =>
        prev.map((p) => (p.id === projectId ? { ...p, name: title } : p))
      );
    };

    window.addEventListener('projectCreated', handleProjectCreated as EventListener);
    window.addEventListener('projectUpdated', handleProjectUpdated as EventListener);
    return () => {
      window.removeEventListener('projectCreated', handleProjectCreated as EventListener);
      window.removeEventListener('projectUpdated', handleProjectUpdated as EventListener);
    };
  }, [connectionId]);

  // Listen for project updates (e.g., when project title is updated in ProjectDetailModal)
  useEffect(() => {
    const handleProjectUpdated = (event: CustomEvent) => {
      const { projectId, connectionId: eventConnectionId, title } = event.detail;
      
      // Only handle events for this connection
      if (eventConnectionId !== connectionId) {
        return;
      }

      // Update project name in all tasks that reference this project
      setPrefetchedTasks((prev) =>
        prev.map((task) => {
          const project = task.detail.project;
          if (project && project.id === projectId) {
            return {
              ...task,
              detail: {
                ...task.detail,
                project: {
                  id: project.id,
                  name: title,
                },
              },
            };
          }
          return task;
        })
      );

      // Update selected task if it references this project
      setSelectedTask((prev) => {
        if (prev && prev.project && prev.project.id === projectId) {
          return {
            ...prev,
            project: {
              id: prev.project.id,
              name: title,
            },
          };
        }
        return prev;
      });
    };

    window.addEventListener('projectUpdated', handleProjectUpdated as EventListener);
    return () => {
      window.removeEventListener('projectUpdated', handleProjectUpdated as EventListener);
    };
  }, [connectionId]);

  const isAgency = context.variant === "agency";
  const title = "Tasks";
  const description = isAgency
    ? "Add action items for your team or client, and choose what stays client-visible."
    : "Your agency manages all tasks. Submit a request to get started.";

  const hasTasks = prefetchedTasks.length > 0;

  const sortedMembers = useMemo(
    () => sortMembersWithActiveFirst(members, context.user?.id),
    [members, context.user?.id]
  );

  const baseRoute = useMemo(() => {
    if (pathname) {
      const [, segment] = pathname.split("/");
      if (segment === "clients" || segment === "agencies") {
        return segment;
      }
    }
    return context.variant === "agency" ? "agencies" : "clients";
  }, [pathname, context.variant]);

  const mapTaskToPrefetched = useCallback(
    (task: Task): PrefetchedTask => ({
      id: task.id,
      title: task.title,
      createdAt: task.createdAt,
      dueDate: task.dueDate ?? undefined,
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
      comments: [],
    }),
    []
  );

  // Listen for task creation events (e.g., from RequestsCard converting a request to task)
  useEffect(() => {
    const handleTaskCreated = async (event: CustomEvent) => {
      const { taskId, connectionId: eventConnectionId, title, description, status, project, assignee, dueDateRaw, clientVisible } = event.detail;
      
      // Only handle events for this connection
      if (eventConnectionId !== connectionId) {
        return;
      }

      // Create optimistic task entry
      const isoNow = new Date().toISOString();
      const displayDate = formatTaskDate(isoNow) || isoNow;

      const assigneeMember = assignee?.id
        ? sortedMembers.find((member) => member.id === assignee.id)
        : undefined;

      const optimisticTask: PrefetchedTask = {
        id: taskId,
        title,
        createdAt: displayDate,
        dueDate: dueDateRaw ?? null,
        detail: {
          taskId,
          title,
          description: description || '',
          client: {
            id: snapshot.partner.id,
            name: snapshot.partner.name,
            logoUrl: snapshot.partner.logo || undefined,
          },
          agency: {
            id: snapshot.agency.id,
            name: snapshot.agency.name,
            logoUrl: snapshot.agency.logo || undefined,
          },
          submittedBy: {
            id: context.user.id,
            name: `${context.user.firstName} ${context.user.lastName}`.trim() || 'You',
            email: context.user.email,
            avatarUrl: context.user.avatarUrl,
          },
          assignee: assigneeMember
            ? {
                id: assigneeMember.id,
                name: `${assigneeMember.firstName} ${assigneeMember.lastName}`,
                email: assigneeMember.email,
                avatarUrl: assigneeMember.avatarUrl,
              }
            : null,
          project: project ?? null,
          status: status || 'to_do',
          createdAt: displayDate,
          createdByOrgId: context.organization.id,
          createdByOrgType: context.variant === 'agency' ? 'agency' : 'client',
          dueDate: dueDateRaw ?? null,
          dueDateRaw: dueDateRaw ?? null,
          clientVisible: clientVisible ?? false,
          clientVisibilityLocked: Boolean(assigneeMember && assigneeMember.orgType === 'client'),
          sourceRequestId: null,
          linkedRequest: null,
        },
        comments: [],
      };

      // Optimistically add to the list
      setPrefetchedTasks((prev) => {
        const filtered = prev.filter((item) => item.id !== taskId);
        const next = [optimisticTask, ...filtered];
        const displayed = next.slice(0, 4);
        
        // If we had 4 displayed and now have 5+, push the 5th to prefetched
        if (next.length > 4) {
          setPrefetchedTask(next[4]);
        }
        
        return displayed;
      });

      // Fetch the actual task from server to replace optimistic entry
      try {
        const { fetchTaskById, fetchCommentsForTasks } = await import('../tasks/actions');
        const [fetched, commentsRecord] = await Promise.all([
          fetchTaskById(connectionId, taskId),
          fetchCommentsForTasks([taskId]),
        ]);
        
        if (fetched) {
          const rawComments = commentsRecord[taskId] || [];
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

          const mapped: PrefetchedTask = {
            ...mapTaskToPrefetched(fetched),
            comments: serializedComments,
          };
          
          setPrefetchedTasks((prev) => {
            const filtered = prev.filter((item) => item.id !== taskId);
            const next = [mapped, ...filtered];
            const displayed = next.slice(0, 4);
            
            // If we had 4 displayed and now have 5+, push the 5th to prefetched
            if (next.length > 4) {
              setPrefetchedTask(next[4]);
            }
            
            return displayed;
          });
        }
      } catch (_error) {
        // Keep optimistic entry if fetch fails
      }
    };

    window.addEventListener('taskCreated', handleTaskCreated as unknown as EventListener);
    return () => {
      window.removeEventListener('taskCreated', handleTaskCreated as unknown as EventListener);
    };
  }, [connectionId, context, snapshot, sortedMembers, mapTaskToPrefetched]);

  const handleRowClick = useCallback(
    (taskId: string) => {
      // Prevent opening modal if we're currently closing it (prevents double flicker)
      if (isClosingModalRef.current) {
        return;
      }
      
      const target = prefetchedTasks.find((item) => item.id === taskId);
      if (!target) {
        toast.error("Unable to load task details.");
        return;
      }

      setSelectedTaskId(taskId);
      setSelectedTask(target.detail);
      setSelectedComments(
        target.comments.map((comment) => ({
          ...comment,
          createdAt: new Date(comment.createdAt),
        }))
      );
      setIsDetailModalOpen(true);
    },
    [prefetchedTasks]
  );

  const handleTaskUpdate = useCallback(
    (taskId: string, updates: {
      title?: string;
      description?: string;
      status?: "to_do" | "in_progress" | "on_hold" | "done";
      assignee?: Task['assignee'];
      project?: { id: string; name: string } | null;
      dueDate?: string | null;
      dueDateRaw?: string | null;
      clientVisible?: boolean;
      clientVisibilityLocked?: boolean;
    }) => {
      setPrefetchedTasks((prev) =>
        prev.map((item) => {
          if (item.id !== taskId) return item;

          const nextDetail: TaskDetailPayload = {
            ...item.detail,
            ...(updates.title !== undefined ? { title: updates.title } : {}),
            ...(updates.description !== undefined ? { description: updates.description } : {}),
            ...(updates.status !== undefined ? { status: updates.status } : {}),
            ...(updates.assignee !== undefined ? { assignee: updates.assignee } : {}),
            ...(updates.project !== undefined ? { project: updates.project ?? null } : {}),
            ...(updates.dueDate !== undefined ? { dueDate: updates.dueDate } : {}),
            ...(updates.dueDateRaw !== undefined ? { dueDateRaw: updates.dueDateRaw } : {}),
            ...(updates.clientVisible !== undefined ? { clientVisible: updates.clientVisible } : {}),
            ...(updates.clientVisibilityLocked !== undefined
              ? { clientVisibilityLocked: updates.clientVisibilityLocked }
              : {}),
          };

          return {
            ...item,
            title: updates.title ?? item.title,
            dueDate: updates.dueDate ?? item.dueDate,
            detail: nextDetail,
          };
        })
      );

      setSelectedTask((prev) =>
        prev && prev.taskId === taskId
          ? {
              ...prev,
              ...updates,
            }
          : prev
      );
    },
    []
  );

  const handleTaskDeleted = useCallback(
    async (taskId: string) => {
      // Store the deleted task for potential rollback
      const deletedTask = prefetchedTasks.find((item) => item.id === taskId);
      const deletedIndex = prefetchedTasks.findIndex((item) => item.id === taskId);

      // Optimistically remove from UI immediately
      setPrefetchedTasks((prev) => prev.filter((item) => item.id !== taskId));

      if (selectedTaskId === taskId) {
        setSelectedTaskId(null);
        setSelectedTask(null);
        setSelectedComments([]);
        setIsDetailModalOpen(false);
      }

      // Instantly display prefetched next task if available
      let nextTask: PrefetchedTask | null = null;
      const previousPrefetchedTask = prefetchedTask; // Store for potential rollback
      if (prefetchedTask) {
        nextTask = prefetchedTask;
        setPrefetchedTasks((prev) => {
          // Only add if we don't already have it (avoid duplicates)
          if (!prev.find(t => t.id === nextTask!.id)) {
            return [...prev, nextTask!];
          }
          return prev;
        });
        // Clear the prefetched task since we've used it
        setPrefetchedTask(null);

        // Prefetch the next task (6th one) for future deletions
        // Fetch starting from offset 5 with limit 1
        const { fetchTasksForConnection, fetchCommentsForTasks } = await import('../tasks/actions');
        fetchTasksForConnection(connectionId, {
          limit: 1,
          offset: 5,
        }).then(result => {
          if (result.tasks.length > 0) {
            const fetchedTask = result.tasks[0];
            // Map to PrefetchedTask format
            const newPrefetched: PrefetchedTask = {
              id: fetchedTask.id,
              title: fetchedTask.title,
              createdAt: fetchedTask.createdAt,
              dueDate: fetchedTask.dueDate ?? undefined,
              detail: {
                taskId: fetchedTask.id,
                title: fetchedTask.title,
                description: fetchedTask.description,
                client: fetchedTask.client,
                agency: fetchedTask.agency,
                submittedBy: fetchedTask.submittedBy,
                assignee: fetchedTask.assignee,
                project: fetchedTask.project,
                status: fetchedTask.status,
                createdAt: fetchedTask.createdAt,
                createdByOrgId: fetchedTask.createdByOrgId,
                createdByOrgType: fetchedTask.createdByOrgType,
                dueDate: fetchedTask.dueDate ?? null,
                dueDateRaw: fetchedTask.dueDateRaw ?? null,
                clientVisible: fetchedTask.clientVisible,
                clientVisibilityLocked: fetchedTask.clientVisibilityLocked,
                sourceRequestId: fetchedTask.sourceRequestId ?? null,
                linkedRequest: fetchedTask.linkedRequest ?? null,
              },
              comments: [],
            };
            setPrefetchedTask(newPrefetched);

            // Prefetch comments for the new prefetched task
            fetchCommentsForTasks([newPrefetched.id]).then(commentsRecord => {
              const rawComments = commentsRecord[newPrefetched.id] || [];
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
              setPrefetchedTask(prev => prev ? {
                ...prev,
                comments: serializedComments,
              } : null);
            }).catch(error => {
              console.error('Error fetching comments for prefetched task:', error);
            });
          }
        }).catch(error => {
          console.error('Error prefetching next task:', error);
        });
      }

      // Call API to delete from database
      try {
        await deleteTask(taskId);
        toast.success('Task deleted');
      } catch (_error) {
        // Rollback optimistic update on error
        if (deletedTask) {
          setPrefetchedTasks((prev) => {
            // Remove the optimistically added next task if it was added
            const withoutNext = nextTask 
              ? prev.filter(t => t.id !== nextTask!.id)
              : prev;
            // Insert deleted task back in the same position
            if (deletedIndex >= 0 && deletedIndex < withoutNext.length) {
              return [
                ...withoutNext.slice(0, deletedIndex),
                deletedTask,
                ...withoutNext.slice(deletedIndex),
              ];
            } else {
              return [...withoutNext, deletedTask];
            }
          });

          // Restore prefetched task if we used it
          if (nextTask && previousPrefetchedTask) {
            setPrefetchedTask(previousPrefetchedTask);
          }
        }
        toast.error('Failed to delete task');
      }
    },
    [connectionId, prefetchedTasks, prefetchedTask, selectedTaskId]
  );

  const handleDetailModalClose = useCallback(() => {
    // Set closing flag to prevent reopening during close animation
    isClosingModalRef.current = true;
    setIsDetailModalOpen(false);
    setTimeout(() => {
      setSelectedTaskId(null);
      setSelectedTask(null);
      setSelectedComments([]);
      isClosingModalRef.current = false;
    }, 300);
  }, []);

  const handleDetailModalExpand = useCallback(() => {
    if (!selectedTaskId) return;
    router.push(`/${baseRoute}/${connectionId}/tasks/${selectedTaskId}`);
  }, [baseRoute, connectionId, router, selectedTaskId]);

  const handleCommentsUpdate = useCallback(
    (comments: CommentItem[]) => {
      if (!selectedTaskId) return;

      const serialized = comments.map((comment) => ({
        id: comment.id,
        userId: comment.userId,
        userName: comment.userName,
        userAvatar: comment.userAvatar,
        createdAt: comment.createdAt.toISOString(),
        text: comment.text,
      }));

      setPrefetchedTasks((prev) =>
        prev.map((item) =>
          item.id === selectedTaskId
            ? { ...item, comments: serialized }
            : item
        )
      );

      setSelectedComments(comments);
    },
    [selectedTaskId]
  );

  const handleNewTaskOptimistic = useCallback(
    (payload: {
      tempId: string;
      title: string;
      description: string;
      projectId: string | null;
      projectName?: string | null;
      assigneeUserId: string | null;
    }) => {
      const isoNow = new Date().toISOString();
      const displayDate = formatTaskDate(isoNow) || isoNow;

      const assigneeMember =
        payload.assigneeUserId
          ? sortedMembers.find((member) => member.id === payload.assigneeUserId)
          : undefined;

      const isClientAssignee = Boolean(
        assigneeMember &&
          (assigneeMember.orgType === "client" || assigneeMember.orgId === snapshot.partner.id)
      );

      const optimisticEntry: PrefetchedTask = {
        id: payload.tempId,
        title: payload.title,
        createdAt: displayDate,
        dueDate: null,
        detail: {
          taskId: payload.tempId,
          title: payload.title,
          description: payload.description || "",
          client: {
            id: snapshot.partner.id,
            name: snapshot.partner.name,
            logoUrl: snapshot.partner.logo || undefined,
          },
          agency: {
            id: snapshot.agency.id,
            name: snapshot.agency.name,
            logoUrl: snapshot.agency.logo || undefined,
          },
          submittedBy: {
            id: context.user.id,
            name: `${context.user.firstName} ${context.user.lastName}`.trim() || "You",
            email: context.user.email,
            avatarUrl: context.user.avatarUrl,
          },
          assignee: assigneeMember
            ? {
                id: assigneeMember.id,
                name: `${assigneeMember.firstName} ${assigneeMember.lastName}`,
                email: assigneeMember.email,
                avatarUrl: assigneeMember.avatarUrl,
              }
            : null,
          project:
            payload.projectId && payload.projectName
              ? { id: payload.projectId, name: payload.projectName }
              : null,
          status: "to_do",
          createdAt: displayDate,
          createdByOrgId: context.organization.id,
          createdByOrgType: context.variant === "agency" ? "agency" : "client",
          dueDate: null,
          dueDateRaw: null,
          clientVisible: isClientAssignee,
          clientVisibilityLocked: isClientAssignee,
        },
        comments: [],
      };

      setPrefetchedTasks((prev) => {
        const filtered = prev.filter((item) => item.id !== payload.tempId);
        const next = [optimisticEntry, ...filtered];
        const displayed = next.slice(0, 4);
        
        // If we had 4 displayed and now have 5+, push the 5th to prefetched
        if (next.length > 4) {
          setPrefetchedTask(next[4]);
        }
        
        return displayed;
      });
    },
    [context.organization.id, context.user, context.variant, snapshot.agency, snapshot.partner, sortedMembers]
  );

  const handleNewTaskCreated = useCallback(
    async ({ taskId, tempId }: { taskId: string; tempId?: string }) => {
      try {
        const { fetchTaskById, fetchCommentsForTasks } = await import('../tasks/actions');
        const [fetched, commentsRecord] = await Promise.all([
          fetchTaskById(connectionId, taskId),
          fetchCommentsForTasks([taskId]),
        ]);

        if (!fetched) return;

        const rawComments = commentsRecord[taskId] || [];
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

        const mapped: PrefetchedTask = {
          ...mapTaskToPrefetched(fetched),
          comments: serializedComments,
        };

        setPrefetchedTasks((prev) => {
          const filtered = prev.filter((item) => item.id !== tempId && item.id !== mapped.id);
          const next = [mapped, ...filtered];
          const displayed = next.slice(0, 4);
          
          // If we had 4 displayed and now have 5+, push the 5th to prefetched
          if (next.length > 4) {
            setPrefetchedTask(next[4]);
          }
          
          return displayed;
        });
      } catch (error) {
        console.error("Failed to reconcile new task:", error);
      }
    },
    [connectionId, mapTaskToPrefetched]
  );

  const handleNewTaskButtonClick = useCallback(() => {
    setIsNewModalOpen(true);
  }, []);

  const handleNewTaskModalClose = useCallback(() => {
    setIsNewModalOpen(false);
  }, []);

  return (
    <Card className="w-full h-full min-h-[306px] pt-5 pb-6 px-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <CardTitle className="text-xl-medium" style={{ color: "var(--color-base-text-primary)" }}>
          {title}
        </CardTitle>
        <Tooltip delayDuration={250}>
          <TooltipTrigger asChild>
            <Badge
              variant="outline"
              className="text-xs border-0"
              style={{
                borderRadius: "var(--radius-1-max, 3px)",
                backgroundColor: "var(--color-neutral-3, #f0f0f3)",
                border: "none",
                cursor: "default",
              }}
            >
              {isAgency ? (
                <LockSimple size={12} weight="fill" style={{ color: "var(--color-neutral-11, #44474f)" }} />
              ) : (
                <ClipboardText size={12} weight="fill" style={{ color: "var(--color-neutral-11, #44474f)" }} />
              )}
              <span className="ml-1" style={{ color: "var(--color-neutral-11, #44474f)" }}>
                {isAgency ? "Agency managed" : "Agency managed"}
              </span>
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={8}>
            {isAgency
              ? "Only your agency can edit this"
              : "Comment on all tasks and update ones assigned to you"}
          </TooltipContent>
        </Tooltip>
      </div>

      {hasTasks ? (
        <div className="flex flex-col gap-3 mt-1">
          {prefetchedTasks.map((task) => {
            const visibilityIcon = (() => {
              if (!isAgency) {
                return null;
              }
              if (task.detail.clientVisible) {
                return (
                  <Eye
                    size={14}
                    weight="fill"
                    style={{ color: "var(--color-neutral-11)" }}
                  />
                );
              }
              return (
                <EyeSlash
                  size={14}
                  weight="fill"
                  style={{ color: "var(--color-neutral-11)", opacity: 0.5 }}
                />
              );
            })();

            return (
              <ListRow
                key={task.id}
                iconStart={
                  <CheckCircle
                    size={16}
                    weight="regular"
                    style={{ color: "var(--color-interactive-neutral-default)" }}
                  />
                }
                iconEnd={visibilityIcon ?? undefined}
                text={task.title}
                secondaryText={getTaskMetadata(task)}
                layout="inline"
                secondaryTextWidth="44px"
                className="px-2 cursor-pointer"
                onClick={() => handleRowClick(task.id)}
              />
            );
          })}
        </div>
      ) : (
        <p className="text-xs-regular text-tertiary">{description}</p>
      )}

      <div className="mt-auto flex justify-end">
        {!isDisconnected && isAgency ? (
          <Button
            variant="outline"
            size="sm"
            className="h-6 shadow-none cursor-pointer transition-all duration-75"
            onClick={handleNewTaskButtonClick}
          >
            <Plus size={16} weight="regular" />
            Add task
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="h-auto p-2 text-xs-regular cursor-pointer hover:bg-interactive-surface-hover transition-all duration-75 mt-1"
            onClick={() => router.push(`/${baseRoute}/${connectionId}/tasks`)}
          >
            <span className="mr-1">View all tasks</span>
            <ArrowRight size={16} weight="regular" />
          </Button>
        )}
      </div>

      <TaskDetailModal
        taskData={selectedTask}
        agencyMembers={sortedMembers}
        projects={projects}
        isOpen={isDetailModalOpen}
        onClose={handleDetailModalClose}
        onExpand={handleDetailModalExpand}
        onTaskUpdate={handleTaskUpdate}
        onTaskDeleted={handleTaskDeleted}
        connectionId={connectionId}
        currentOrgId={context.organization.id}
        variant={context.variant}
        activeUser={{
          id: context.user.id,
          firstName: context.user.firstName,
          lastName: context.user.lastName,
          avatarUrl: context.user.avatarUrl,
        }}
        initialComments={selectedComments}
        onCommentsUpdate={handleCommentsUpdate}
      />

      <NewTaskModal
        client={{
          id: snapshot.partner.id,
          name: snapshot.partner.name,
          logoUrl: snapshot.partner.logo || undefined,
        }}
        agencyMembers={sortedMembers}
        isOpen={isNewModalOpen}
        onClose={handleNewTaskModalClose}
        onTaskOptimistic={handleNewTaskOptimistic}
        onTaskCreated={handleNewTaskCreated}
        connectionId={connectionId}
        currentOrgId={context.organization.id}
        variant={context.variant}
      />
    </Card>
  );
}

export default TasksCardClient;

