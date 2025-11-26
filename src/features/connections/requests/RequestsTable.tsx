"use client"

import { useState, useRef, useMemo } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Table, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { SearchInput } from '@/components/ui/search-input'
import AvatarButton from '@/components/ui/avatar-button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { ListRow } from '@/components/ui/list-row'
import { Badge } from '@/components/ui/badge'
import { RequestBadge } from '@/components/ui/request-badge'
import { InlineEdit } from '@/components/ui/inline-edit'
import { ProfileCard } from '@/components/ui/profile-card'
import { Plus, SortAscending, DotsThree, MagnifyingGlass, FlowArrow, LinkSimple, Trash, User, Eye, Users } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { updateRequestAssignee, updateRequestStatus, deleteRequest, fetchProjectsForConnection } from './actions'
import type { Request } from '../server'
import type { VirtualItem } from '@tanstack/react-virtual'
import { useVirtualTable, VirtualTableBody } from '@/components/virtual-table'
import { useConnection } from '../ConnectionContext'

interface RequestsTableProps {
  userAvatar?: string
  userInitials?: string
  onRequestClick?: (requestId: string) => void
  onNewRequest?: () => void
  requests?: Request[]
  agencyMembers?: Array<{
    id: string
    firstName: string
    lastName: string
    email: string
    avatarUrl?: string
    jobTitle?: string
  }>
  onRequestUpdate?: (requestId: string, updates: { title?: string; description?: string; status?: 'new' | 'in_review' | 'accepted' | 'canceled'; assignee?: Request['assignee'] }) => void
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
  onRequestDeleted?: (requestId: string) => void
  onConvertToTask?: (request: Request) => void
}

export default function RequestsTable({ userAvatar = '', userInitials = 'U', onRequestClick, onNewRequest, requests = [], agencyMembers = [], onRequestUpdate, currentOrgId, onLoadMore, onSearchChange, totalCount, unfilteredTotalCount = 0, parentRef, assignedToMe = false, onToggleAssignedToMe, isBootstrapping = false, isAgency = false, agencyOrganization, onRequestDeleted, onConvertToTask }: RequestsTableProps) {
  const { snapshot: _snapshot, isDisconnected } = useConnection()
  const pathname = usePathname()
  const _router = useRouter()
  const baseRoute = pathname.includes('/clients/') ? 'clients' : 'agencies'
  
  const [searchQuery, setSearchQuery] = useState('')
  const [sortValue, setSortValue] = useState('created')
  const [_isSortDropdownOpen, _setIsSortDropdownOpen] = useState(false)
  const [_requestStatus, _setRequestStatus] = useState('in_review')
  const [openActionsDropdown, setOpenActionsDropdown] = useState<string | null>(null)
  
  // Assignee ref for combobox functionality
  const assigneeListRowRef = useRef<HTMLDivElement & { triggerCombobox: () => void } | null>(null)
  const [isAssigneeUnassigned, _setIsAssigneeUnassigned] = useState(false)
  
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

  // Use total count from database, fallback to displayed requests count if not provided
  const requestCount = totalCount !== undefined ? totalCount : requests.length
  
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

  // Sort options (memoized to prevent recreation)
  const sortOptions = useMemo(() => [
    { value: 'created', label: 'Created (newest first)', buttonLabel: 'Created' },
    { value: 'status', label: 'Status', buttonLabel: 'Status' }
  ], [])

  // Current sort label (memoized based on sortValue)
  const currentSortLabel = useMemo(() => 
    sortOptions.find(option => option.value === sortValue)?.buttonLabel || 'Created',
    [sortOptions, sortValue]
  )

  const _handleSortChange = (newSortValue: string) => {
    setSortValue(newSortValue)
    // Sort will be applied when we implement actual data
  }

  // Assignee handlers with loading guard
  const handleAssigneeSelect = async (requestId: string, memberId: string) => {
    // Prevent rapid-fire mutations
    if (isMutingAssignee.current) return
    
    const selectedMember = agencyMembers.find(member => member.id === memberId)
    if (selectedMember) {
      const newAssignee = {
        id: memberId,
        name: `${selectedMember.firstName} ${selectedMember.lastName}`,
        email: selectedMember.email,
        avatarUrl: selectedMember.avatarUrl
      }
      
      // Notify parent for bidirectional updates (table → modal)
      if (onRequestUpdate) {
        onRequestUpdate(requestId, { assignee: newAssignee })
      }
      
      // Set loading guard
      isMutingAssignee.current = true
      
      try {
        await updateRequestAssignee(requestId, memberId)
        toast.success(`Assigned to ${selectedMember.firstName} ${selectedMember.lastName}`)
        // Real-time subscription will handle UI updates
      } catch (error) {
        if (process.env.NODE_ENV !== 'production') {
          console.error('Failed to update assignee:', error)
        }
        toast.error('Failed to update assignee')
        // Revert parent state on error
        if (onRequestUpdate) {
          const originalRequest = requests.find(r => r.id === requestId)
          if (originalRequest) {
            onRequestUpdate(requestId, { assignee: originalRequest.assignee })
          }
        }
      } finally {
        // Clear loading guard
        isMutingAssignee.current = false
      }
    }
  }

  const handleClearAssignee = async (requestId: string) => {
    // Prevent rapid-fire mutations
    if (isMutingAssignee.current) return
    
    // Notify parent for bidirectional updates (table → modal)
    if (onRequestUpdate) {
      onRequestUpdate(requestId, { assignee: null })
    }
    
    // Set loading guard
    isMutingAssignee.current = true
    
    try {
      await updateRequestAssignee(requestId, null)
      toast.success('Assignee removed')
      // Real-time subscription will handle UI updates
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Failed to clear assignee:', error)
      }
      toast.error('Failed to clear assignee')
      // Revert parent state on error
      if (onRequestUpdate) {
        const originalRequest = requests.find(r => r.id === requestId)
        if (originalRequest) {
          onRequestUpdate(requestId, { assignee: originalRequest.assignee })
        }
      }
    } finally {
      // Clear loading guard
      isMutingAssignee.current = false
    }
  }

  // Status handler with loading guard
  const handleStatusChange = async (requestId: string, newStatus: string) => {
    // Prevent rapid-fire mutations
    if (isMutingStatus.current) return
    
    const validStatuses = ['new', 'in_review', 'accepted', 'canceled'] as const
    if (!(validStatuses as readonly string[]).includes(newStatus)) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Invalid status:', newStatus)
      }
      return
    }
    
    const typedStatus = newStatus as 'new' | 'in_review' | 'accepted' | 'canceled'
    
    // Notify parent for bidirectional updates (table → modal)
    if (onRequestUpdate) {
      onRequestUpdate(requestId, { status: typedStatus })
    }
    
    // Set loading guard
    isMutingStatus.current = true
    
    try {
      await updateRequestStatus(requestId, typedStatus)
      const statusLabels = {
        new: 'New',
        in_review: 'In review',
        accepted: 'Accepted',
        canceled: 'Canceled'
      }
      toast.success(`Status updated to ${statusLabels[typedStatus]}`)
      // Real-time subscription will handle UI updates
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Failed to update status:', error)
      }
      toast.error('Failed to update status')
      // Revert parent state on error
      if (onRequestUpdate) {
        const originalRequest = requests.find(r => r.id === requestId)
        if (originalRequest) {
          onRequestUpdate(requestId, { status: originalRequest.status })
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
  const handleRowClick = (requestId: string) => {
    onRequestClick?.(requestId)
  }

  const handleCopyLink = (requestId: string, connectionId: string) => {
    const fullUrl = `${window.location.origin}/${baseRoute}/${connectionId}/requests/${requestId}`
    navigator.clipboard.writeText(fullUrl).then(() => {
      toast.success('Link copied to clipboard')
    }).catch(() => {
      toast.error('Failed to copy link')
    })
  }
  
  const handleDeleteRequest = async (requestId: string) => {
    // Notify parent for badge count updates
    onRequestDeleted?.(requestId)
    
    try {
      await deleteRequest(requestId)
      toast.success('Request deleted')
      // Real-time subscription will handle UI updates
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Error deleting request:', error)
      }
      toast.error('Failed to delete request')
    }
  }

  // Virtual scroll setup using shared hook
  const { containerRef, rowVirtualizer, virtualItems, isNearEnd: _isNearEnd } = useVirtualTable({
    items: requests,
    onLoadMore,
    scrollRestoreDeps: [searchQuery],
    parentRef
  })
  
  // Check if there are active filters
  const hasActiveFilters = searchQuery.trim().length > 0 || assignedToMe
  
  // isNearEnd available for future use (e.g., showing loading indicator)

  // Empty state logic: ONLY show empty state when no requests exist at all
  // When requests exist but search returns no results, VirtualTableBody will show "no results"
  const isEmptyState = !isBootstrapping && unfilteredTotalCount === 0;

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
        colSpan={isAgency ? 8 : 8} 
        className="text-left" 
        style={{ height: 'calc(100vh - 352px)', minHeight: '400px', paddingLeft: '120px' }}
      >
        <div className="flex flex-col items-start justify-center h-full gap-4" style={{ transform: 'translateY(-40px)' }}>
          <div className="flex flex-col items-start gap-2">
            <h2 className="display-8-medium">Your best work starts here</h2>
            <span className="text-sm-regular text-neutral-11">
              {isAgency 
                ? 'Clients can submit requests from their portal, or you can add one for them.'
                : 'Ask questions, share updates, or request new work directly from your agency.'
              }
            </span>
          </div>
          {onNewRequest && !isDisconnected && (
            <Button 
              variant="outline" 
              size="sm" 
              className="h-6 shadow-none cursor-pointer transition-all duration-75 mt-4"
              onClick={onNewRequest}
            >
              <Plus size={16} weight="regular" />
              {isAgency ? 'New request' : 'Submit request'}
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
              count={requestCount}
              countLabel={(requestCount as number) === 1 ? 'request' : 'requests'}
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
                    <Eye size={12} weight="fill" style={{ color: 'var(--color-neutral-11, #44474f)' }} />
                  ) : (
                    <Users size={12} weight="fill" style={{ color: 'var(--color-neutral-11, #44474f)' }} />
                  )}
                  <span className="ml-1" style={{ color: 'var(--color-neutral-11, #44474f)' }}>
                    {isAgency ? 'Client visible' : 'Collaborate'}
                  </span>
                  </Badge>
                </TooltipTrigger>
                <TooltipContent side="bottom" sideOffset={8}>
                {isAgency 
                  ? 'Visible in client portal'
                  : 'Both you and your agency can manage this'}
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
                {isAgency ? 'Assigned to me' : 'Submitted by me'}
              </TooltipContent>
            </Tooltip>
            <Button
              variant="outline"
              className="text-sm-regular h-[32px] flex items-center gap-2 shadow-none cursor-default pointer-events-none"
            >
              <SortAscending size={16} />
              {currentSortLabel}
            </Button>
            {!isDisconnected && (
              <Button
                variant="default"
                size="lg"
                className="cursor-pointer text-sm flex-shrink-0 h-6"
                style={{ paddingLeft: '16px', paddingRight: '16px' }}
                onClick={() => {
                  onNewRequest?.();
                }}
                onMouseEnter={() => {
                  // Prefetch projects on hover for instant modal opening
                  if (onNewRequest) {
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
                  if (onNewRequest) {
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
                {isAgency ? 'New request' : 'Submit request'}
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
              <TableHead className="w-[15%] text-xs-regular text-[var(--color-base-text-tertiary)] truncate">
                Status
              </TableHead>
              {isAgency ? (
                <>
                  <TableHead className="w-[15%] text-xs-regular text-[var(--color-base-text-tertiary)] truncate">
                    Submitted by
                  </TableHead>
                  <TableHead className="w-[15%] text-xs-regular text-[var(--color-base-text-tertiary)] truncate">
                    Project
                  </TableHead>
                  <TableHead className="w-[15%] text-xs-regular text-[var(--color-base-text-tertiary)] truncate">
                    Assignee
                  </TableHead>
                </>
              ) : (
                <>
                  <TableHead className="w-[15%] text-xs-regular text-[var(--color-base-text-tertiary)] truncate">
                    Owner
                  </TableHead>
                  <TableHead className="w-[15%] text-xs-regular text-[var(--color-base-text-tertiary)] truncate">
                    Project
                  </TableHead>
                  <TableHead className="w-[15%] text-xs-regular text-[var(--color-base-text-tertiary)] truncate">
                    Submitted by
                  </TableHead>
                </>
              )}
              <TableHead className="w-[15%] text-xs-regular text-[var(--color-base-text-tertiary)] truncate">
                Created
              </TableHead>
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
          {isBootstrapping && requests.length === 0 ? (
            <div>
              <div className="h-[44px] rounded-md bg-[var(--color-neutral-6)] animate-pulse" />
            </div>
          ) : (
            <VirtualTableBody
            items={requests}
            virtualItems={virtualItems}
            rowVirtualizer={rowVirtualizer}
            onRowClick={(request) => handleRowClick(request.id)}
            emptyState={isEmptyState ? emptyState : undefined}
            renderRow={(request) => (
              <>
                <TableCell className="w-[25%] py-0 truncate">
                  {request.title}
                </TableCell>

                {isAgency ? (
                  <TableCell 
                    className="w-[15%] py-0" 
                    onClick={isDisconnected ? undefined : (e) => e.stopPropagation()}
                  >
                    {isDisconnected ? (
                      <RequestBadge 
                        variant={request.status as 'new' | 'in_review' | 'accepted' | 'canceled'} 
                        size="sm" 
                        showText={true}
                        className="inline-flex"
                      />
                    ) : (
                      <InlineEdit
                        type="badge"
                        value={request.status}
                        options={[
                          { value: 'new', label: 'New' },
                          { value: 'in_review', label: 'In review' },
                          { value: 'accepted', label: 'Accepted' },
                          { value: 'canceled', label: 'Canceled' },
                        ]}
                        onSave={(newStatus) => handleStatusChange(request.id, newStatus)}
                        badgeComponent="request"
                        className="truncate h-6 rounded-[8px]"
                      />
                    )}
                  </TableCell>
                ) : (
                  <TableCell className="w-[15%] py-0">
                    <RequestBadge 
                      variant={request.status as 'new' | 'in_review' | 'accepted' | 'canceled'} 
                      size="sm" 
                      showText={true}
                      customLabel={request.status === 'new' ? 'Submitted' : undefined}
                      className="inline-flex"
                    />
                  </TableCell>
                )}

                {isAgency ? (
                  <>
                    <TableCell 
                      className="w-[15%] py-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ListRow
                        avatar
                        avatarUrl={request.submittedBy.avatarUrl}
                        text={request.submittedBy.name}
                        variant="stacked"
                        className="min-w-0"
                        onClick={() => {
                          const nameParts = request.submittedBy.name.split(' ')
                          handleContactClick({
                            id: request.submittedBy.id,
                            first_name: nameParts[0] || '',
                            last_name: nameParts.slice(1).join(' ') || '',
                            email: request.submittedBy.email,
                            avatar_url: request.submittedBy.avatarUrl || '',
                            job_title: request.submittedBy.jobTitle || '',
                            organization: {
                              id: request.submittedBy.orgId,
                              name: request.submittedBy.orgName,
                              logo_url: request.submittedBy.orgLogo || ''
                            }
                          })
                        }}
                      />
                    </TableCell>

                    <TableCell className="w-[15%] py-0">
                      {request.project ? (
                        <Badge variant="neutral" className="text-xs">
                          {request.project.name}
                        </Badge>
                      ) : (
                        <Badge variant="neutral" className="text-xs">
                          General request
                        </Badge>
                      )}
                    </TableCell>

                    <TableCell 
                      className="w-[15%] py-0"
                      onClick={isDisconnected ? undefined : (e: React.MouseEvent) => e.stopPropagation()}
                    >
                      <ListRow
                        ref={assigneeListRowRef}
                        avatar={true}
                        avatarUrl={!isAssigneeUnassigned && request.assignee ? request.assignee.avatarUrl : undefined}
                        avatarFallback={!request.assignee ? <User size={16} weight="fill" className="text-white" /> : undefined}
                        text={!request.assignee ? "Unassigned" : request.assignee.name}
                        textColor={!request.assignee ? "var(--color-base-text-tertiary)" : "var(--color-base-text-primary)"}
                        variant="stacked"
                        className="min-w-0 min-h-[32px]"
                      comboboxSelectedValue={request.assignee?.id ?? null}
                        onClick={() => {
                          // Assignee click handled by combobox
                        }}
                        comboboxOptions={isDisconnected ? undefined : comboboxOptions}
                        onComboboxSelect={isDisconnected ? undefined : (memberId) => handleAssigneeSelect(request.id, memberId)}
                        comboboxPlaceholder={isDisconnected ? undefined : "Search members..."}
                        comboboxWidth={isDisconnected ? undefined : "240px"}
                        clearable={isDisconnected ? false : !!request.assignee}
                        onClear={isDisconnected ? undefined : () => handleClearAssignee(request.id)}
                        nonInteractive={isDisconnected}
                      />
                    </TableCell>
                  </>
                ) : (
                  <>
                    <TableCell 
                      className="w-[15%] py-0"
                      onClick={request.assignee && !isDisconnected ? (e: React.MouseEvent) => e.stopPropagation() : undefined}
                    >
                      <ListRow
                        avatar={true}
                        avatarUrl={request.assignee ? request.assignee.avatarUrl : undefined}
                        avatarFallback={!request.assignee ? <User size={16} weight="fill" className="text-white" /> : undefined}
                        text={!request.assignee ? "Unassigned" : request.assignee.name}
                        textColor={!request.assignee ? "var(--color-base-text-tertiary)" : "var(--color-base-text-primary)"}
                        variant="stacked"
                        className="min-w-0"
                      comboboxSelectedValue={request.assignee?.id ?? null}
                        nonInteractive={isDisconnected || !request.assignee}
                        onClick={request.assignee && !isDisconnected ? () => {
                          const nameParts = request.assignee!.name.split(' ')
                          const assigneeMember = agencyMembers.find(member => member.id === request.assignee!.id)
                          handleContactClick({
                            id: request.assignee!.id,
                            first_name: nameParts[0] || '',
                            last_name: nameParts.slice(1).join(' ') || '',
                            email: request.assignee!.email,
                            avatar_url: request.assignee!.avatarUrl || '',
                            job_title: assigneeMember?.jobTitle,
                            organization: {
                              id: agencyOrganization?.id || '',
                              name: agencyOrganization?.name || '',
                              logo_url: agencyOrganization?.logoUrl || ''
                            }
                          })
                        } : undefined}
                      />
                    </TableCell>

                    <TableCell className="w-[15%] py-0">
                      {request.project ? (
                        <Badge variant="neutral" className="text-xs">
                          {request.project.name}
                        </Badge>
                      ) : (
                        <Badge variant="neutral" className="text-xs">
                          General request
                        </Badge>
                      )}
                    </TableCell>

                    <TableCell 
                      className="w-[15%] py-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ListRow
                        avatar
                        avatarUrl={request.submittedBy.avatarUrl}
                        text={request.submittedBy.name}
                        variant="stacked"
                        className="min-w-0"
                        onClick={() => {
                          const nameParts = request.submittedBy.name.split(' ')
                          handleContactClick({
                            id: request.submittedBy.id,
                            first_name: nameParts[0] || '',
                            last_name: nameParts.slice(1).join(' ') || '',
                            email: request.submittedBy.email,
                            avatar_url: request.submittedBy.avatarUrl || '',
                            job_title: request.submittedBy.jobTitle || '',
                            organization: {
                              id: request.submittedBy.orgId,
                              name: request.submittedBy.orgName,
                              logo_url: request.submittedBy.orgLogo || ''
                            }
                          })
                        }}
                      />
                    </TableCell>
                  </>
                )}

                <TableCell className="w-[15%] py-0 truncate">
                  {request.createdAt}
                </TableCell>

                <TableCell 
                  className="w-[44px] p-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-center h-full">
                    <DropdownMenu modal={false} open={openActionsDropdown === request.id} onOpenChange={(open) => setOpenActionsDropdown(open ? request.id : null)}>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          className={`p-0 h-6 w-6 cursor-pointer transition-colors duration-75 ${
                            openActionsDropdown === request.id
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
                          handleRowClick(request.id)
                        }}>
                          <MagnifyingGlass size={16} style={{ color: 'var(--color-base-text-primary)' }} />
                          View details
                        </DropdownMenuItem>
                        {!isDisconnected && isAgency && (
                          <DropdownMenuItem
                            onClick={() => {
                              setOpenActionsDropdown(null)
                              onConvertToTask?.(request)
                            }}
                          >
                            <FlowArrow size={16} style={{ color: 'var(--color-base-text-primary)' }} />
                            Convert to task
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => {
                          setOpenActionsDropdown(null)
                          handleCopyLink(request.id, request.connectionId)
                        }}>
                          <LinkSimple size={16} style={{ color: 'var(--color-base-text-primary)' }} />
                          Copy link
                        </DropdownMenuItem>
                        {!isDisconnected && request.createdByOrgId === currentOrgId && (
                          <>
                            <div className="border-t border-[var(--color-neutral-6)] my-1" />
                            <DropdownMenuItem 
                              onClick={() => {
                                handleDeleteRequest(request.id)
                                setOpenActionsDropdown(null)
                              }}
                              style={{ color: 'var(--color-red-11)' }}
                            >
                              <Trash size={16} style={{ color: 'var(--color-red-11)' }} />
                              Delete request
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
