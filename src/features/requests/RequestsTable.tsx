"use client"

import { useState, useRef, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { SearchInput } from '@/components/ui/search-input'
import AvatarButton from '@/components/ui/avatar-button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { ListRow } from '@/components/ui/list-row'
import { Badge } from '@/components/ui/badge'
import { RequestBadge } from '@/components/ui/request-badge'
import { InlineEdit } from '@/components/ui/inline-edit'
import { ProfileCard } from '@/components/ui/profile-card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Plus, SortAscending, DotsThree, MagnifyingGlass, FlowArrow, LinkSimple, Trash, User, CaretDown, Check } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { updateRequestAssignee, updateRequestStatus } from '@/features/connections/requests/actions'
import type { Request } from './types'
import { useVirtualTable, VirtualTableBody } from '@/components/virtual-table'

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
  onRequestUpdate?: (requestId: string, updates: { title?: string; description?: string; status?: 'new' | 'in_review' | 'accepted' | 'canceled'; assignee?: any }) => void
  currentOrgId: string
  onLoadMore?: (virtualRows: any[]) => void
  onSearchChange?: (query: string) => void
  totalCount?: number
  unfilteredTotalCount?: number
  parentRef?: React.RefObject<HTMLDivElement | null>
  headerOffset?: number
  assignedToMe?: boolean
  onToggleAssignedToMe?: () => void
  isBootstrapping?: boolean
  isAgency?: boolean
  onRequestDeleted?: (requestId: string) => void
  onConvertToTask?: (request: Request) => void
  sortOptions?: Array<{
    value: string
    label: string
    buttonLabel: string
  }>
  sortValue?: string
  onSortChange?: (value: string) => void
}

export default function RequestsTable({ userAvatar = '', userInitials = 'U', onRequestClick, onNewRequest, requests = [], agencyMembers = [], onRequestUpdate, currentOrgId, onLoadMore, onSearchChange, totalCount, unfilteredTotalCount = 0, parentRef, headerOffset = 0, assignedToMe = false, onToggleAssignedToMe, isBootstrapping = false, isAgency = false, onRequestDeleted, onConvertToTask, sortOptions = [], sortValue: propSortValue = 'created', onSortChange }: RequestsTableProps) {
  const router = useRouter()
  
  const [searchQuery, setSearchQuery] = useState('')
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false)
  const [openActionsDropdown, setOpenActionsDropdown] = useState<string | null>(null)
  
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

  // Current sort label (memoized based on sortValue)
  const currentSortLabel = useMemo(() => 
    sortOptions.find(option => option.value === propSortValue)?.buttonLabel || 'Created',
    [sortOptions, propSortValue]
  )

  const handleSortChange = (newSortValue: string) => {
    onSortChange?.(newSortValue)
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
    if (!validStatuses.includes(newStatus as any)) {
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
    // Determine baseRoute based on isAgency prop
    // Agencies view clients, clients view agencies
    const baseRoute = isAgency ? 'clients' : 'agencies'
    const fullUrl = `${window.location.origin}/${baseRoute}/${connectionId}/requests/${requestId}`
    navigator.clipboard.writeText(fullUrl).then(() => {
      toast.success('Link copied to clipboard')
    }).catch(() => {
      toast.error('Failed to copy link')
    })
  }
  
  const handleDeleteRequest = async (requestId: string) => {
    // Optimistically notify parent immediately (removes from UI instantly)
    // Parent handles API call, error recovery, and toast notifications
    onRequestDeleted?.(requestId)
  }

  // Virtual scroll setup using shared hook
  const { containerRef, rowVirtualizer, virtualItems, isNearEnd } = useVirtualTable({
    items: requests,
    onLoadMore,
    scrollRestoreDeps: [searchQuery],
    parentRef
  })
  
  // Check if there are active filters
  const hasActiveFilters = searchQuery.trim().length > 0 || assignedToMe
  
  // isNearEnd available for future use (e.g., showing loading indicator)

  // Empty state logic: ONLY show empty state when no requests exist at all
  // When requests exist but search returns no results, VirtualTableBody will show "No results found"
  // This matches the behavior of the connection-specific RequestsTable
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
        colSpan={8} 
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
          {onNewRequest && (
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
                  placeholder="Search requests…"
                  value={searchQuery}
                  onChange={(value) => {
                    setSearchQuery(value)
                    onSearchChange?.(value)
                  }}
                  count={requestCount}
                  countLabel={(requestCount as number) === 1 ? 'request' : 'requests'}
                />
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
                      Client
                    </TableHead>
                    <TableHead className="w-[15%] py-0 text-xs-regular text-[var(--color-base-text-tertiary)] truncate">
                      Submitted by
                    </TableHead>
                    <TableHead className="w-[12%] py-0 text-xs-regular text-[var(--color-base-text-tertiary)] truncate">
                      Project
                    </TableHead>
                    <TableHead className="w-[12%] py-0 text-xs-regular text-[var(--color-base-text-tertiary)] truncate">
                      Assignee
                    </TableHead>
                    <TableHead className="w-[12%] py-0 text-xs-regular text-[var(--color-base-text-tertiary)] truncate">
                      Created
                    </TableHead>
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
                    className="w-[12%] py-0" 
                    onClick={(e) => e.stopPropagation()}
                  >
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
                  </TableCell>
                ) : (
                  <TableCell className="w-[12%] py-0">
                    <RequestBadge 
                      variant={request.status as 'new' | 'in_review' | 'accepted' | 'canceled'} 
                      size="sm" 
                      showText={true}
                      customLabel={request.status === 'new' ? 'Submitted' : undefined}
                      className="inline-flex"
                    />
                  </TableCell>
                )}

                {/* Client/Connection column */}
                <TableCell className="w-[15%] py-0">
                  <div className="flex items-center gap-2">
                    <Avatar className="w-5 h-5">
                      <AvatarImage src={request.client.logoUrl} alt={request.client.name} />
                      <AvatarFallback 
                        className="text-[10px] font-medium text-white"
                        style={{ background: 'var(--color-neutral-9, #8B8D98)' }}
                      >
                        {request.client.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm-regular truncate" style={{ color: 'var(--color-base-text-primary)' }}>
                      {request.client.name}
                    </span>
                  </div>
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

                <TableCell className="w-[12%] py-0">
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
                  className="w-[12%] py-0"
                  onClick={(e: React.MouseEvent) => e.stopPropagation()}
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
                    comboboxOptions={comboboxOptions}
                    onComboboxSelect={(memberId) => handleAssigneeSelect(request.id, memberId)}
                    comboboxPlaceholder="Search members..."
                    comboboxWidth="240px"
                    clearable={!!request.assignee}
                    onClear={() => handleClearAssignee(request.id)}
                  />
                </TableCell>

                <TableCell className="w-[12%] py-0 truncate">
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
                        {isAgency && (
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
                        {request.createdByOrgId === currentOrgId && (
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

