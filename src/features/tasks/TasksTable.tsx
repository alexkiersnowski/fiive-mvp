"use client"

import { useState, useRef, useMemo, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { SearchInput } from '@/components/ui/search-input'
import AvatarButton from '@/components/ui/avatar-button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Badge } from '@/components/ui/badge'
import { InlineEdit, type InlineEditRef } from '@/components/ui/inline-edit'
import { ProfileCard } from '@/components/ui/profile-card'
import { Plus, SortAscending, LockSimple, ClipboardText } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { PaywallModal } from '@/components/ui/paywall-modal'
import { runWithPaywallCheck } from '@/lib/tasks-requests-helpers'
import { updateTaskAssignee, updateTaskStatus } from '@/features/connections/tasks/actions'
import type { Task } from './types'
import { useVirtualTable, VirtualListBody } from '@/components/virtual-table'
import type { VirtualItem } from '@tanstack/react-virtual'
import { dispatchTaskAssignedChanged } from '@/features/home/cards/stats/TasksAssignedCard'
import { createClient as createSupabaseBrowserClient } from '@/lib/supabase/client'
import { groupTasksByStatusAndClient, flattenGroupedTasks, type FlattenedItem, type TaskStatus } from './taskGrouping'
import { StatusGroupHeader } from './StatusGroupHeader'
import { ClientGroupHeader } from './ClientGroupHeader'
import { GlobalTaskRow } from './GlobalTaskRow'
import { usePathname } from 'next/navigation'
import { useStableSet, useStableNestedSet } from './useStableCollapseState'
import { Skeleton } from '@/components/ui/skeleton'

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
  }>
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
  }>>
  onTaskUpdate?: (taskId: string, updates: { title?: string; description?: string; status?: 'to_do' | 'in_progress' | 'on_hold' | 'done'; assignee?: Task['assignee']; clientVisible?: boolean; clientVisibilityLocked?: boolean; dueDate?: string | null; dueDateRaw?: string | null; completedAtRaw?: string | null; createdAtRaw?: string | null }) => void
  currentOrgId: string
  onLoadMore?: (virtualRows: VirtualItem[]) => void
  onSearchChange?: (query: string) => void
  totalCount?: number
  unfilteredTotalCount?: number
  parentRef?: React.RefObject<HTMLDivElement | null>
  headerOffset?: number
  assignedToMe?: boolean
  onToggleAssignedToMe?: () => void
  isBootstrapping?: boolean
  isAgency?: boolean
  onTaskDeleted?: (taskId: string) => void
  allowedConnectionIds?: string[] | null // Array of allowed connection IDs (null = no limit for paid plans)
}

export default function TasksTable({ userAvatar = '', userInitials = 'U', onTaskClick, onNewTask, tasks = [], agencyMembers = [], membersByConnection = {}, onTaskUpdate, currentOrgId, onLoadMore, onSearchChange, totalCount, unfilteredTotalCount = 0, parentRef, headerOffset = 0, assignedToMe = false, onToggleAssignedToMe, isBootstrapping = false, isAgency = false, onTaskDeleted, allowedConnectionIds = null }: TasksTableProps) {
  const pathname = usePathname()
  const baseRoute = pathname.includes('/clients/') ? 'clients' : 'agencies'
  const [searchQuery, setSearchQuery] = useState('')
  const [openActionsDropdown, setOpenActionsDropdown] = useState<string | null>(null)
  
  // Paywall modal state
  const [isPaywallModalOpen, setIsPaywallModalOpen] = useState(false)
  
  // Track client org user IDs for event dispatching (only for client context)
  const [clientOrgUserIds, setClientOrgUserIds] = useState<Set<string>>(new Set())
  
  // Track collapsed groups with stable references
  // Default: only 'done' status group collapsed
  const collapsedStatusesState = useStableSet<TaskStatus>(new Set(['done']))
  // Track collapsed client groups per status: Map<status, Set<clientId>>
  const collapsedClientsState = useStableNestedSet<TaskStatus>(new Map())

  // Fetch client org user IDs on mount (only for client context)
  useEffect(() => {
    if (isAgency) {
      return;
    }

    const fetchClientOrgUserIds = async () => {
      const supabase = createSupabaseBrowserClient();
      const { data: memberships, error } = await supabase
        .from('memberships')
        .select('user_id')
        .eq('org_id', currentOrgId);

      if (error || !memberships) {
        console.error('Error fetching client organization members:', error);
        return;
      }

      setClientOrgUserIds(new Set(memberships.map(m => m.user_id)));
    };

    fetchClientOrgUserIds();
  }, [currentOrgId, isAgency]);
  
  const statusInlineRefs = useRef<Record<string, InlineEditRef | null>>({})
  
  // Use total count from database, fallback to displayed tasks count if not provided
  const taskCount = totalCount !== undefined ? totalCount : tasks.length
  
  // Helper function to get combobox options for a specific task's connection
  const getComboboxOptionsForTask = useCallback((connectionId: string) => {
    // Use membersByConnection if available (includes both agency and client members)
    // Otherwise fall back to agencyMembers for backward compatibility
    const members = membersByConnection[connectionId] || agencyMembers;
    return members.map(member => ({
      value: member.id,
      label: `${member.firstName} ${member.lastName}`,
      avatar: member.avatarUrl,
      email: member.email,
      orgName: 'orgName' in member ? member.orgName : undefined,
      orgType: 'orgType' in member ? member.orgType : undefined
    }));
  }, [membersByConnection, agencyMembers])

  // Helper function to get client editable members for a specific task's connection
  const getClientEditableMembersForTask = useCallback((connectionId: string) => {
    const members = membersByConnection[connectionId] || agencyMembers;
    const idSet = new Set<string>();
    const options = members
      .filter(member => 'orgType' in member && member.orgType === 'client')
      .map(member => {
        if (member.id) {
          idSet.add(member.id);
        }
        const fullName = `${member.firstName} ${member.lastName}`.trim();
        return {
          value: member.id,
          label: fullName || member.email,
          avatar: member.avatarUrl,
          email: member.email
        };
      });
    return {
      idSet,
      options
    };
  }, [membersByConnection, agencyMembers])

  // Sort is always "Created" for MVP
  const currentSortLabel = 'Created'

  // Assignee handlers with loading guard
  const isMutingAssignee = useRef(false)
  const handleAssigneeSelect = async (taskId: string, memberId: string, connectionId: string) => {
    if (isMutingAssignee.current) return
    
    // Find member in the task's connection members (or fallback to agencyMembers)
    const members = membersByConnection[connectionId] || agencyMembers;
    const selectedMember = members.find(member => member.id === memberId)
    if (selectedMember) {
      // Check if this is a client member (for visibility logic)
      const isClientMember = 'orgType' in selectedMember && selectedMember.orgType === 'client';
      const newAssignee = {
        id: memberId,
        name: `${selectedMember.firstName} ${selectedMember.lastName}`,
        email: selectedMember.email,
        avatarUrl: selectedMember.avatarUrl
      }
      
      // Get current task to check visibility state and old assignee
      const currentTask = tasks.find(t => t.id === taskId);
      const currentVisibility = currentTask?.clientVisible ?? false;
      const oldAssigneeUserId = currentTask?.assignee?.id ?? null;
      const oldCompletedAt = currentTask?.completedAtRaw ?? null;
      
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
      
      if (onTaskUpdate) {
        onTaskUpdate(taskId, updates)
      }
      
      // Dispatch event if assignee changed (affects assigned count) - only for client context
      if (!isAgency && clientOrgUserIds.size > 0) {
        dispatchTaskAssignedChanged({
          taskId,
          oldAssigneeUserId,
          newAssigneeUserId: memberId,
          oldCompletedAt,
          newCompletedAt: oldCompletedAt, // CompletedAt doesn't change on assignee change
        });
      }
      
      isMutingAssignee.current = true
      
      await runWithPaywallCheck(
        async () => {
          await updateTaskAssignee(taskId, memberId)
        },
        () => {
          // Success - real-time subscription will handle UI updates
        },
        () => {
          setIsPaywallModalOpen(true)
          // Revert optimistic update on paywall
          if (onTaskUpdate) {
            const originalTask = tasks.find(t => t.id === taskId)
            if (originalTask) {
              onTaskUpdate(taskId, { assignee: originalTask.assignee })
            }
          }
        }
      ).catch((error) => {
        if (process.env.NODE_ENV !== 'production') {
          console.error('Failed to update assignee:', error)
        }
        toast.error('Failed to update assignee')
        if (onTaskUpdate) {
          const originalTask = tasks.find(t => t.id === taskId)
          if (originalTask) {
            onTaskUpdate(taskId, { assignee: originalTask.assignee })
          }
        }
      }).finally(() => {
        isMutingAssignee.current = false
      })
    }
  }

  const handleClearAssignee = async (taskId: string) => {
    if (isMutingAssignee.current) return
    
    // Get current task to check old assignee
    const currentTask = tasks.find(t => t.id === taskId);
    const oldAssigneeUserId = currentTask?.assignee?.id ?? null;
    const oldCompletedAt = currentTask?.completedAtRaw ?? null;
    
    if (onTaskUpdate) {
      onTaskUpdate(taskId, { assignee: null })
    }
    
    // Dispatch event if assignee changed (affects assigned count) - only for client context
    if (!isAgency && clientOrgUserIds.size > 0) {
      dispatchTaskAssignedChanged({
        taskId,
        oldAssigneeUserId,
        newAssigneeUserId: null,
        oldCompletedAt,
        newCompletedAt: oldCompletedAt, // CompletedAt doesn't change on assignee clear
      });
    }
    
    isMutingAssignee.current = true
    
    try {
      await updateTaskAssignee(taskId, null)
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Failed to clear assignee:', error)
      }
      toast.error('Failed to clear assignee')
      if (onTaskUpdate) {
        const originalTask = tasks.find(t => t.id === taskId)
        if (originalTask) {
          onTaskUpdate(taskId, { assignee: originalTask.assignee })
        }
      }
    } finally {
      isMutingAssignee.current = false
    }
  }

  // Status handler with loading guard
  const isMutingStatus = useRef(false)
  const handleStatusChange = async (taskId: string, newStatus: string) => {
    if (isMutingStatus.current) return
    
    const validStatuses = ['to_do', 'in_progress', 'on_hold', 'done'] as const
    if (!(validStatuses as readonly string[]).includes(newStatus)) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Invalid status:', newStatus)
      }
      return
    }
    
    const typedStatus = newStatus as 'to_do' | 'in_progress' | 'on_hold' | 'done'
    
    // Get current task to check old status and assignee
    const currentTask = tasks.find(t => t.id === taskId);
    const oldStatus = currentTask?.status ?? 'to_do';
    const assigneeUserId = currentTask?.assignee?.id ?? null;
    const oldCompletedAt = currentTask?.completedAtRaw ?? null;
    
    // When status changes to 'done', completed_at is set. When it changes from 'done', completed_at is cleared.
    const newCompletedAt = typedStatus === 'done' ? new Date().toISOString() : null;
    
    if (onTaskUpdate) {
      onTaskUpdate(taskId, { 
        status: typedStatus,
        completedAtRaw: newCompletedAt
      })
    }
    
    // Dispatch event if status changed to/from 'done' (affects assigned count) - only for client context
    if (!isAgency && clientOrgUserIds.size > 0 && assigneeUserId && clientOrgUserIds.has(assigneeUserId)) {
      // Only dispatch if task is assigned to a client org member
      const statusChangedToDone = oldStatus !== 'done' && typedStatus === 'done';
      const statusChangedFromDone = oldStatus === 'done' && typedStatus !== 'done';
      
      if (statusChangedToDone || statusChangedFromDone) {
        dispatchTaskAssignedChanged({
          taskId,
          oldAssigneeUserId: assigneeUserId,
          newAssigneeUserId: assigneeUserId,
          oldCompletedAt: statusChangedToDone ? null : oldCompletedAt,
          newCompletedAt: statusChangedToDone ? newCompletedAt : null,
        });
      }
    }
    
    isMutingStatus.current = true
    
    await runWithPaywallCheck(
      async () => {
        await updateTaskStatus(taskId, typedStatus)
      },
      () => {
        // Success - real-time subscription will handle UI updates
      },
      () => {
        setIsPaywallModalOpen(true)
        // Revert optimistic update on paywall
        if (onTaskUpdate) {
          const originalTask = tasks.find(t => t.id === taskId)
          if (originalTask) {
            onTaskUpdate(taskId, { status: originalTask.status })
          }
        }
      }
    ).catch((error) => {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Failed to update status:', error)
      }
      toast.error('Failed to update status')
      if (onTaskUpdate) {
        const originalTask = tasks.find(t => t.id === taskId)
        if (originalTask) {
          onTaskUpdate(taskId, { status: originalTask.status })
        }
      }
    }).finally(() => {
      isMutingStatus.current = false
    })
  }

  // Profile Card state
  const [profileDialogOpen, setProfileDialogOpen] = useState(false)
  const [selectedContact, setSelectedContact] = useState<{
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
  } | null>(null)

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

  const handleRowClick = (taskId: string) => {
    onTaskClick?.(taskId)
  }

  const handleCopyLink = (taskId: string, connectionId: string) => {
    const fullUrl = `${window.location.origin}/${baseRoute}/${connectionId}/tasks/${taskId}`
    navigator.clipboard.writeText(fullUrl).then(() => {
      toast.success('Link copied to clipboard')
    }).catch(() => {
      toast.error('Failed to copy link')
    })
  }
  
  const handleDeleteTask = async (taskId: string) => {
    // Parent handles optimistic update, toast, and server action
    onTaskDeleted?.(taskId)
  }

  // Group tasks by status and client
  // Only recomputes when tasks array reference changes (which happens when tasks are added/removed/updated)
  const { grouped: groupedTasks, allClients } = useMemo(() => groupTasksByStatusAndClient(tasks), [tasks])
  
  // Auto-expand groups that contain search results when search is active
  useEffect(() => {
    // Only auto-expand if there's an active search query
    if (searchQuery.trim().length === 0) {
      return
    }

    // Expand all status groups that have tasks
    for (const status of Object.keys(groupedTasks) as TaskStatus[]) {
      const clientGroups = groupedTasks[status]
      const hasTasks = Object.values(clientGroups).some(tasks => tasks.length > 0)
      
      if (hasTasks) {
        // Remove from collapsed set (expand the group)
        collapsedStatusesState.remove(status)
        
        // Expand all client groups within this status that have tasks
        for (const [clientId, clientTasks] of Object.entries(clientGroups)) {
          if (clientTasks.length > 0) {
            // Remove from collapsed set (expand the client group)
            collapsedClientsState.remove(status, clientId)
          }
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, searchQuery, groupedTasks])
  
  // Flatten grouped tasks for virtualization
  // Uses stable collapse state references - only recomputes when:
  // - groupedTasks changes (tasks changed)
  // - allClients changes (new clients added)
  // - collapse state contents actually change (not just reference)
  const flattenedItems = useMemo<FlattenedItem[]>(() => {
    return flattenGroupedTasks(groupedTasks, allClients, collapsedStatusesState.set, collapsedClientsState.map)
  }, [groupedTasks, allClients, collapsedStatusesState.set, collapsedClientsState.map])
  
  // Toggle status group collapse/expand - uses stable reference hook
  const toggleStatusGroup = useCallback((status: TaskStatus) => {
    collapsedStatusesState.toggle(status)
  }, [collapsedStatusesState])
  
  // Toggle client group collapse/expand - uses stable reference hook
  const toggleClientGroup = useCallback((status: TaskStatus, clientId: string) => {
    collapsedClientsState.toggle(status, clientId)
  }, [collapsedClientsState])

  // Virtual scroll setup using shared hook
  const { containerRef, rowVirtualizer, virtualItems, isNearEnd: _isNearEnd } = useVirtualTable({
    items: flattenedItems,
    onLoadMore,
    scrollRestoreDeps: [searchQuery],
    parentRef
  })
  
  const hasActiveFilters = searchQuery.trim().length > 0 || assignedToMe
  const isEmptyState = !isBootstrapping && unfilteredTotalCount === 0;


  return (
    <div className="w-full min-w-0">
      {/* Sticky Header Section - Search + Table Header */}
      <div
        className="sticky z-10"
        style={{
          top: headerOffset,
          backgroundColor: 'var(--color-neutral-2)',
        }}
      >
        <div
          style={{
            backgroundColor: 'var(--color-base-surface-page-background)',
            borderTopLeftRadius: 'var(--radius-6)',
            borderTopRightRadius: 'var(--radius-6)',
            borderLeft: '1px solid var(--color-neutral-4)',
            borderRight: '1px solid var(--color-neutral-4)',
            borderTop: '1px solid var(--color-neutral-4)',
            overflow: 'hidden',
          }}
        >
          {/* Search section */}
          <div className="pt-5 pb-4 px-5 relative">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-3">
                <SearchInput
                  placeholder="Search tasks by client or title…"
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
              </div>
            </div>
            {/* Border with 20px margins to match content padding */}
            <div className="absolute bottom-0 left-5 right-5 border-b border-[var(--color-neutral-4)]" />
          </div>

        </div>
      </div>

      {/* Scrollable Table Body Section */}
      <div
        className="w-full overflow-x-auto"
        ref={containerRef}
        style={{ backgroundColor: 'var(--color-neutral-2)' }}
      >
        <div
          style={{
            borderLeft: '1px solid var(--color-neutral-4)',
            borderRight: '1px solid var(--color-neutral-4)',
            borderBottom: '1px solid var(--color-neutral-4)',
            borderBottomLeftRadius: 'var(--radius-6)',
            borderBottomRightRadius: 'var(--radius-6)',
            overflow: 'hidden',
            backgroundColor: 'var(--color-base-surface-page-background)',
          }}
        >
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
              {/* Client Group + 4 Task Rows - repeatable pattern (2-3 times) */}
              {[1, 2, 3].map((clientIndex) => (
                <div key={clientIndex}>
                  {/* Client Group Skeleton */}
                  <div
                    className="border-b border-[var(--color-neutral-4)] h-[44px] grid items-center"
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
                      <Skeleton className="w-5 h-5 rounded-full" />
                      <Skeleton className="w-24 h-4 rounded" />
                      <Skeleton className="w-12 h-4 rounded" />
                    </div>
                  </div>
                  {/* Task Row Skeletons - 4 per client group */}
                  {[1, 2, 3, 4].map((taskIndex) => (
                    <div
                      key={`${clientIndex}-${taskIndex}`}
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
                      {/* Client */}
                      <div className="px-3">
                        <Skeleton className="w-24 h-4 rounded" />
                      </div>
                      {/* Created */}
                      <div className="px-3">
                        <Skeleton className="w-20 h-4 rounded" />
                      </div>
                      {isAgency && <div></div>}
                      <div></div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <VirtualListBody
              items={flattenedItems}
            virtualItems={virtualItems}
            rowVirtualizer={rowVirtualizer}
              emptyState={isEmptyState ? (
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
                    {onNewTask && isAgency && (
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
              ) : undefined}
              getItemKey={(item, index) => {
                if (item.type === 'status-group') {
                  return `status-${item.status}`
                }
                if (item.type === 'client-group') {
                  return `client-${item.status}-${item.clientId}`
                }
                return `task-${item.task.id}`
              }}
              renderItem={(item, index) => {
                if (item.type === 'status-group') {
                  const isFirstGroup = item.status === 'in_progress'
                        return (
                    <StatusGroupHeader
                      status={item.status}
                      count={item.count}
                      isExpanded={!collapsedStatusesState.set.has(item.status)}
                      onToggle={() => toggleStatusGroup(item.status)}
                      isAgency={isAgency}
                      isFirstGroup={isFirstGroup}
                    />
                  )
                }
                if (item.type === 'client-group') {
                  // Find if this is the first client in this status group
                  const statusGroupIndex = flattenedItems.findIndex(i => i.type === 'status-group' && i.status === item.status)
                  const itemsAfterStatusGroup = flattenedItems.slice(statusGroupIndex + 1)
                  const firstClientGroupIndex = itemsAfterStatusGroup.findIndex(i => i.type === 'client-group' && i.status === item.status)
                  const isFirstClient = index === statusGroupIndex + 1 + firstClientGroupIndex

                      return (
                    <ClientGroupHeader
                      clientId={item.clientId}
                      clientName={item.clientName}
                      clientLogoUrl={item.clientLogoUrl}
                      count={item.count}
                      isExpanded={!collapsedClientsState.get(item.status).has(item.clientId)}
                      onToggle={() => toggleClientGroup(item.status, item.clientId)}
                      isAgency={isAgency}
                      isFirstClient={isFirstClient}
                    />
                  )
                }
                // item.type === 'task'
                const clientEditableMembers = getClientEditableMembersForTask(item.task.connectionId)
                return (
                  <GlobalTaskRow
                    task={item.task}
                    isAgency={isAgency}
                    clientEditableMembers={clientEditableMembers}
                    comboboxOptions={getComboboxOptionsForTask(item.task.connectionId)}
                    membersByConnection={membersByConnection}
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
                  />
                )
              }}
          />
          )}
          </div>
        </div>
      </div>

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

      {/* Paywall Modal */}
      <PaywallModal 
        open={isPaywallModalOpen} 
        onOpenChange={setIsPaywallModalOpen} 
      />
    </div>
  )
}

