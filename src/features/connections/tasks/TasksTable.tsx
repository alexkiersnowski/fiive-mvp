"use client"

import { useState, useRef, useMemo, useCallback, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { SearchInput } from '@/components/ui/search-input'
import AvatarButton from '@/components/ui/avatar-button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Badge } from '@/components/ui/badge'
import type { InlineEditRef } from '@/components/ui/inline-edit'
import { ProfileCard } from '@/components/ui/profile-card'
import { Plus, SortAscending, LockSimple, ClipboardText } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { updateTaskAssignee, updateTaskStatus, deleteTask, fetchProjectsForConnection } from './actions'
import { sortTasksWithPinnedFirst, groupTasksByStatus } from './taskSort'
import type { Task, TaskStatus } from '../server'
import { useConnection } from '../ConnectionContext'
import { TaskRow } from './TaskRow'
import { StatusSection } from './StatusSection'
import { useTaskDragDrop } from './useTaskDragDrop'
import { Skeleton } from '@/components/ui/skeleton'

// Drag ghost offset from cursor (pixels from left edge of row)
const DRAG_GHOST_OFFSET_X = 200
const DRAG_GHOST_OFFSET_Y = 22 // Half of row height (44px / 2)

// Status order: In progress, To do, On hold, Done
const TASK_STATUS_ORDER: TaskStatus[] = ['in_progress', 'to_do', 'on_hold', 'done']

interface TasksTableProps {
  userAvatar?: string
  userInitials?: string
  onTaskClick?: (taskId: string) => void
  onNewTask?: () => void
  tasks?: Task[]
  agencyMembers?: Array<{
    id: string
    firstName: string
    lastName: string
    email: string
    avatarUrl?: string
    jobTitle?: string
    orgId?: string
    orgName?: string
    orgType?: 'agency' | 'client'
  }>
  onTaskUpdate?: (taskId: string, updates: { title?: string; description?: string; status?: 'to_do' | 'in_progress' | 'on_hold' | 'done'; assignee?: Task['assignee']; clientVisible?: boolean; clientVisibilityLocked?: boolean; dueDate?: string | null; dueDateRaw?: string | null; createdAtRaw?: string | null }) => void
  currentOrgId: string
  onLoadMore?: (virtualRows: Array<{ index: number; start: number; end: number; size: number }>) => void
  searchQuery?: string
  onSearchChange?: (query: string) => void
  totalCount?: number
  unfilteredTotalCount?: number
  parentRef?: React.RefObject<HTMLDivElement | null>
  assignedToMe?: boolean
  onToggleAssignedToMe?: () => void
  isBootstrapping?: boolean
  isAgency?: boolean
  agencyOrganization?: {
    id: string
    name: string
    logoUrl?: string
  }
  onTaskDeleted?: (taskId: string) => void
  statusCounts?: Record<string, number> // Server-side status counts to prevent flicker
}

export default function TasksTable({ userAvatar = '', userInitials = 'U', onTaskClick, onNewTask, tasks = [], agencyMembers = [], onTaskUpdate, currentOrgId: _currentOrgId, onLoadMore, searchQuery = '', onSearchChange, totalCount, unfilteredTotalCount = 0, parentRef, assignedToMe = false, onToggleAssignedToMe, isBootstrapping = false, isAgency = false, agencyOrganization, onTaskDeleted, statusCounts: statusCountsProp }: TasksTableProps) {
  const { isDisconnected } = useConnection()
  const pathname = usePathname()
  const baseRoute = pathname.includes('/clients/') ? 'clients' : 'agencies'
  
  const [openActionsDropdown, setOpenActionsDropdown] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  
  // Client-side sorting function (applied to tasks prop)
  const orderTasks = useCallback((list: Task[]) => sortTasksWithPinnedFirst(list), [])
  
  // Apply sorting to tasks prop
  const orderedTasks = useMemo(() => orderTasks(tasks), [tasks, orderTasks])
  
  // Group tasks by status (always grouped, even when filtering)
  const tasksByStatus = useMemo(() => {
    return groupTasksByStatus(orderedTasks)
  }, [orderedTasks])

  // Compute filtered counts per status (for status headers when filtering)
  const filteredStatusCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const status of TASK_STATUS_ORDER) {
      counts[status] = tasksByStatus[status]?.length || 0
    }
    return counts
  }, [tasksByStatus])
  
  const statusInlineRefs = useRef<Record<string, InlineEditRef | null>>({})
  
  const clientEditableMembers = useMemo(() => {
    const idSet = new Set<string>()
    const options = agencyMembers
      .filter(member => member.orgType === 'client')
      .map(member => {
        if (member.id) {
          idSet.add(member.id)
        }
        const fullName = `${member.firstName} ${member.lastName}`.trim()
        return {
          value: member.id,
          label: fullName || member.email,
          avatar: member.avatarUrl,
          email: member.email
        }
      })
    return {
      idSet,
      options
    }
  }, [agencyMembers])
  
  // Loading guard refs to prevent rapid-fire mutations
  const isMutingAssignee = useRef(false)
  
  // Track pending status updates per task ID to prevent flickering
  const pendingStatusUpdatesRef = useRef<Map<string, { status: string; abortController: AbortController }>>(new Map())
  
  // Profile Card state
  const [profileDialogOpen, setProfileDialogOpen] = useState(false)
  const [selectedContact, setSelectedContact] = useState<{
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    avatar_url?: string;
    organization: {
      id: string;
      name: string;
      logo_url?: string;
    };
  } | null>(null)

  // Use total count from database, fallback to displayed tasks count if not provided
  const taskCount = totalCount !== undefined ? totalCount : tasks.length
  
  // Transform agency members to combobox options (memoized to prevent recreation)
  const comboboxOptions = useMemo(() => 
    agencyMembers.map(member => {
      const fullName = `${member.firstName} ${member.lastName}`.trim()
      return {
        value: member.id,
        label: fullName || member.email,
        avatar: member.avatarUrl,
        email: member.email,
        orgName: member.orgName,
        orgType: member.orgType
      }
    }),
    [agencyMembers]
  )

  // Sort options (memoized to prevent recreation)
  const currentSortLabel = 'Created'

  // Assignee handlers with loading guard
  const handleAssigneeSelect = useCallback(async (taskId: string, memberId: string) => {
    // Prevent rapid-fire mutations
    if (isMutingAssignee.current) return
    
    const selectedMember = agencyMembers.find(member => member.id === memberId)
    if (selectedMember) {
      const isClientMember = selectedMember.orgType === 'client'
      const newAssignee = {
        id: memberId,
        name: `${selectedMember.firstName} ${selectedMember.lastName}`,
        email: selectedMember.email,
        avatarUrl: selectedMember.avatarUrl
      }
      
      // Get current task to check visibility state
      const currentTask = tasks.find(t => t.id === taskId);
      const currentVisibility = currentTask?.clientVisible ?? false;
      
      // Build update object
      const updates: { assignee: Task['assignee']; clientVisible?: boolean; clientVisibilityLocked?: boolean } = {
        assignee: newAssignee
      };
      
      if (isClientMember) {
        // Only change visibility to true if it's currently false
        if (!currentVisibility) {
          updates.clientVisible = true;
        }
        updates.clientVisibilityLocked = true;
      }
      // If assigning to agency member, don't change visibility (keep as-is)
      
      // Notify parent for bidirectional updates (table → modal)
      if (onTaskUpdate) {
        onTaskUpdate(taskId, updates)
      }
      
      // Set loading guard
      isMutingAssignee.current = true
      
      try {
        await updateTaskAssignee(taskId, memberId)
        // Real-time subscription will handle UI updates
      } catch (error) {
        if (process.env.NODE_ENV !== 'production') {
          console.error('Failed to update assignee:', error)
        }
        toast.error('Failed to update assignee')
        // Revert parent state on error
        if (onTaskUpdate) {
          const originalTask = tasks.find(r => r.id === taskId)
          if (originalTask) {
            onTaskUpdate(taskId, { assignee: originalTask.assignee })
          }
        }
      } finally {
        // Clear loading guard
        isMutingAssignee.current = false
      }
    }
  }, [agencyMembers, tasks, onTaskUpdate])

  const handleClearAssignee = useCallback(async (taskId: string) => {
    // Prevent rapid-fire mutations
    if (isMutingAssignee.current) return
    
    // Notify parent for bidirectional updates (table → modal)
    if (onTaskUpdate) {
      onTaskUpdate(taskId, { assignee: null, clientVisibilityLocked: false })
    }
    
    // Set loading guard
    isMutingAssignee.current = true
    
    try {
      await updateTaskAssignee(taskId, null)
      // Real-time subscription will handle UI updates
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Failed to clear assignee:', error)
      }
      toast.error('Failed to clear assignee')
      // Revert parent state on error
      if (onTaskUpdate) {
        const originalTask = tasks.find(r => r.id === taskId)
        if (originalTask) {
          onTaskUpdate(taskId, { assignee: originalTask.assignee })
        }
      }
    } finally {
      // Clear loading guard
      isMutingAssignee.current = false
    }
  }, [onTaskUpdate, tasks])

  // Status handler with loading guard and pending update tracking
  const handleStatusChange = useCallback(async (taskId: string, newStatus: string): Promise<void> => {
    const validStatuses = ['to_do', 'in_progress', 'on_hold', 'done'] as const
    if (!(validStatuses as readonly string[]).includes(newStatus)) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Invalid status:', newStatus)
      }
      return
    }
    
    const typedStatus = newStatus as TaskStatus
    
    // Cancel any existing pending update for this task
    const existingPending = pendingStatusUpdatesRef.current.get(taskId)
    if (existingPending) {
      existingPending.abortController.abort()
      pendingStatusUpdatesRef.current.delete(taskId)
    }
    
    // Create new AbortController for this update
    const abortController = new AbortController()
    pendingStatusUpdatesRef.current.set(taskId, {
      status: typedStatus,
      abortController
    })
    
    // Notify parent for bidirectional updates (table → modal)
    if (onTaskUpdate) {
      onTaskUpdate(taskId, { status: typedStatus })
    }
    
    try {
      await updateTaskStatus(taskId, typedStatus)
      
      // Check if this update is still the latest before applying
      const pendingUpdate = pendingStatusUpdatesRef.current.get(taskId)
      if (pendingUpdate && pendingUpdate.status === typedStatus && !abortController.signal.aborted) {
        // Real-time subscription will handle UI updates
      }
      // If update was superseded, don't apply changes
    } catch (error) {
      // Only handle error if this update is still the latest
      const pendingUpdate = pendingStatusUpdatesRef.current.get(taskId)
      if (pendingUpdate && pendingUpdate.status === typedStatus && !abortController.signal.aborted) {
        if (process.env.NODE_ENV !== 'production') {
          console.error('Failed to update status:', error)
        }
        toast.error('Failed to update status')
        // Revert parent state on error
        if (onTaskUpdate) {
          const originalTask = tasks.find(r => r.id === taskId)
          if (originalTask) {
            onTaskUpdate(taskId, { status: originalTask.status })
          }
        }
      }
    } finally {
      // Clean up pending update if this was the latest one
      const pendingUpdate = pendingStatusUpdatesRef.current.get(taskId)
      if (pendingUpdate && pendingUpdate.status === typedStatus) {
        pendingStatusUpdatesRef.current.delete(taskId)
      }
    }
  }, [onTaskUpdate, tasks])

  // Profile Card handler
  const handleContactClick = (contact: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    avatar_url?: string;
    job_title?: string;
    organization: {
      id: string;
      name: string;
      logo_url?: string;
    };
  }) => {
    setSelectedContact(contact);
    setProfileDialogOpen(true);
  };

  // Navigation handler - prevent click if drag occurred
  const handleRowClick = useCallback((taskId: string) => {
    // Prevent modal opening if drag occurred
    // hasDragged is managed by useTaskDragDrop hook
    onTaskClick?.(taskId)
  }, [onTaskClick])
  
  // Check if user can drag a task (same permissions as editing status)
  const canDragTask = useCallback((task: Task) => {
    if (isDisconnected) return false
    if (isAgency) return true
    // Client can drag if task is assigned to them
    return task.assignee ? clientEditableMembers.idSet.has(task.assignee.id) : false
  }, [isDisconnected, isAgency, clientEditableMembers])
  
  // Use drag & drop hook (simplified logic)
  const {
    draggedTaskId,
    dragStartPosition,
    hoveredGroupStatus,
    dragOffset,
    hasDragged,
    handleDragStart,
    dragGhostProps
  } = useTaskDragDrop({
    onStatusChange: async (taskId, newStatus) => {
      await handleStatusChange(taskId, newStatus)
    },
    onTaskUpdate,
    tasks,
    containerRef,
    parentRef,
    openActionsDropdown
  })

  // Update handleRowClick to use hasDragged from hook
  const handleRowClickWithDragCheck = useCallback((taskId: string) => {
    if (hasDragged) {
      return
    }
    onTaskClick?.(taskId)
  }, [hasDragged, onTaskClick])

  const handleCopyLink = (taskId: string, connectionId: string) => {
    const fullUrl = `${window.location.origin}/${baseRoute}/${connectionId}/tasks/${taskId}`
    navigator.clipboard.writeText(fullUrl).then(() => {
      toast.success('Link copied to clipboard')
    }).catch(() => {
      toast.error('Failed to copy link')
    })
  }
  
  const handleDeleteTask = async (taskId: string) => {
    // Notify parent for badge count updates
    onTaskDeleted?.(taskId)
    
    try {
      await deleteTask(taskId)
      toast.success('Task deleted')
      // Real-time subscription will handle UI updates
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Error deleting task:', error)
      }
      toast.error('Failed to delete task')
    }
  }

  // Derived from current filter state — prevents flicker during search clear
  const hasActiveFilters = (searchQuery?.trim().length ?? 0) > 0 || assignedToMe;
  const isEmptyState = !isBootstrapping && unfilteredTotalCount === 0 && !hasActiveFilters;

  // Empty state component matching ClientsTable design
  const emptyState = isEmptyState ? (
    <div 
      className="text-left" 
      style={{ height: 'calc(100vh - 352px)', minHeight: '400px', paddingLeft: '120px', paddingTop: '40px' }}
    >
      <div className="flex flex-col items-start justify-center h-full gap-4" style={{ transform: 'translateY(-40px)' }}>
        <div className="flex flex-col items-start gap-2">
          <h2 className="display-8-medium">Your best work starts here</h2>
          <span className="text-sm-regular text-neutral-11">
            {isAgency 
              ? 'Add action items for your team or client, and choose what stays client-visible.'
              : 'Your agency manages all tasks. Submit a request to kick things off or share what you need next.'
            }
          </span>
        </div>
        {onNewTask && !isDisconnected && isAgency && (
          <Button 
            variant="outline" 
            size="sm" 
            className="h-6 shadow-none cursor-pointer transition-all duration-75 mt-4"
            onClick={onNewTask}
          >
            <Plus size={16} weight="regular" />
            New task
          </Button>
        )}
      </div>
    </div>
  ) : null

  // Scroll to top when search/filter changes
  useEffect(() => {
    if (searchQuery || assignedToMe) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }, [searchQuery, assignedToMe])

  return (
    <div className="w-full min-w-0">
      {/* Search section - Sticky */}
      <div className="sticky top-10 z-1 bg-[var(--color-base-surface-page-background)] pt-5 pb-4 px-5 rounded-t-lg relative">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-3">
            <SearchInput
              placeholder="Search tasks by title…"
              value={searchQuery || ''}
              onChange={(value) => {
                onSearchChange?.(value)
              }}
              count={taskCount}
              countLabel={(taskCount as number) === 1 ? 'task' : 'tasks'}
            />
            <Tooltip delayDuration={250}>
              <TooltipTrigger asChild>
                <Badge 
                  variant="outline" 
                  className="text-xs border-0"
                  style={{
                    borderRadius: 'var(--radius-1-max, 3px)',
                    backgroundColor: 'var(--color-neutral-3, #f0f0f3)',
                    border: 'none',
                    cursor: 'default'
                  }}
                >
                  {isAgency ? (
                    <LockSimple size={12} weight="fill" style={{ color: 'var(--color-neutral-11, #44474f)' }} />
                  ) : (
                    <ClipboardText size={12} weight="fill" style={{ color: 'var(--color-neutral-11, #44474f)' }} />
                  )}
                  <span className="ml-1" style={{ color: 'var(--color-neutral-11, #44474f)' }}>
                    Agency managed
                  </span>
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={8}>
                {isAgency 
                  ? 'Only your agency can edit this'
                  : 'Comment on all tasks and update ones assigned to you'}
              </TooltipContent>
            </Tooltip>
          </div>
          <div className="flex items-center gap-3">
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <div>
                  <AvatarButton
                    src={userAvatar}
                    fallback={userInitials}
                    className="flex items-center"
                    size="custom"
                    customSize={{ button: 'h-6 w-6', avatar: 'h-[26px] w-[26px]' }}
                    isActive={assignedToMe}
                    activeBgClassName="bg-[var(--color-interactive-surface-pressed)] hover:bg-[var(--color-interactive-surface-pressed)]"
                    onClick={() => {
                      if (onToggleAssignedToMe) {
                        onToggleAssignedToMe()
                      }
                    }}
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" align="center" sideOffset={4}>
                {isAgency ? 'Assigned to me' : 'Assigned to my team'}
              </TooltipContent>
            </Tooltip>
            <Button
              variant="outline"
              className="cursor-default text-sm-regular h-[32px] flex items-center gap-2 shadow-none pointer-events-none"
            >
              <SortAscending size={16} />
              {currentSortLabel}
            </Button>
            {isAgency && !isDisconnected && (
              <Button
                variant="default"
                size="lg"
                className="cursor-pointer text-sm flex-shrink-0 h-6"
                style={{ paddingLeft: '16px', paddingRight: '16px' }}
                onClick={() => {
                  onNewTask?.();
                }}
                onMouseEnter={() => {
                  // Prefetch projects on hover for instant modal opening
                  if (onNewTask) {
                    const connectionId = window.location.pathname.match(/\/(?:agencies|clients)\/([^/]+)/)?.[1];
                    if (connectionId) {
                      fetchProjectsForConnection(connectionId).catch(() => {
                        // Silently fail - modal will fetch on open if prefetch fails
                      });
                    }
                  }
                }}
                onFocus={() => {
                  // Prefetch projects on focus for keyboard navigation
                  if (onNewTask) {
                    const connectionId = window.location.pathname.match(/\/(?:agencies|clients)\/([^/]+)/)?.[1];
                    if (connectionId) {
                      fetchProjectsForConnection(connectionId).catch(() => {
                        // Silently fail - modal will fetch on open if prefetch fails
                      });
                    }
                  }
                }}
              >
                <Plus size={16} className="mr-1" />
                New task
              </Button>
            )}
          </div>
        </div>
        {/* Border with 20px margins to match table padding */}
        <div className="absolute bottom-0 left-5 right-5 border-b border-[var(--color-neutral-4)]" />
      </div>

      {/* List Body */}
      <div className="w-full overflow-x-auto" ref={containerRef}>
        <div className="pb-5 px-5">
          {isBootstrapping ? (
            <div className="space-y-0">
              {/* Status Group Skeleton - 1x only, starts the block */}
              <div
                className="bg-[var(--color-neutral-2)] border-b border-[var(--color-neutral-4)] h-[44px] grid items-center"
                style={{
                  gridTemplateColumns: isAgency 
                    ? '44px 4fr 3fr 3fr 3fr 3fr 44px 44px'
                    : '44px 4fr 3fr 3fr 3fr 3fr 44px',
                }}
              >
                <div className="flex items-center justify-center">
                  <Skeleton className="w-3 h-3" />
                </div>
                <div className="flex items-center gap-3 px-3">
                  <Skeleton className="w-12 h-5 rounded" />
                  <Skeleton className="w-16 h-4 rounded" />
                </div>
              </div>
              {/* Task Row Skeletons - 20 per status group */}
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20].map((taskIndex) => (
                <div
                  key={taskIndex}
                  className="border-b border-[var(--color-neutral-4)] h-[44px] grid items-center"
                  style={{
                    gridTemplateColumns: isAgency 
                      ? '44px 4fr 3fr 3fr 3fr 3fr 44px 44px'
                      : '44px 4fr 3fr 3fr 3fr 3fr 44px',
                  }}
                >
                  {/* Empty drag handle cell */}
                  <div></div>
                  {/* Title */}
                  <div className="px-3">
                    <Skeleton className="w-32 h-4 rounded" />
                  </div>
                  {/* Status */}
                  <div className="px-3">
                    <Skeleton className="w-20 h-4 rounded" />
                  </div>
                  {/* Assignee */}
                  <div className="px-3">
                    <Skeleton className="w-16 h-4 rounded" />
                  </div>
                  {/* Due Date */}
                  <div className="px-3">
                    <Skeleton className="w-24 h-4 rounded" />
                  </div>
                  {/* Project */}
                  <div className="px-3">
                    <Skeleton className="w-20 h-4 rounded" />
                  </div>
                  {isAgency && <div></div>}
                  <div></div>
                </div>
              ))}
            </div>
          ) : (
            // Always render StatusSection components (grouped by status, even when filtering)
            isEmptyState ? (
              emptyState
            ) : (
              <>
                {TASK_STATUS_ORDER.map((status: TaskStatus) => {
                  // Use filtered counts when filtering, otherwise use server counts
                  const count = hasActiveFilters 
                    ? filteredStatusCounts[status] || 0
                    : (statusCountsProp?.[status] || tasksByStatus[status]?.length || 0)
                  
                  return (
                    <StatusSection
                      key={status}
                      status={status}
                      tasks={tasksByStatus[status] || []}
                      count={count}
                      // NO isExpanded prop - StatusSection owns this
                      // NO onToggle prop - StatusSection handles toggle internally
                      onDrop={(taskId) => handleStatusChange(taskId, status)}
                      isAgency={isAgency}
                      isDisconnected={isDisconnected}
                      clientEditableMembers={clientEditableMembers}
                      comboboxOptions={comboboxOptions}
                      agencyMembers={agencyMembers}
                      agencyOrganization={agencyOrganization}
                      statusInlineRefs={statusInlineRefs}
                      onStatusChange={handleStatusChange}
                      onAssigneeSelect={handleAssigneeSelect}
                      onClearAssignee={handleClearAssignee}
                      onRowClick={handleRowClickWithDragCheck}
                      onCopyLink={handleCopyLink}
                      onDeleteTask={handleDeleteTask}
                      onContactClick={handleContactClick}
                      openActionsDropdown={openActionsDropdown}
                      setOpenActionsDropdown={setOpenActionsDropdown}
                      baseRoute={baseRoute}
                      draggedTaskId={draggedTaskId}
                      onDragStart={handleDragStart}
                      canDragTask={canDragTask}
                      isDraggingActive={draggedTaskId !== null}
                      hoveredGroupStatus={hoveredGroupStatus}
                      parentRef={parentRef}
                    />
                  )
                })}
              </>
            )
          )}
        </div>
      </div>

      {/* Drag Ghost Preview */}
      {dragGhostProps.draggedTaskId && dragGhostProps.dragStartPosition && dragGhostProps.dragOffset && (() => {
        const draggedTask = tasks.find(t => t.id === dragGhostProps.draggedTaskId)
        if (!draggedTask) return null
        
        return (
          <div
            data-ghost="true"
            style={{
              position: 'fixed',
              left: dragGhostProps.dragStartPosition!.x - DRAG_GHOST_OFFSET_X,
              top: dragGhostProps.dragStartPosition!.y - DRAG_GHOST_OFFSET_Y,
              transform: `translate(${dragGhostProps.dragOffset!.x}px, ${dragGhostProps.dragOffset!.y}px)`,
              willChange: 'transform',
              pointerEvents: 'none',
              zIndex: 9999,
              opacity: 0.9,
              width: dragGhostProps.containerWidth || 'auto',
              maxWidth: dragGhostProps.containerWidth || 'none',
              backgroundColor: 'var(--color-base-surface-page-background)',
              borderRadius: '4px'
            }}
            className="shadow-lg border border-[var(--color-neutral-6)]"
          >
            <TaskRow
              task={draggedTask}
              isAgency={isAgency}
              isDisconnected={isDisconnected}
              clientEditableMembers={clientEditableMembers}
              comboboxOptions={comboboxOptions}
              agencyMembers={agencyMembers}
              agencyOrganization={agencyOrganization}
              statusInlineRefs={statusInlineRefs}
              onStatusChange={handleStatusChange}
              onAssigneeSelect={handleAssigneeSelect}
              onClearAssignee={handleClearAssignee}
              onRowClick={() => {}}
              onCopyLink={handleCopyLink}
              onDeleteTask={handleDeleteTask}
              onContactClick={handleContactClick}
              openActionsDropdown={null}
              setOpenActionsDropdown={() => {}}
              baseRoute={baseRoute}
              isDragging={false}
              onDragStart={() => {}}
              canDrag={false}
              isGhost={true}
              isDraggingActive={true}
            />
          </div>
        )
      })()}

      {/* Profile Card Dialog */}
      {selectedContact && (
        <ProfileCard
          member={selectedContact}
          isOpen={profileDialogOpen}
          onClose={() => {
            setProfileDialogOpen(false);
            setSelectedContact(null);
          }}
        />
      )}
    </div>
  )
}
