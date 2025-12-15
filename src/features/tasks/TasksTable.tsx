"use client"

import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react'
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
import { PaywallModal } from '@/components/ui/paywall-modal'
import { runWithPaywallCheck } from '@/lib/tasks-requests-helpers'
import { updateTaskAssignee, updateTaskStatus } from '@/features/connections/tasks/actions'
import type { Task, SearchResults } from './types'
import { StatusGroupHeader } from './StatusGroupHeader'
import { ClientGroupHeader } from './ClientGroupHeader'
import { GlobalTaskRow } from './GlobalTaskRow'
import { Skeleton } from '@/components/ui/skeleton'
import type { TaskStatus } from './taskGrouping'
import { dispatchTaskAssignedChanged } from '@/features/home/cards/stats/TasksAssignedCard'
import { createClient as createSupabaseBrowserClient } from '@/lib/supabase/client'

interface TasksTableProps {
  userAvatar?: string
  userInitials?: string
  onTaskClick?: (taskId: string) => void
  onNewTask?: () => void
  tasks: Task[] // Flat array of tasks (only used in search mode)
  tasksByClientStatus?: Map<string, Task[]> // Map<`${status}-${clientOrgId}`, Task[]> - accordion cache
  isLoadingClientStatus?: Map<string, boolean> // Map<`${status}-${clientOrgId}`, boolean> - loading states
  onFetchClientTasks?: (status: string, clientOrgId: string, forceFetch?: boolean) => void // Fetch-on-expand callback
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
  onLoadMore?: () => void // Only used in search mode
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
  allowedConnectionIds?: string[] | null
  allConnectionsMetadata?: Map<string, { name: string; logoUrl?: string }>
  statusCounts: Map<string, number> // From metadata fetch
  clientCounts: Map<string, number> // From metadata fetch (clientOrgId -> count, keyed by `${status}-${clientOrgId}`)
  collapsedStatuses: Set<string> // Client-side collapse state
  collapsedClients: Map<string, Set<string>> // Map<status, Set<clientOrgId>>
  onToggleStatus: (status: string) => void // Simple state update
  onToggleClient: (status: string, clientOrgId: string) => void // Simple state update
  hasOptimisticData?: (cacheKey: string) => boolean // Check if cache key has optimistic data
  searchQuery?: string // Optional search query for client-side filtering (browse mode)
  searchResults?: SearchResults | null // Server-side search results (search mode)
  isSearching?: boolean // Search loading state
  assignedFilterResults?: SearchResults | null // Server-side assigned filter results (assigned filter mode)
  isLoadingAssignedFilter?: boolean // Assigned filter loading state
}

export default function TasksTable({ userAvatar = '', userInitials = 'U', onTaskClick, onNewTask, tasks, tasksByClientStatus = new Map(), isLoadingClientStatus = new Map(), onFetchClientTasks, agencyMembers = [], membersByConnection = {}, onTaskUpdate, currentOrgId, onLoadMore, onSearchChange, totalCount, unfilteredTotalCount = 0, parentRef, headerOffset = 0, assignedToMe = false, onToggleAssignedToMe, isBootstrapping = false, isAgency = false, onTaskDeleted, allowedConnectionIds: _allowedConnectionIds = null, allConnectionsMetadata = new Map(), statusCounts, clientCounts, collapsedStatuses, collapsedClients, onToggleStatus, onToggleClient, hasOptimisticData, searchQuery: searchQueryProp, searchResults, isSearching = false, assignedFilterResults, isLoadingAssignedFilter = false }: TasksTableProps) {
  const pathname = usePathname()
  const baseRoute = pathname.includes('/clients/') ? 'clients' : 'agencies'
  const [openActionsDropdown, setOpenActionsDropdown] = useState<string | null>(null)
  
  // Paywall modal state
  const [isPaywallModalOpen, setIsPaywallModalOpen] = useState(false)
  
  // Track client org user IDs for event dispatching (only for client context)
  const [clientOrgUserIds, setClientOrgUserIds] = useState<Set<string>>(new Set())
  
  const statusInlineRefs = useRef<Record<string, InlineEditRef | null>>({})
  
  // Loading guard refs to prevent rapid-fire mutations
  const isMutingAssignee = useRef(false)
  const isMutingStatus = useRef(false)
  
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

  // Calculate total task count from statusCounts (sum of all statuses)
  // This gives us the accurate total across all connections, regardless of what's loaded
  // In search mode, use the count from search results instead
  const taskCount = useMemo(() => {
    // If in search mode, calculate count from search results
    if (searchResults) {
      return searchResults.clients.reduce((sum, client) => sum + client.tasks.length, 0);
    }
    // If in assigned filter mode, calculate count from assigned filter results
    if (assignedFilterResults) {
      return assignedFilterResults.clients.reduce((sum, client) => sum + client.tasks.length, 0);
    }
    // Otherwise, use accordion mode: sum all status counts
    let total = 0;
    for (const count of statusCounts.values()) {
      total += typeof count === 'number' ? count : 0;
    }
    return total;
  }, [statusCounts, searchResults, assignedFilterResults])
  
  // Transform agency members to combobox options (memoized to prevent recreation)
  const comboboxOptions = useMemo(() => 
    agencyMembers.map(member => ({
      value: member.id,
      label: `${member.firstName} ${member.lastName}`,
      avatar: member.avatarUrl,
      email: member.email
    })),
    [agencyMembers]
  )

  // Sort is always "Created" for MVP
  const currentSortLabel = 'Created'

  // Assignee handlers with loading guard
  const handleAssigneeSelect = async (taskId: string, memberId: string, connectionId: string) => {
    // Prevent rapid-fire mutations
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
      
      // Notify parent for bidirectional updates (table → modal)
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
      
      // Set loading guard
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
          // Revert parent state on paywall
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
        // Revert parent state on error
        if (onTaskUpdate) {
          const originalTask = tasks.find(t => t.id === taskId)
          if (originalTask) {
            onTaskUpdate(taskId, { assignee: originalTask.assignee })
          }
        }
      }).finally(() => {
        // Clear loading guard
        isMutingAssignee.current = false
      })
    }
  }

  const handleClearAssignee = async (taskId: string) => {
    // Prevent rapid-fire mutations
    if (isMutingAssignee.current) return
    
    // Get current task to check old assignee
    const currentTask = tasks.find(t => t.id === taskId);
    const oldAssigneeUserId = currentTask?.assignee?.id ?? null;
    const oldCompletedAt = currentTask?.completedAtRaw ?? null;
    
    // Notify parent for bidirectional updates (table → modal)
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
        const originalTask = tasks.find(t => t.id === taskId)
        if (originalTask) {
          onTaskUpdate(taskId, { assignee: originalTask.assignee })
        }
      }
    } finally {
      // Clear loading guard
      isMutingAssignee.current = false
    }
  }

  // Status handler with loading guard
  const handleStatusChange = async (taskId: string, newStatus: string) => {
    // Prevent rapid-fire mutations
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
    
    // Notify parent for bidirectional updates (table → modal)
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
    
    // Set loading guard
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
        // Revert parent state on paywall
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
      // Revert parent state on error
      if (onTaskUpdate) {
        const originalTask = tasks.find(t => t.id === taskId)
        if (originalTask) {
          onTaskUpdate(taskId, { status: originalTask.status })
        }
      }
    }).finally(() => {
      // Clear loading guard
      isMutingStatus.current = false
    })
  }

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

  // Navigation handler
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

  // Status order for accordion rendering
  const statusOrder: TaskStatus[] = ['in_progress', 'to_do', 'on_hold', 'done']

  // Build client groups by status from allConnectionsMetadata
  // This gives us all client headers even if tasks aren't loaded yet
  // Filter by search query if provided (client-side filtering)
  const clientGroupsByStatus = useMemo(() => {
    const groups: Record<string, Array<{ orgId: string; name: string; logoUrl?: string }>> = {
      in_progress: [],
      to_do: [],
      on_hold: [],
      done: [],
    }

    // Get all unique client orgs from metadata
    let clientOrgs = Array.from(allConnectionsMetadata.entries())
      .map(([orgId, metadata]) => ({
        orgId,
        name: metadata.name,
        logoUrl: metadata.logoUrl,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))

    // Filter by search query if provided (client-side filtering for browse mode only)
    // In search mode (searchResults !== null), server handles filtering
    if (searchQueryProp && searchQueryProp.trim().length > 0 && searchResults === null) {
      const searchLower = searchQueryProp.trim().toLowerCase()
      clientOrgs = clientOrgs.filter(client => 
        client.name.toLowerCase().includes(searchLower)
      )
    }

    // Add all clients to all status groups (they'll show counts from clientCounts)
    for (const status of statusOrder) {
      groups[status] = clientOrgs
    }

    return groups
  }, [allConnectionsMetadata, searchQueryProp, searchResults])

  // Empty state: only show if we're not bootstrapping AND there are truly no tasks
  // In accordion mode, always show headers (even with 0 counts) so users can see the structure
  // Show empty state if search is active but no clients match the search query
  const hasMatchingClients = useMemo(() => {
    if (!searchQueryProp || searchQueryProp.trim().length === 0) return true
    // Check if any status group has matching clients
    return Object.values(clientGroupsByStatus).some(clients => clients.length > 0)
  }, [searchQueryProp, clientGroupsByStatus])
  
  const isEmptyState = !isBootstrapping && 
    searchQueryProp && 
    searchQueryProp.trim().length > 0 &&
    !hasMatchingClients;

  // Determine render mode priority:
  // 1. Search Mode (only if we have search results OR actively searching with a query)
  // 2. Assigned Filter Mode (only if we have filter results OR actively loading with filter enabled)
  // 3. Browse Mode (default)
  // Only show skeleton if actively searching AND we don't have results yet
  // Don't show skeleton when transitioning back to browse mode
  const hasActiveSearchQuery = (searchQueryProp || '').trim().length > 0;
  const isSearchMode = searchResults !== null || (isSearching && hasActiveSearchQuery);
  const isAssignedFilterMode = assignedFilterResults !== null || (isLoadingAssignedFilter && assignedToMe);

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
          <div className="pt-5 pb-4 px-5">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-3">
                <SearchInput
                  placeholder="Search tasks by client…"
                  value={searchQueryProp || ''}
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
                  gridTemplateColumns: '44px 4fr 3fr 3fr 3fr 3fr 44px',
                }}
              >
                <div className="flex items-center justify-center">
                  <Skeleton className="w-3 h-3" />
                </div>
                <div className="flex items-center gap-3 px-3">
                  <Skeleton className="w-12 h-5 rounded" />
                  <Skeleton className="w-16 h-4 rounded" />
                </div>
                {/* Empty cells to match grid structure */}
                <div className="px-3"></div>
                <div className="px-3"></div>
                <div className="px-3"></div>
                <div className="px-3"></div>
                <div></div>
              </div>
              {/* Client Group + 4 Task Rows - repeatable pattern (2-3 times) */}
              {[1, 2, 3].map((clientIndex) => (
                <div key={clientIndex}>
                  {/* Client Group Skeleton */}
                  <div
                    className="border-b border-[var(--color-neutral-4)] h-[44px] grid items-center"
                    style={{
                      gridTemplateColumns: '44px 4fr 3fr 3fr 3fr 3fr 44px',
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
                    {/* Empty cells to match grid structure */}
                    <div className="px-3"></div>
                    <div className="px-3"></div>
                    <div className="px-3"></div>
                    <div className="px-3"></div>
                    <div></div>
                  </div>
                  {/* Task Row Skeletons - 4 per client group */}
                  {[1, 2, 3, 4].map((taskIndex) => (
                    <div
                      key={`${clientIndex}-${taskIndex}`}
                      className="border-b border-[var(--color-neutral-4)] h-[44px] grid items-center"
                      style={{
                        gridTemplateColumns: '44px 4fr 3fr 3fr 3fr 3fr 44px',
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
                      {/* Project */}
                      <div className="px-3">
                        <Skeleton className="w-24 h-4 rounded" />
                      </div>
                      {/* Due Date */}
                      <div className="px-3">
                        <Skeleton className="w-20 h-4 rounded" />
                      </div>
                      <div></div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ) : isSearchMode ? (
            // Search Mode: Server-side search with atomic results
            <div className="space-y-0">
              {isSearching && hasActiveSearchQuery && searchResults === null ? (
                // Loading state: Show skeleton only if we have active search query and no results yet
                <div className="space-y-0">
                  {/* Status Group Skeleton */}
                  <div
                    className="bg-[var(--color-neutral-2)] border-b border-[var(--color-neutral-4)] h-[44px] grid items-center"
                    style={{
                      gridTemplateColumns: '44px 4fr 3fr 3fr 3fr 3fr 44px',
                    }}
                  >
                    <div className="flex items-center justify-center">
                      <Skeleton className="w-3 h-3" />
                    </div>
                    <div className="flex items-center gap-3 px-3">
                      <Skeleton className="w-12 h-5 rounded" />
                      <Skeleton className="w-16 h-4 rounded" />
                    </div>
                    <div className="px-3"></div>
                    <div className="px-3"></div>
                    <div className="px-3"></div>
                    <div className="px-3"></div>
                    <div></div>
                  </div>
                  {/* Client Group + Task Row Skeletons - repeatable pattern (3 clients, 4 rows each) */}
                  {[1, 2, 3].map((clientIndex) => (
                    <div key={clientIndex}>
                      {/* Client Group Skeleton */}
                      <div
                        className="border-b border-[var(--color-neutral-4)] h-[44px] grid items-center"
                        style={{
                          gridTemplateColumns: '44px 4fr 3fr 3fr 3fr 3fr 44px',
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
                        {/* Empty cells to match grid structure */}
                        <div className="px-3"></div>
                        <div className="px-3"></div>
                        <div className="px-3"></div>
                        <div className="px-3"></div>
                        <div></div>
                      </div>
                      {/* Task Row Skeletons - 4 per client group */}
                      {[1, 2, 3, 4].map((taskIndex) => (
                        <div
                          key={`${clientIndex}-${taskIndex}`}
                          className="border-b border-[var(--color-neutral-4)] h-[44px] grid items-center"
                          style={{
                            gridTemplateColumns: '44px 4fr 3fr 3fr 3fr 3fr 44px',
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
                          {/* Project */}
                          <div className="px-3">
                            <Skeleton className="w-24 h-4 rounded" />
                          </div>
                          {/* Due Date */}
                          <div className="px-3">
                            <Skeleton className="w-20 h-4 rounded" />
                          </div>
                          <div></div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ) : searchResults ? (
                // Search results: Render accordion structure with pre-loaded data
                // Always show all status headers, even with 0 results
                statusOrder.map((status) => {
                  // Filter clients that have tasks in this status
                  const clientsInStatus = searchResults.clients.filter((client: SearchResults['clients'][0]) => 
                    client.tasks.some((task: Task) => task.status === status)
                  );

                  // Calculate status count from search results
                  const statusCount = searchResults.clients.reduce((sum: number, client: SearchResults['clients'][0]) => 
                    sum + client.tasks.filter((task: Task) => task.status === status).length, 0
                  );

                  // Always render status header, even if count is 0
                  return (
                    <React.Fragment key={status}>
                      <StatusGroupHeader
                        status={status}
                        statusCount={statusCount}
                        isCollapsed={collapsedStatuses.has(status)}
                        onToggle={() => onToggleStatus(status)}
                      />
                      {!collapsedStatuses.has(status) && clientsInStatus.length > 0 && clientsInStatus.map((clientResult: SearchResults['clients'][0]) => {
                        // Filter tasks for this status
                        const tasksInStatus = clientResult.tasks.filter((task: Task) => task.status === status);
                        
                        if (tasksInStatus.length === 0) {
                          return null;
                        }

                        // Check if this client is collapsed in search mode
                        // Set tracks expanded clients, so if NOT in Set, it's collapsed
                        // Default to expanded (all clients should be in Set), but allow toggling
                        const isClientCollapsed = !collapsedClients.get(status)?.has(clientResult.client_id);

                        return (
                          <React.Fragment key={clientResult.client_id}>
                            <ClientGroupHeader
                              clientId={clientResult.client_id}
                              clientName={isAgency ? clientResult.client_name : undefined}
                              clientLogoUrl={isAgency ? clientResult.client_logo_url : undefined}
                              agencyId={!isAgency ? clientResult.client_id : undefined}
                              agencyName={!isAgency ? clientResult.client_name : undefined}
                              agencyLogoUrl={!isAgency ? clientResult.client_logo_url : undefined}
                              count={tasksInStatus.length}
                              isCollapsed={isClientCollapsed}
                              onToggle={() => onToggleClient(status, clientResult.client_id)}
                              isAgency={isAgency}
                            />
                            {/* Render all tasks - data is pre-loaded, only when expanded */}
                            {!isClientCollapsed && tasksInStatus.map((task: Task) => (
                              <GlobalTaskRow
                                key={task.id}
                                task={task}
                                isAgency={isAgency}
                                clientEditableMembers={getClientEditableMembersForTask(task.connectionId)}
                                comboboxOptions={getComboboxOptionsForTask(task.connectionId)}
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
                            ))}
                          </React.Fragment>
                        );
                      })}
                    </React.Fragment>
                  );
                })
              ) : null}
            </div>
          ) : isAssignedFilterMode ? (
            // Assigned Filter Mode: Server-side filter with atomic results
            <div className="space-y-0">
              {isLoadingAssignedFilter || (assignedToMe && !assignedFilterResults) ? (
                // Loading state: Show skeleton while loading OR when assignedToMe is true but no results yet
                <div className="space-y-0">
                  {/* Status Group Skeleton */}
                  <div
                    className="bg-[var(--color-neutral-2)] border-b border-[var(--color-neutral-4)] h-[44px] grid items-center"
                    style={{
                      gridTemplateColumns: '44px 4fr 3fr 3fr 3fr 3fr 44px',
                    }}
                  >
                    <div className="flex items-center justify-center">
                      <Skeleton className="w-3 h-3" />
                    </div>
                    <div className="flex items-center gap-3 px-3">
                      <Skeleton className="w-12 h-5 rounded" />
                      <Skeleton className="w-16 h-4 rounded" />
                    </div>
                    <div className="px-3"></div>
                    <div className="px-3"></div>
                    <div className="px-3"></div>
                    <div className="px-3"></div>
                    <div></div>
                  </div>
                  {/* Client Group + Task Row Skeletons - repeatable pattern (3 clients, 4 rows each) */}
                  {[1, 2, 3].map((clientIndex) => (
                    <div key={clientIndex}>
                      {/* Client Group Skeleton */}
                      <div
                        className="border-b border-[var(--color-neutral-4)] h-[44px] grid items-center"
                        style={{
                          gridTemplateColumns: '44px 4fr 3fr 3fr 3fr 3fr 44px',
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
                        {/* Empty cells to match grid structure */}
                        <div className="px-3"></div>
                        <div className="px-3"></div>
                        <div className="px-3"></div>
                        <div className="px-3"></div>
                        <div></div>
                      </div>
                      {/* Task Row Skeletons - 4 per client group */}
                      {[1, 2, 3, 4].map((taskIndex) => (
                        <div
                          key={`${clientIndex}-${taskIndex}`}
                          className="border-b border-[var(--color-neutral-4)] h-[44px] grid items-center"
                          style={{
                            gridTemplateColumns: '44px 4fr 3fr 3fr 3fr 3fr 44px',
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
                          {/* Project */}
                          <div className="px-3">
                            <Skeleton className="w-24 h-4 rounded" />
                          </div>
                          {/* Due Date */}
                          <div className="px-3">
                            <Skeleton className="w-20 h-4 rounded" />
                          </div>
                          <div></div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ) : assignedFilterResults ? (
                // Assigned filter results: Render accordion structure with pre-loaded data
                // Always show all status headers, even with 0 results
                statusOrder.map((status) => {
                  // Filter clients that have tasks in this status
                  const clientsInStatus = assignedFilterResults.clients.filter((client: SearchResults['clients'][0]) => 
                    client.tasks.some((task: Task) => task.status === status)
                  );

                  // Calculate status count from assigned filter results
                  const statusCount = assignedFilterResults.clients.reduce((sum: number, client: SearchResults['clients'][0]) => 
                    sum + client.tasks.filter((task: Task) => task.status === status).length, 0
                  );

                  // Always render status header, even if count is 0
                  return (
                    <React.Fragment key={status}>
                      <StatusGroupHeader
                        status={status}
                        statusCount={statusCount}
                        isCollapsed={collapsedStatuses.has(status)}
                        onToggle={() => onToggleStatus(status)}
                      />
                      {!collapsedStatuses.has(status) && clientsInStatus.length > 0 && clientsInStatus.map((clientResult: SearchResults['clients'][0]) => {
                        // Filter tasks for this status
                        const tasksInStatus = clientResult.tasks.filter((task: Task) => task.status === status);
                        
                        if (tasksInStatus.length === 0) {
                          return null;
                        }

                        // Check if this client is collapsed in assigned filter mode
                        // Set tracks expanded clients, so if NOT in Set, it's collapsed
                        // Default to expanded (all clients should be in Set), but allow toggling
                        const isClientCollapsed = !collapsedClients.get(status)?.has(clientResult.client_id);

                        return (
                          <React.Fragment key={clientResult.client_id}>
                            <ClientGroupHeader
                              clientId={clientResult.client_id}
                              clientName={isAgency ? clientResult.client_name : undefined}
                              clientLogoUrl={isAgency ? clientResult.client_logo_url : undefined}
                              agencyId={!isAgency ? clientResult.client_id : undefined}
                              agencyName={!isAgency ? clientResult.client_name : undefined}
                              agencyLogoUrl={!isAgency ? clientResult.client_logo_url : undefined}
                              count={tasksInStatus.length}
                              isCollapsed={isClientCollapsed}
                              onToggle={() => onToggleClient(status, clientResult.client_id)}
                              isAgency={isAgency}
                            />
                            {/* Render all tasks - data is pre-loaded, only when expanded */}
                            {!isClientCollapsed && tasksInStatus.map((task: Task) => (
                              <GlobalTaskRow
                                key={task.id}
                                task={task}
                                isAgency={isAgency}
                                clientEditableMembers={getClientEditableMembersForTask(task.connectionId)}
                                comboboxOptions={getComboboxOptionsForTask(task.connectionId)}
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
                            ))}
                          </React.Fragment>
                        );
                      })}
                    </React.Fragment>
                  );
                })
              ) : null}
            </div>
          ) : isEmptyState ? (
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
                {onNewTask && (
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
          ) : (
            // Accordion mode: direct hierarchical rendering
            // Always show status headers, even if counts are 0 or clients list is empty
            <div className="space-y-0">
              {statusOrder.map((status) => {
                const isStatusCollapsed = collapsedStatuses.has(status)
                const statusCount = statusCounts.get(status) ?? 0
                const clients = clientGroupsByStatus[status] || []
                
                // Always render status header, even if count is 0
                return (
                  <React.Fragment key={status}>
                    <StatusGroupHeader
                      status={status}
                      statusCount={statusCount}
                      isCollapsed={isStatusCollapsed}
                      onToggle={() => onToggleStatus(status)}
                    />
                    {!isStatusCollapsed && clients.length > 0 && clients.map((client) => {
                      const cacheKey = `${status}-${client.orgId}`
                      // Client is expanded if it's in the Set, collapsed otherwise (default to collapsed)
                      const isClientCollapsed = !collapsedClients.get(status)?.has(client.orgId)
                      
                      // 1. Get the raw value. DO NOT default to [].
                      // If this returns undefined, it means we haven't fetched it yet.
                      const clientTasks = tasksByClientStatus.get(cacheKey)
                      
                      const isLoading = isLoadingClientStatus.get(cacheKey) || false
                      const knownCount = clientCounts.get(cacheKey) ?? 0
                      
                      // 2. Derive the state
                      const isExpanded = !isClientCollapsed
                      const hasData = clientTasks !== undefined
                      const isEmpty = hasData && clientTasks.length === 0
                      
                      // Separate optimistic tasks from real tasks if we have data
                      const optimisticTasks = hasData ? clientTasks.filter(t => t.id.startsWith('temp-')) : []
                      const realTasks = hasData ? clientTasks.filter(t => !t.id.startsWith('temp-')) : []
                      
                      return (
                        <React.Fragment key={client.orgId}>
                          <ClientGroupHeader
                            clientId={client.orgId}
                            clientName={isAgency ? client.name : undefined}
                            clientLogoUrl={isAgency ? client.logoUrl : undefined}
                            agencyId={!isAgency ? client.orgId : undefined}
                            agencyName={!isAgency ? client.name : undefined}
                            agencyLogoUrl={!isAgency ? client.logoUrl : undefined}
                            count={knownCount}
                            isCollapsed={isClientCollapsed}
                            onToggle={() => {
                              const wasCollapsed = isClientCollapsed
                              onToggleClient(status, client.orgId)
                              // Fetch if expanding (was collapsed, now will be expanded)
                              // Always fetch if we haven't fetched yet (undefined) OR cache is incomplete
                              if (wasCollapsed && !isLoading && onFetchClientTasks) {
                                const cacheKey = `${status}-${client.orgId}`
                                const hasOptimistic = hasOptimisticData?.(cacheKey) ?? false
                                const expectedCount = knownCount
                                const cachedCount = hasData ? clientTasks.length : 0
                                
                                // Fetch if: haven't fetched yet OR optimistic data exists OR cache is incomplete
                                if (!hasData || hasOptimistic || cachedCount < expectedCount) {
                                  onFetchClientTasks(status, client.orgId)
                                }
                              }
                            }}
                            isAgency={isAgency}
                          />
                          {isExpanded && (
                            <>
                              {/* CASE 1: We have never fetched this OR we have optimistic tasks but no real data yet.
                                  Show optimistic tasks (if any) above the skeleton. */}
                              {(!hasData || (hasData && optimisticTasks.length > 0 && realTasks.length === 0 && isLoading)) && (
                                <>
                                  {/* Render optimistic tasks FIRST (at the top) if they exist */}
                                  {optimisticTasks.map((task) => (
                                    <GlobalTaskRow
                                      key={task.id}
                                      task={task}
                                      isAgency={isAgency}
                                      clientEditableMembers={getClientEditableMembersForTask(task.connectionId)}
                                      comboboxOptions={getComboboxOptionsForTask(task.connectionId)}
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
                                  ))}
                                  
                                  {/* Show skeleton while loading (existing skeleton logic) */}
                                  <div className="space-y-0">
                                    {[1, 2, 3].map((i) => (
                                      <div
                                        key={i}
                                        className="border-b border-[var(--color-neutral-4)] h-[44px] grid items-center"
                                        style={{
                                          gridTemplateColumns: '44px 4fr 3fr 3fr 3fr 3fr 44px',
                                        }}
                                      >
                                        <div></div>
                                        <div className="px-3">
                                          <Skeleton className="w-32 h-4 rounded" />
                                        </div>
                                        <div className="px-3">
                                          <Skeleton className="w-20 h-4 rounded" />
                                        </div>
                                        <div className="px-3">
                                          <Skeleton className="w-16 h-4 rounded" />
                                        </div>
                                        <div className="px-3">
                                          <Skeleton className="w-24 h-4 rounded" />
                                        </div>
                                        <div className="px-3">
                                          <Skeleton className="w-20 h-4 rounded" />
                                        </div>
                                        <div></div>
                                      </div>
                                    ))}
                                  </div>
                                </>
                              )}
                              
                              {/* CASE 2: We fetched, and it's truly empty (no optimistic tasks either). */}
                              {hasData && isEmpty && optimisticTasks.length === 0 && (
                                <div className="px-5 py-3 text-sm-regular text-[var(--color-base-text-tertiary)]">
                                  No tasks found
                                </div>
                              )}
                              
                              {/* CASE 3: We have data (optimistic or real). Render optimistic tasks first, then real tasks. */}
                              {hasData && !isEmpty && !(optimisticTasks.length > 0 && realTasks.length === 0 && isLoading) && (
                                <>
                                  {/* Render optimistic tasks FIRST (at the top) */}
                                  {optimisticTasks.map((task) => (
                                    <GlobalTaskRow
                                      key={task.id}
                                      task={task}
                                      isAgency={isAgency}
                                      clientEditableMembers={getClientEditableMembersForTask(task.connectionId)}
                                      comboboxOptions={getComboboxOptionsForTask(task.connectionId)}
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
                                  ))}
                                  
                                  {/* Render real tasks (below optimistic) */}
                                  {realTasks.map((task) => (
                                    <GlobalTaskRow
                                      key={task.id}
                                      task={task}
                                      isAgency={isAgency}
                                      clientEditableMembers={getClientEditableMembersForTask(task.connectionId)}
                                      comboboxOptions={getComboboxOptionsForTask(task.connectionId)}
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
                                  ))}
                                </>
                              )}
                            </>
                          )}
                        </React.Fragment>
                      )
                    })}
                    {!isStatusCollapsed && clients.length === 0 && (
                      <div className="px-5 py-3 text-sm-regular text-[var(--color-base-text-tertiary)]">
                        No clients found
                      </div>
                    )}
                  </React.Fragment>
                )
              })}
            </div>
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
