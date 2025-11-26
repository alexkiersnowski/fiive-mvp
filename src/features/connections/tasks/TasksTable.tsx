"use client"

import { useState, useRef, useEffect, useMemo } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { SearchInput } from '@/components/ui/search-input'
import AvatarButton from '@/components/ui/avatar-button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ListRow } from '@/components/ui/list-row'
import { Badge } from '@/components/ui/badge'
import { TaskBadge } from '@/components/ui/task-badge'
import { InlineEdit, type InlineEditRef } from '@/components/ui/inline-edit'
import { ProfileCard } from '@/components/ui/profile-card'
import { Plus, SortAscending, DotsThree, MagnifyingGlass, FlowArrow, LinkSimple, Trash, User, Eye, EyeSlash, LockSimple, ClipboardText } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { updateTaskAssignee, updateTaskStatus, deleteTask, fetchProjectsForConnection } from './actions'
import { sortTasksWithPinnedFirst, type TaskSortMode } from './taskSort'
import type { Task } from '../server'
import { useVirtualTable, VirtualTableBody } from '@/components/virtual-table'
import { useConnection } from '../ConnectionContext'

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
  onTaskUpdate?: (taskId: string, updates: { title?: string; description?: string; status?: 'to_do' | 'in_progress' | 'on_hold' | 'done'; assignee?: any; clientVisible?: boolean; clientVisibilityLocked?: boolean; dueDate?: string | null; dueDateRaw?: string | null; createdAtRaw?: string | null }) => void
  currentOrgId: string
  onLoadMore?: (virtualRows: any[]) => void
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
  sortMode?: TaskSortMode
}

export default function TasksTable({ userAvatar = '', userInitials = 'U', onTaskClick, onNewTask, tasks = [], agencyMembers = [], onTaskUpdate, currentOrgId, onLoadMore, onSearchChange, totalCount, unfilteredTotalCount = 0, parentRef, assignedToMe = false, onToggleAssignedToMe, isBootstrapping = false, isAgency = false, agencyOrganization, onTaskDeleted, sortMode = 'status' }: TasksTableProps) {
  const { isDisconnected } = useConnection()
  const pathname = usePathname()
  const router = useRouter()
  const baseRoute = pathname.includes('/clients/') ? 'clients' : 'agencies'
  
  const [searchQuery, setSearchQuery] = useState('')
  const [openActionsDropdown, setOpenActionsDropdown] = useState<string | null>(null)
  
  // Client-side sorting function (applied to tasks prop)
  const orderTasks = (list: Task[]) => sortTasksWithPinnedFirst(list, sortMode)
  
  // Apply sorting to tasks prop
  const orderedTasks = useMemo(() => orderTasks(tasks), [tasks, sortMode])
  
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
  
  // Assignee ref for combobox functionality
  const assigneeListRowRef = useRef<HTMLDivElement & { triggerCombobox: () => void } | null>(null)
  const [isAssigneeUnassigned, setIsAssigneeUnassigned] = useState(false)
  
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
  const currentSortLabel = 'Status'

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
      const updates: { assignee: any; clientVisible?: boolean; clientVisibilityLocked?: boolean } = {
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
        toast.success(`Assigned to ${selectedMember.firstName} ${selectedMember.lastName}`)
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
      toast.success('Assignee removed')
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

  // Status handler with loading guard
  const handleStatusChange = async (taskId: string, newStatus: string) => {
    // Prevent rapid-fire mutations
    if (isMutingStatus.current) return
    
    const validStatuses = ['to_do', 'in_progress', 'on_hold', 'done'] as const
    if (!validStatuses.includes(newStatus as any)) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Invalid status:', newStatus)
      }
      return
    }
    
    const typedStatus = newStatus as 'to_do' | 'in_progress' | 'on_hold' | 'done'
    
    // Notify parent for bidirectional updates (table → modal)
    if (onTaskUpdate) {
      onTaskUpdate(taskId, { status: typedStatus })
    }
    
    // Set loading guard
    isMutingStatus.current = true
    
    try {
      await updateTaskStatus(taskId, typedStatus)
      const statusLabels = {
        to_do: 'To do',
        in_progress: 'In progress',
        on_hold: 'On hold',
        done: 'Done'
      }
      toast.success(`Status updated to ${statusLabels[typedStatus]}`)
      // Real-time subscription will handle UI updates
    } catch (error) {
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
    } finally {
      // Clear loading guard
      isMutingStatus.current = false
    }
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

  // Virtual scroll setup using shared hook
  const { containerRef, rowVirtualizer, virtualItems, isNearEnd } = useVirtualTable({
    items: orderedTasks,
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
    <TableRow 
      className="hover:bg-transparent"
      style={{ 
        backgroundColor: 'var(--color-base-surface-page-background)', 
        borderBottomColor: 'var(--color-neutral-5)',
        height: '100%'
      }}
    >
      <TableCell 
        colSpan={7} 
        className="text-left" 
        style={{ height: 'calc(100vh - 352px)', minHeight: '400px', paddingLeft: '120px' }}
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
          {onNewTask && !isDisconnected && (
            <Button 
              variant="outline" 
              size="sm" 
              className="h-6 shadow-none cursor-pointer transition-all duration-75 mt-4"
              onClick={onNewTask}
            >
              <Plus size={16} weight="regular" />
              {isAgency ? 'New task' : 'Submit task'}
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  ) : null

  return (
    <div className="w-full min-w-0">
      {/* Search section - Sticky */}
      <div className="sticky top-10 z-1 bg-[var(--color-base-surface-page-background)] pt-5 pb-4 px-5 rounded-t-lg">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-3">
            <SearchInput
              placeholder="Search by title, project, or status…"
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
      </div>

      {/* Table Header - Sticky */}
      {(unfilteredTotalCount > 0 || hasActiveFilters) && (
      <div className="sticky top-[112px] z-10 bg-[var(--color-base-surface-page-background)] px-5">
        <Table className="table-fixed w-full border-collapse">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[25%] text-xs-regular text-[var(--color-base-text-tertiary)] truncate">
                Title
              </TableHead>
              <TableHead className="w-[18.75%] text-xs-regular text-[var(--color-base-text-tertiary)] truncate">
                Status
              </TableHead>
              <TableHead className="w-[18.75%] text-xs-regular text-[var(--color-base-text-tertiary)] truncate">
                Assignee
              </TableHead>
              <TableHead className="w-[18.75%] text-xs-regular text-[var(--color-base-text-tertiary)] truncate">
                Due date
              </TableHead>
              <TableHead className="w-[18.75%] text-xs-regular text-[var(--color-base-text-tertiary)] truncate">
                Project
              </TableHead>
              {isAgency && (
                <TableHead className="w-[44px] p-0 text-xs-medium text-[var(--color-base-text-tertiary)]">
                  <span className="sr-only">Visibility</span>
                </TableHead>
              )}
              <TableHead className="w-[44px] p-0 text-xs-medium text-[var(--color-base-text-tertiary)]">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
        </Table>
      </div>
      )}

      {/* Table Body - Virtualized Scrollable */}
      <div className="w-full overflow-x-auto" ref={containerRef}>
        <div className="px-5 pb-5">
          {/* During initial assigned=me bootstrap, suppress empty-state flash with skeleton block */}
          {isBootstrapping && tasks.length === 0 ? (
            <div>
              <div className="h-[44px] rounded-md bg-[var(--color-neutral-6)] animate-pulse" />
            </div>
          ) : (
            <VirtualTableBody
            items={orderedTasks}
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
                  const canEditStatus = !isDisconnected && (isAgency || (task.assignee ? clientEditableMembers.idSet.has(task.assignee.id) : false))
                  if (canEditStatus) {
                    return (
                      <TableCell 
                        className="w-[18.75%] py-0" 
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
                          disablePopoverAnimation
                          disableHoverTransition
                          className="truncate h-6 rounded-[8px]"
                        />
                      </TableCell>
                    )
                  }
                  return (
                    <TableCell 
                      className="w-[18.75%] py-0"
                      onClick={isDisconnected ? undefined : (e) => e.stopPropagation()}
                    >
                      <TaskBadge 
                        variant={task.status as 'to_do' | 'in_progress' | 'on_hold' | 'done'} 
                        size="sm" 
                        showText={true}
                        className="inline-flex"
                      />
                    </TableCell>
                  )
                })()}

                <TableCell 
                  className="w-[18.75%] py-0"
                  onClick={isDisconnected ? undefined : (e: React.MouseEvent) => e.stopPropagation()}
                >
                  {isAgency ? (
                    <ListRow
                      ref={assigneeListRowRef}
                      avatar={true}
                      avatarUrl={!isAssigneeUnassigned && task.assignee ? task.assignee.avatarUrl : undefined}
                      avatarFallback={!task.assignee ? <User size={16} weight="fill" className="text-white" /> : undefined}
                      text={!task.assignee ? "Unassigned" : task.assignee.name}
                      textColor={!task.assignee ? "var(--color-base-text-tertiary)" : "var(--color-base-text-primary)"}
                      variant="stacked"
                      className="min-w-0 min-h-[32px]"
                      comboboxSelectedValue={task.assignee?.id ?? null}
                      onClick={() => {
                        // Assignee click handled by combobox
                      }}
                      comboboxOptions={isDisconnected ? undefined : comboboxOptions}
                      onComboboxSelect={isDisconnected ? undefined : (memberId) => handleAssigneeSelect(task.id, memberId)}
                      comboboxPlaceholder={isDisconnected ? undefined : "Search members..."}
                      comboboxWidth={isDisconnected ? undefined : "280px"}
                      clearable={isDisconnected ? false : !!task.assignee}
                      onClear={isDisconnected ? undefined : () => handleClearAssignee(task.id)}
                      nonInteractive={isDisconnected}
                    />
                  ) : (
                    (() => {
                      const clientHasOptions = clientEditableMembers.options.length > 0
                      const assigneeIsClientMember = task.assignee ? clientEditableMembers.idSet.has(task.assignee.id) : false

                      if (clientHasOptions && (assigneeIsClientMember || !task.assignee)) {
                        return (
                          <ListRow
                            avatar={true}
                            avatarUrl={!isAssigneeUnassigned && task.assignee ? task.assignee.avatarUrl : undefined}
                            avatarFallback={!task.assignee ? <User size={16} weight="fill" className="text-white" /> : undefined}
                            text={!task.assignee ? "Unassigned" : task.assignee.name}
                            textColor={!task.assignee ? "var(--color-base-text-tertiary)" : "var(--color-base-text-primary)"}
                            variant="stacked"
                            className="min-w-0 min-h-[32px]"
                            comboboxSelectedValue={task.assignee?.id ?? null}
                            comboboxOptions={isDisconnected ? undefined : clientEditableMembers.options}
                            onComboboxSelect={isDisconnected ? undefined : (memberId) => handleAssigneeSelect(task.id, memberId)}
                            comboboxPlaceholder={isDisconnected ? undefined : "Search members..."}
                            comboboxWidth={isDisconnected ? undefined : "280px"}
                            clearable={false}
                            nonInteractive={isDisconnected}
                          />
                        )
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
                          comboboxSelectedValue={task.assignee?.id ?? null}
                          nonInteractive={isDisconnected || !task.assignee}
                          onClick={task.assignee && !isDisconnected ? () => {
                            const nameParts = task.assignee!.name.split(' ')
                            const assigneeMember = agencyMembers.find(member => member.id === task.assignee!.id)
                            handleContactClick({
                              id: task.assignee!.id,
                              first_name: nameParts[0] || '',
                              last_name: nameParts.slice(1).join(' ') || '',
                              email: task.assignee!.email,
                              avatar_url: task.assignee!.avatarUrl || '',
                              job_title: assigneeMember?.jobTitle,
                              organization: {
                                id: agencyOrganization?.id || '',
                                name: agencyOrganization?.name || '',
                                logo_url: agencyOrganization?.logoUrl || ''
                              }
                            })
                          } : undefined}
                        />
                      )
                    })()
                  )}
                </TableCell>

                <TableCell className="w-[18.75%] py-0 truncate">
                  <span 
                    className="text-sm-regular" 
                    style={task.dueDate ? undefined : { color: 'var(--color-base-text-tertiary)' }}
                  >
                    {task.dueDate || "No due date"}
                  </span>
                </TableCell>

                <TableCell className="w-[18.75%] py-0">
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
                        {!isDisconnected && isAgency && (
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
