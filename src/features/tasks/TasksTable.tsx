"use client"

import { useState, useRef, useMemo, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Table, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { SearchInput } from '@/components/ui/search-input'
import AvatarButton from '@/components/ui/avatar-button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { ListRow } from '@/components/ui/list-row'
import { Badge } from '@/components/ui/badge'
import { TaskBadge } from '@/components/ui/task-badge'
import { InlineEdit, type InlineEditRef } from '@/components/ui/inline-edit'
import { ProfileCard } from '@/components/ui/profile-card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Plus, SortAscending, DotsThree, MagnifyingGlass, LinkSimple, Trash, User, Eye, EyeSlash, CaretDown, Check, LockSimple, ClipboardText } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { updateTaskAssignee, updateTaskStatus } from '@/features/connections/tasks/actions'
import type { Task } from './types'
import { useVirtualTable, VirtualTableBody } from '@/components/virtual-table'
import type { VirtualItem } from '@tanstack/react-virtual'
import { dispatchTaskAssignedChanged } from '@/features/home/cards/stats/TasksAssignedCard'
import { createClient as createSupabaseBrowserClient } from '@/lib/supabase/client'

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
  onTaskUpdate?: (taskId: string, updates: { title?: string; description?: string; status?: 'to_do' | 'in_progress' | 'on_hold' | 'done'; assignee?: Task['assignee']; clientVisible?: boolean; clientVisibilityLocked?: boolean; dueDate?: string | null; dueDateRaw?: string | null; createdAtRaw?: string | null }) => void
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
  sortOptions?: Array<{
    value: string
    label: string
    buttonLabel: string
  }>
  sortValue?: string
  onSortChange?: (value: string) => void
}

export default function TasksTable({ userAvatar = '', userInitials = 'U', onTaskClick, onNewTask, tasks = [], agencyMembers = [], membersByConnection = {}, onTaskUpdate, currentOrgId, onLoadMore, onSearchChange, totalCount, unfilteredTotalCount = 0, parentRef, headerOffset = 0, assignedToMe = false, onToggleAssignedToMe, isBootstrapping = false, isAgency = false, onTaskDeleted, sortOptions = [], sortValue: propSortValue = 'due_date', onSortChange }: TasksTableProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false)
  const [openActionsDropdown, setOpenActionsDropdown] = useState<string | null>(null)
  
  // Track client org user IDs for event dispatching (only for client context)
  const [clientOrgUserIds, setClientOrgUserIds] = useState<Set<string>>(new Set())

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

  // Current sort label (memoized based on sortValue)
  const currentSortLabel = useMemo(() => 
    sortOptions.find(option => option.value === propSortValue)?.buttonLabel || 'Due date',
    [sortOptions, propSortValue]
  )

  const handleSortChange = (newSortValue: string) => {
    onSortChange?.(newSortValue)
  }

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
      
      try {
        await updateTaskAssignee(taskId, memberId)
      } catch (error) {
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
      } finally {
        isMutingAssignee.current = false
      }
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
    // For now, we'll dispatch the event and let the real-time subscription handle the actual completed_at change.
    // The event will be dispatched with the old completed_at, and the real-time update will provide the new one.
    const newCompletedAt = typedStatus === 'done' ? new Date().toISOString() : null;
    
    if (onTaskUpdate) {
      onTaskUpdate(taskId, { status: typedStatus })
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
    
    try {
      await updateTaskStatus(taskId, typedStatus)
    } catch (error) {
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
    } finally {
      isMutingStatus.current = false
    }
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
    // Determine baseRoute based on isAgency prop
    // Agencies view clients, clients view agencies
    const baseRoute = isAgency ? 'clients' : 'agencies'
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

  // Virtual scroll setup using shared hook
  const { containerRef, rowVirtualizer, virtualItems, isNearEnd: _isNearEnd } = useVirtualTable({
    items: tasks,
    onLoadMore,
    scrollRestoreDeps: [searchQuery],
    parentRef
  })
  
  const hasActiveFilters = searchQuery.trim().length > 0 || assignedToMe
  const isEmptyState = !isBootstrapping && unfilteredTotalCount === 0;

  const emptyStateColSpan = isAgency ? 8 : 7 // 8 columns if agency (includes visibility), 7 if client

  const emptyState = isEmptyState ? (
    <TableRow 
      className="hover:bg-transparent"
      style={{ 
        backgroundColor: 'var(--color-base-surface-page-background)', 
        borderBottomColor: 'var(--color-neutral-5)',
        height: '100%'
      }}
    >
      <TableCell 
        colSpan={emptyStateColSpan} 
        className="text-left" 
        style={{ height: 'calc(100vh - 267px)', minHeight: '400px', paddingLeft: '120px' }}
      >
        <div className="flex flex-col items-start justify-center h-full gap-4" style={{ transform: 'translateY(-40px)' }}>
          <div className="flex flex-col items-start gap-2">
            <h2 className="display-8-medium">Your best work starts here</h2>
            <span className="text-sm-regular text-neutral-11">
              {isAgency 
                ? 'Add action items for your team or client, and choose what stays client-visible.'
                : 'Ask questions, share updates, or task new work directly from your agency.'
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
      </TableCell>
    </TableRow>
  ) : null

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
                  placeholder="Search tasks…"
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
                <DropdownMenu modal={false} open={isSortDropdownOpen} onOpenChange={setIsSortDropdownOpen}>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      className={`text-sm-regular h-[32px] flex items-center gap-2 shadow-none cursor-pointer transition-all duration-75 ${
                        isSortDropdownOpen
                          ? 'bg-interactive-surface-hover hover:bg-interactive-surface-hover'
                          : 'hover:bg-interactive-surface-hover'
                      }`}
                    >
                      <SortAscending size={16} />
                      {currentSortLabel}
                      <CaretDown size={16} />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-64">
                    {sortOptions.map((option) => (
                      <DropdownMenuItem
                        key={option.value}
                        onClick={(e) => {
                          handleSortChange(option.value)
                          setIsSortDropdownOpen(false)
                          const trigger = e.currentTarget.closest('[data-radix-dropdown-menu-trigger]') as HTMLElement
                          setTimeout(() => {
                            trigger?.blur()
                          }, 0)
                        }}
                        className="flex items-center justify-between"
                      >
                        <span>{option.label}</span>
                        {propSortValue === option.value && <Check size={16} className="text-inherit" />}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>

          {/* Table Header */}
          {(unfilteredTotalCount > 0 || hasActiveFilters) && (
            <div className="px-5">
              <Table className="table-fixed w-full border-collapse">
                <TableHeader>
                  <TableRow
                    className="hover:bg-transparent"
                    style={{
                      borderBottom: '1px solid var(--color-neutral-4)',
                    }}
                  >
                    <TableHead className="w-[25%] py-0 text-xs-regular text-[var(--color-base-text-tertiary)] truncate">
                      Title
                    </TableHead>
                    <TableHead className="w-[12%] py-0 text-xs-regular text-[var(--color-base-text-tertiary)] truncate">
                      Status
                    </TableHead>
                    <TableHead className="w-[15%] py-0 text-xs-regular text-[var(--color-base-text-tertiary)] truncate">
                      {isAgency ? 'Client' : 'Agency'}
                    </TableHead>
                    <TableHead className="w-[15%] py-0 text-xs-regular text-[var(--color-base-text-tertiary)] truncate">
                      Assignee
                    </TableHead>
                    <TableHead className="w-[12%] py-0 text-xs-regular text-[var(--color-base-text-tertiary)] truncate">
                      Due date
                    </TableHead>
                    <TableHead className="w-[12%] py-0 text-xs-regular text-[var(--color-base-text-tertiary)] truncate">
                      Project
                    </TableHead>
                    {isAgency && (
                      <TableHead className="w-[44px] py-0 p-0 text-xs-medium text-[var(--color-base-text-tertiary)]">
                        <span className="sr-only">Visibility</span>
                      </TableHead>
                    )}
                    <TableHead className="w-[44px] py-0 p-0 text-xs-medium text-[var(--color-base-text-tertiary)]">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
              </Table>
            </div>
          )}
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
          <div className="px-5 pb-5">
          {isBootstrapping && tasks.length === 0 ? (
            <div>
              <div className="h-[44px] rounded-md bg-[var(--color-neutral-6)] animate-pulse" />
            </div>
          ) : (
            <VirtualTableBody
            items={tasks}
            virtualItems={virtualItems}
            rowVirtualizer={rowVirtualizer}
            onRowClick={(task) => handleRowClick(task.id)}
            emptyState={isEmptyState ? emptyState : undefined}
            renderRow={(task) => (
              <>
                <TableCell className="w-[25%] py-0 truncate">
                  {task.title}
                </TableCell>

                {(() => {
                  const clientEditableMembers = getClientEditableMembersForTask(task.connectionId);
                  const canEditStatus = isAgency || (task.assignee ? clientEditableMembers.idSet.has(task.assignee.id) : false);
                  
                  if (canEditStatus) {
                    return (
                      <TableCell 
                        className="w-[12%] py-0" 
                        onClick={(e) => e.stopPropagation()}
                      >
                        <InlineEdit
                          ref={(instance) => {
                            statusInlineRefs.current[task.id] = instance
                          }}
                          type="badge"
                          value={task.status}
                          options={[
                            { value: 'to_do', label: 'To do' },
                            { value: 'in_progress', label: 'In progress' },
                            { value: 'on_hold', label: 'On hold' },
                            { value: 'done', label: 'Done' },
                          ]}
                          onSave={(newStatus) => {
                            statusInlineRefs.current[task.id]?.closePopover()
                            handleStatusChange(task.id, newStatus)
                          }}
                          badgeComponent="task"
                          className="truncate h-6 rounded-[8px]"
                        />
                      </TableCell>
                    );
                  }
                  
                  return (
                    <TableCell className="w-[12%] py-0">
                      <TaskBadge 
                        variant={task.status as 'to_do' | 'in_progress' | 'on_hold' | 'done'} 
                        size="sm" 
                        showText={true}
                        className="inline-flex"
                      />
                    </TableCell>
                  );
                })()}

                {/* Client/Agency column */}
                <TableCell className="w-[15%] py-0">
                  <div className="flex items-center gap-2">
                    {isAgency ? (
                      <>
                        <Avatar className="w-5 h-5">
                          <AvatarImage src={task.client.logoUrl} alt={task.client.name} />
                          <AvatarFallback 
                            className="text-[10px] font-medium text-white"
                            style={{ background: 'var(--color-neutral-9, #8B8D98)' }}
                          >
                            {task.client.name.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm-regular truncate" style={{ color: 'var(--color-base-text-primary)' }}>
                          {task.client.name}
                        </span>
                      </>
                    ) : (
                      <>
                        <Avatar className="w-5 h-5">
                          <AvatarImage src={task.agency?.logoUrl} alt={task.agency?.name || ''} />
                          <AvatarFallback 
                            className="text-[10px] font-medium text-white"
                            style={{ background: 'var(--color-neutral-9, #8B8D98)' }}
                          >
                            {task.agency?.name?.charAt(0).toUpperCase() || 'A'}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm-regular truncate" style={{ color: 'var(--color-base-text-primary)' }}>
                          {task.agency?.name || 'Unknown'}
                        </span>
                      </>
                    )}
                  </div>
                </TableCell>

                <TableCell 
                  className="w-[15%] py-0"
                  onClick={(e: React.MouseEvent) => e.stopPropagation()}
                >
                  {isAgency ? (
                    <ListRow
                      avatar={true}
                      avatarUrl={task.assignee ? task.assignee.avatarUrl : undefined}
                      avatarFallback={!task.assignee ? <User size={16} weight="fill" className="text-white" /> : undefined}
                      text={!task.assignee ? "Unassigned" : task.assignee.name}
                      textColor={!task.assignee ? "var(--color-base-text-tertiary)" : "var(--color-base-text-primary)"}
                      variant="stacked"
                      className="min-w-0 min-h-[32px]"
                      comboboxSelectedValue={task.assignee?.id ?? null}
                      comboboxOptions={getComboboxOptionsForTask(task.connectionId)}
                      onComboboxSelect={(memberId) => handleAssigneeSelect(task.id, memberId, task.connectionId)}
                      comboboxPlaceholder="Search members..."
                      comboboxWidth="240px"
                      clearable={!!task.assignee}
                      onClear={() => handleClearAssignee(task.id)}
                    />
                  ) : (
                    (() => {
                      const clientEditableMembers = getClientEditableMembersForTask(task.connectionId);
                      const clientHasOptions = clientEditableMembers.options.length > 0;
                      const assigneeIsClientMember = task.assignee ? clientEditableMembers.idSet.has(task.assignee.id) : false;

                      if (clientHasOptions && (assigneeIsClientMember || !task.assignee)) {
                        return (
                          <ListRow
                            avatar={true}
                            avatarUrl={task.assignee ? task.assignee.avatarUrl : undefined}
                            avatarFallback={!task.assignee ? <User size={16} weight="fill" className="text-white" /> : undefined}
                            text={!task.assignee ? "Unassigned" : task.assignee.name}
                            textColor={!task.assignee ? "var(--color-base-text-tertiary)" : "var(--color-base-text-primary)"}
                            variant="stacked"
                            className="min-w-0 min-h-[32px]"
                            comboboxSelectedValue={task.assignee?.id ?? null}
                            comboboxOptions={clientEditableMembers.options}
                            onComboboxSelect={(memberId) => handleAssigneeSelect(task.id, memberId, task.connectionId)}
                            comboboxPlaceholder="Search members..."
                            comboboxWidth="240px"
                            clearable={false}
                          />
                        );
                      }

                      return (
                        <ListRow
                          avatar={true}
                          avatarUrl={task.assignee ? task.assignee.avatarUrl : undefined}
                          avatarFallback={!task.assignee ? <User size={16} weight="fill" className="text-white" /> : undefined}
                          text={!task.assignee ? "Unassigned" : task.assignee.name}
                          textColor={!task.assignee ? "var(--color-base-text-tertiary)" : "var(--color-base-text-primary)"}
                          variant="stacked"
                          className="min-w-0"
                          nonInteractive={!task.assignee}
                          onClick={task.assignee ? () => {
                            const nameParts = task.assignee!.name.split(' ')
                            // Find member in the task's connection members (or fallback to agencyMembers)
                            const members = membersByConnection[task.connectionId] || agencyMembers;
                            const assigneeMember = members.find(member => member.id === task.assignee!.id)
                            handleContactClick({
                              id: task.assignee!.id,
                              first_name: nameParts[0] || '',
                              last_name: nameParts.slice(1).join(' ') || '',
                              email: task.assignee!.email,
                              avatar_url: task.assignee!.avatarUrl || '',
                              job_title: assigneeMember?.jobTitle,
                              organization: {
                                id: task.agency?.id || '',
                                name: task.agency?.name || '',
                                logo_url: task.agency?.logoUrl || ''
                              }
                            })
                          } : undefined}
                        />
                      );
                    })()
                  )}
                </TableCell>

                <TableCell className="w-[12%] py-0 truncate">
                  <span 
                    className="text-sm-regular" 
                    style={task.dueDate ? undefined : { color: 'var(--color-base-text-tertiary)' }}
                  >
                    {task.dueDate || "No due date"}
                  </span>
                </TableCell>

                <TableCell className="w-[12%] py-0">
                  {task.project ? (
                    <Badge variant="neutral" className="text-xs">
                      {task.project.name}
                    </Badge>
                  ) : null}
                </TableCell>

                {isAgency && (
                  <TableCell 
                    className="w-[44px] p-0"
                  >
                    <div className="flex items-center justify-center h-full">
                      {task.clientVisible ? (
                        <Tooltip delayDuration={250}>
                          <TooltipTrigger asChild>
                            <div>
                              <Eye size={16} weight="fill" style={{ color: 'var(--color-neutral-11)' }} />
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" sideOffset={4}>
                            <p>Visible to client</p>
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        <Tooltip delayDuration={250}>
                          <TooltipTrigger asChild>
                            <div>
                              <EyeSlash size={16} weight="fill" style={{ color: 'var(--color-neutral-11)', opacity: 0.5 }} />
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" sideOffset={4}>
                            <p>Not visible to client</p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  </TableCell>
                )}

                <TableCell 
                  className="w-[44px] p-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-center h-full">
                    <DropdownMenu modal={false} open={openActionsDropdown === task.id} onOpenChange={(open) => setOpenActionsDropdown(open ? task.id : null)}>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          className={`p-0 h-6 w-6 cursor-pointer transition-colors duration-75 ${
                            openActionsDropdown === task.id
                              ? 'bg-[var(--color-interactive-surface-hover)] hover:bg-[var(--color-interactive-surface-hover)]'
                              : 'hover:bg-[var(--color-interactive-surface-hover)]'
                          }`}
                        >
                          <DotsThree size={16} />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-[200px]">
                        <DropdownMenuItem onClick={() => {
                          setOpenActionsDropdown(null)
                          handleRowClick(task.id)
                        }}>
                          <MagnifyingGlass size={16} style={{ color: 'var(--color-base-text-primary)' }} />
                          View details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => {
                          setOpenActionsDropdown(null)
                          handleCopyLink(task.id, task.connectionId)
                        }}>
                          <LinkSimple size={16} style={{ color: 'var(--color-base-text-primary)' }} />
                          Copy link
                        </DropdownMenuItem>
                        {isAgency && (
                          <>
                            <div className="border-t border-[var(--color-neutral-6)] my-1" />
                            <DropdownMenuItem 
                              onClick={() => {
                                handleDeleteTask(task.id)
                                setOpenActionsDropdown(null)
                              }}
                              style={{ color: 'var(--color-red-11)' }}
                            >
                              <Trash size={16} style={{ color: 'var(--color-red-11)' }} />
                              Delete task
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </TableCell>
              </>
            )}
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
    </div>
  )
}

