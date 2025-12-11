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
import { useVirtualTable, VirtualListBody } from '@/components/virtual-table'
import { useConnection } from '../ConnectionContext'
import type { VirtualItem } from '@tanstack/react-virtual'
import { TaskGroupHeader } from './TaskGroupHeader'
import { TaskRow } from './TaskRow'
import { useStableSet } from '../useStableCollapseState'
import { Skeleton } from '@/components/ui/skeleton'

// Drag ghost offset from cursor (pixels from left edge of row)
const DRAG_GHOST_OFFSET_X = 200
const DRAG_GHOST_OFFSET_Y = 22 // Half of row height (44px / 2)

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
  onLoadMore?: (virtualRows: VirtualItem[]) => void
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
}

export default function TasksTable({ userAvatar = '', userInitials = 'U', onTaskClick, onNewTask, tasks = [], agencyMembers = [], onTaskUpdate, currentOrgId: _currentOrgId, onLoadMore, onSearchChange, totalCount, unfilteredTotalCount = 0, parentRef, assignedToMe = false, onToggleAssignedToMe, isBootstrapping = false, isAgency = false, agencyOrganization, onTaskDeleted }: TasksTableProps) {
  const { isDisconnected } = useConnection()
  const pathname = usePathname()
  const baseRoute = pathname.includes('/clients/') ? 'clients' : 'agencies'
  
  const [searchQuery, setSearchQuery] = useState('')
  const [openActionsDropdown, setOpenActionsDropdown] = useState<string | null>(null)
  
  // Track collapsed groups with stable references (default: only 'done' collapsed)
  const collapsedGroupsState = useStableSet<TaskStatus>(new Set(['done']))
  
  // Drag & drop state
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null)
  const [dragStartPosition, setDragStartPosition] = useState<{ x: number; y: number } | null>(null)
  const [hoveredGroupStatus, setHoveredGroupStatus] = useState<TaskStatus | null>(null)
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null)
  const [hasDragged, setHasDragged] = useState(false)
  const dragStartRef = useRef<{ taskId: string; startX: number; startY: number } | null>(null)
  const hoverDetectionThrottleRef = useRef<number | null>(null)
  
  // Client-side sorting function (applied to tasks prop)
  const orderTasks = useCallback((list: Task[]) => sortTasksWithPinnedFirst(list), [])
  
  // Apply sorting to tasks prop
  const orderedTasks = useMemo(() => orderTasks(tasks), [tasks, orderTasks])
  
  // Group tasks by status and create flattened array structure
  type FlattenedItem = 
    | { type: 'group'; status: TaskStatus; count: number }
    | { type: 'task'; task: Task }
  
  const flattenedItems = useMemo<FlattenedItem[]>(() => {
    const grouped = groupTasksByStatus(orderedTasks)
    // Order: In progress, To do, On hold, Done
    const statusOrder: TaskStatus[] = ['in_progress', 'to_do', 'on_hold', 'done']
    const items: FlattenedItem[] = []
    
    for (const status of statusOrder) {
      const groupTasks = grouped[status]
      // Always show group header, even if 0 tasks
      items.push({ type: 'group', status, count: groupTasks.length })
      
      // Add tasks if group is not collapsed and has tasks
      if (!collapsedGroupsState.set.has(status) && groupTasks.length > 0) {
        for (const task of groupTasks) {
          items.push({ type: 'task', task })
        }
      }
    }
    
    return items
  }, [orderedTasks, collapsedGroupsState.set])
  
  // Toggle group collapse/expand - prevent during drag - uses stable reference hook
  const toggleGroup = useCallback((status: TaskStatus) => {
    // Don't toggle if dragging
    if (draggedTaskId !== null) {
      return
    }
    collapsedGroupsState.toggle(status)
  }, [draggedTaskId, collapsedGroupsState])
  
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
  const handleAssigneeSelect = async (taskId: string, memberId: string) => {
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
  }

  const handleClearAssignee = async (taskId: string) => {
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
  }

  // Status handler with loading guard and pending update tracking
  const handleStatusChange = useCallback(async (taskId: string, newStatus: string): Promise<void> => {
    const validStatuses = ['to_do', 'in_progress', 'on_hold', 'done'] as const
    if (!(validStatuses as readonly string[]).includes(newStatus)) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Invalid status:', newStatus)
      }
      return
    }
    
    const typedStatus = newStatus as 'to_do' | 'in_progress' | 'on_hold' | 'done'
    
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
    if (hasDragged) {
      return
    }
    onTaskClick?.(taskId)
  }, [hasDragged, onTaskClick])
  
  // Check if user can drag a task (same permissions as editing status)
  const canDragTask = useCallback((task: Task) => {
    if (isDisconnected) return false
    if (isAgency) return true
    // Client can drag if task is assigned to them
    return task.assignee ? clientEditableMembers.idSet.has(task.assignee.id) : false
  }, [isDisconnected, isAgency, clientEditableMembers])
  
  // Handle drag start (mouse down on task row)
  const handleDragStart = useCallback((taskId: string, e: React.MouseEvent) => {
    // Only allow drag if user has permission
    const task = tasks.find(t => t.id === taskId)
    if (!task || !canDragTask(task)) {
      return
    }
    
    // Prevent drag if dropdown is open or other interactions are active
    if (openActionsDropdown !== null) {
      return
    }
    
    dragStartRef.current = {
      taskId,
      startX: e.clientX,
      startY: e.clientY
    }
    setDragStartPosition({ x: e.clientX, y: e.clientY })
    setHasDragged(false)
  }, [tasks, canDragTask, openActionsDropdown])
  
  // Handle mouse move during drag
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragStartRef.current) return
    
    const { taskId, startX, startY } = dragStartRef.current
    const deltaX = Math.abs(e.clientX - startX)
    const deltaY = Math.abs(e.clientY - startY)
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)
    
    // 10px threshold to start drag
    if (distance > 10) {
      if (!draggedTaskId) {
        setDraggedTaskId(taskId)
        setHasDragged(true)
      }
      
      // Update drag offset for ghost positioning (always update for smooth ghost movement)
      setDragOffset({
        x: e.clientX - startX,
        y: e.clientY - startY
      })
      
      // Throttle hover detection to prevent jank (check every 50ms instead of every mousemove)
      if (hoverDetectionThrottleRef.current === null) {
        hoverDetectionThrottleRef.current = window.requestAnimationFrame(() => {
          hoverDetectionThrottleRef.current = null
          
          // Simple detection: get all elements at cursor, skip ghost, find group
          const elementsAtPoint = document.elementsFromPoint(e.clientX, e.clientY)
          let groupStatus: TaskStatus | null = null
          
          for (const element of elementsAtPoint) {
            const htmlElement = element as HTMLElement
            
            // Skip ghost element
            if (htmlElement.closest('[data-ghost]') || htmlElement.getAttribute('data-ghost') === 'true') {
              continue
            }
            
            // Traverse up from this element to find group header or task row
            let currentElement: HTMLElement | null = htmlElement
            while (currentElement) {
              // Check for group header first
              const groupAttr = currentElement.getAttribute('data-group-status')
              if (groupAttr && ['in_progress', 'to_do', 'on_hold', 'done'].includes(groupAttr)) {
                groupStatus = groupAttr as TaskStatus
                break
              }
              
              // Check for task row status
              const taskAttr = currentElement.getAttribute('data-task-status')
              if (taskAttr && ['in_progress', 'to_do', 'on_hold', 'done'].includes(taskAttr)) {
                groupStatus = taskAttr as TaskStatus
                break
              }
              
              // Stop if we've reached the document body
              if (currentElement === document.body || currentElement === document.documentElement) {
                break
              }
              
              currentElement = currentElement.parentElement
            }
            
            // If we found a group, we're done
            if (groupStatus) {
              break
            }
          }
          
          // Set hovered group status
          setHoveredGroupStatus(groupStatus)
        })
      }
    }
  }, [draggedTaskId])
  
  // Handle mouse up (drop or cancel)
  const handleMouseUp = useCallback(() => {
    if (!dragStartRef.current) return
    
    const { taskId } = dragStartRef.current
    
    // If we were dragging and have a valid drop target
    if (draggedTaskId === taskId && hoveredGroupStatus) {
      const draggedTask = tasks.find(t => t.id === taskId)
      // Only update if status actually changed
      if (draggedTask && draggedTask.status !== hoveredGroupStatus) {
        // Store original status for error recovery
        const originalStatus = draggedTask.status
        
        // Call status change with error recovery
        handleStatusChange(taskId, hoveredGroupStatus).catch(() => {
          // If status change fails, ensure UI is reverted immediately
          // onTaskUpdate callback in handleStatusChange should handle this,
          // but we ensure it happens here as well for drag operations
          if (onTaskUpdate) {
            const currentTask = tasks.find(t => t.id === taskId)
            if (currentTask && currentTask.status !== originalStatus) {
              onTaskUpdate(taskId, { status: originalStatus })
            }
          }
        })
      }
    }
    
    // Reset drag state
    dragStartRef.current = null
    setDraggedTaskId(null)
    setDragStartPosition(null)
    setHoveredGroupStatus(null)
    setDragOffset(null)
    
    // Reset hasDragged after a short delay to allow click handler to check it
    setTimeout(() => {
      setHasDragged(false)
    }, 100)
  }, [draggedTaskId, hoveredGroupStatus, tasks, handleStatusChange, onTaskUpdate])
  
  // Attach document-level mouse event listeners when dragging
  useEffect(() => {
    if (dragStartPosition) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      // Prevent text selection during drag
      document.body.style.userSelect = 'none'
      document.body.style.cursor = 'grabbing'
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
        document.body.style.userSelect = ''
        document.body.style.cursor = ''
      }
    }
  }, [dragStartPosition, handleMouseMove, handleMouseUp])
  
  // Handle mouse leave document (cancel drag)
  useEffect(() => {
    const handleMouseLeave = () => {
      if (dragStartRef.current) {
        dragStartRef.current = null
        setDraggedTaskId(null)
        setDragStartPosition(null)
        setHoveredGroupStatus(null)
        setDragOffset(null)
        setHasDragged(false)
        // Reset body styles
        document.body.style.userSelect = ''
        document.body.style.cursor = ''
      }
    }
    
    document.addEventListener('mouseleave', handleMouseLeave)
    return () => {
      document.removeEventListener('mouseleave', handleMouseLeave)
    }
  }, [])
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (dragStartRef.current) {
        dragStartRef.current = null
        setDraggedTaskId(null)
        setDragStartPosition(null)
        setHoveredGroupStatus(null)
        setDragOffset(null)
        setHasDragged(false)
        document.body.style.userSelect = ''
        document.body.style.cursor = ''
      }
      // Cancel any pending hover detection
      if (hoverDetectionThrottleRef.current !== null) {
        cancelAnimationFrame(hoverDetectionThrottleRef.current)
        hoverDetectionThrottleRef.current = null
      }
    }
  }, [])

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

  // Virtual scroll setup using shared hook (now works with flattened items)
  const { containerRef, rowVirtualizer, virtualItems, isNearEnd: _isNearEnd } = useVirtualTable({
    items: flattenedItems,
    onLoadMore,
    scrollRestoreDeps: [searchQuery],
    parentRef
  })
  
  // isNearEnd available for future use (e.g., showing loading indicator)

  // Derived from current filter state — prevents flicker during search clear
  const hasActiveFilters = searchQuery.trim().length > 0 || assignedToMe;
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

  return (
    <div className="w-full min-w-0">
      {/* Search section - Sticky */}
      <div className="sticky top-10 z-1 bg-[var(--color-base-surface-page-background)] pt-5 pb-4 px-5 rounded-t-lg relative">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-3">
            <SearchInput
              placeholder="Search tasks by title…"
              value={searchQuery}
              onChange={(value) => {
                setSearchQuery(value)
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

      {/* List Body - Virtualized Scrollable */}
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
            <VirtualListBody
              items={flattenedItems}
              virtualItems={virtualItems}
              rowVirtualizer={rowVirtualizer}
              emptyState={isEmptyState ? emptyState : undefined}
              getItemKey={(item) => {
                if (item.type === 'group') {
                  return `group-${item.status}`
                }
                return `task-${item.task.id}`
              }}
              renderItem={(item) => {
                if (item.type === 'group') {
                  // Check if this is the first group (In progress is always first)
                  const isFirstGroup = item.status === 'in_progress'
                  return (
                    <TaskGroupHeader
                      status={item.status}
                      count={item.count}
                      isExpanded={!collapsedGroupsState.set.has(item.status)}
                      onToggle={() => toggleGroup(item.status)}
                      isAgency={isAgency}
                      isDragHovered={hoveredGroupStatus === item.status && draggedTaskId !== null}
                      isFirstGroup={isFirstGroup}
                      isDraggingActive={draggedTaskId !== null}
                    />
                  )
                }
                const isDragging = draggedTaskId === item.task.id
                return (
                  <TaskRow
                    task={item.task}
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
                    onRowClick={handleRowClick}
                    onCopyLink={handleCopyLink}
                    onDeleteTask={handleDeleteTask}
                    onContactClick={handleContactClick}
                    openActionsDropdown={openActionsDropdown}
                    setOpenActionsDropdown={setOpenActionsDropdown}
                    baseRoute={baseRoute}
                    isDragging={isDragging}
                    onDragStart={handleDragStart}
                    canDrag={canDragTask(item.task)}
                    isDraggingActive={draggedTaskId !== null}
                  />
                )
              }}
            />
          )}
        </div>
      </div>

      {/* Drag Ghost Preview */}
      {draggedTaskId && dragStartPosition && dragOffset && (() => {
        const draggedTask = tasks.find(t => t.id === draggedTaskId)
        if (!draggedTask) return null
        
        // Calculate current cursor position
        const currentX = dragStartPosition.x + dragOffset.x
        const currentY = dragStartPosition.y + dragOffset.y
        
        return (
          <div
            data-ghost="true"
            style={{
              position: 'fixed',
              left: currentX - DRAG_GHOST_OFFSET_X,
              top: currentY - DRAG_GHOST_OFFSET_Y,
              pointerEvents: 'none',
              zIndex: 9999,
              opacity: 0.9,
              width: containerRef.current?.offsetWidth || 'auto',
              maxWidth: containerRef.current?.offsetWidth || 'none',
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
