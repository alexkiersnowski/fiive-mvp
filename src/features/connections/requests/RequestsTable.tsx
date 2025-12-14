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
import { Plus, SortAscending, Eye, Users } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { updateRequestAssignee, updateRequestStatus, deleteRequest, fetchProjectsForConnection } from './actions'
import { groupRequestsByStatus, sortRequestsForDisplay, type RequestStatus } from './requestSort'
import type { Request } from '../server'
import { useConnection } from '../ConnectionContext'
import { RequestRow } from './RequestRow'
import { StatusSection } from './StatusSection'
import { useRequestDragDrop } from './useRequestDragDrop'
import { Skeleton } from '@/components/ui/skeleton'

// Drag ghost offset from cursor (pixels from left edge of row)
const DRAG_GHOST_OFFSET_X = 200
const DRAG_GHOST_OFFSET_Y = 22 // Half of row height (44px / 2)

// Status order: new, in_review, accepted, closed, canceled
const REQUEST_STATUS_ORDER: RequestStatus[] = ['new', 'in_review', 'accepted', 'closed', 'canceled']

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
  onRequestUpdate?: (requestId: string, updates: { title?: string; description?: string; status?: 'new' | 'in_review' | 'accepted' | 'canceled' | 'closed'; assignee?: Request['assignee'] }) => void
  currentOrgId: string
  onLoadMore?: (virtualRows: any[]) => void
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
  onRequestDeleted?: (requestId: string) => void
  onConvertToTask?: (request: Request) => void
  statusCounts?: Record<string, number> // Server-side status counts to prevent flicker
}

export default function RequestsTable({ userAvatar = '', userInitials = 'U', onRequestClick, onNewRequest, requests = [], agencyMembers = [], onRequestUpdate, currentOrgId, onLoadMore, searchQuery = '', onSearchChange, totalCount, unfilteredTotalCount = 0, parentRef, assignedToMe = false, onToggleAssignedToMe, isBootstrapping = false, isAgency = false, agencyOrganization, onRequestDeleted, onConvertToTask, statusCounts: statusCountsProp }: RequestsTableProps) {
  const { snapshot: _snapshot, isDisconnected } = useConnection()
  const pathname = usePathname()
  const baseRoute = pathname.includes('/clients/') ? 'clients' : 'agencies'
  
  const [openActionsDropdown, setOpenActionsDropdown] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  
  // Ensure requests are sorted before grouping (safeguard)
  const sortedRequests = useMemo(() => sortRequestsForDisplay(requests), [requests])
  
  // Group requests by status (always grouped, even when filtering)
  const requestsByStatus = useMemo(() => {
    return groupRequestsByStatus(sortedRequests)
  }, [sortedRequests])

  // Compute filtered counts per status (for status headers when filtering)
  const filteredStatusCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const status of REQUEST_STATUS_ORDER) {
      counts[status] = requestsByStatus[status]?.length || 0
    }
    return counts
  }, [requestsByStatus])
  
  const statusInlineRefs = useRef<Record<string, InlineEditRef | null>>({})
  
  // Loading guard refs to prevent rapid-fire mutations
  const isMutingAssignee = useRef(false)
  
  // Track pending status updates per request ID to prevent flickering
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
  const currentSortLabel = 'Created'

  // Assignee handlers with loading guard
  const handleAssigneeSelect = useCallback(async (requestId: string, memberId: string) => {
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
  }, [agencyMembers, onRequestUpdate, requests])

  const handleClearAssignee = useCallback(async (requestId: string) => {
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
  }, [onRequestUpdate, requests])

  // Status handler with loading guard and pending update tracking
  const handleStatusChange = useCallback(async (requestId: string, newStatus: string): Promise<void> => {
    const validStatuses = ['new', 'in_review', 'accepted', 'canceled', 'closed'] as const
    if (!(validStatuses as readonly string[]).includes(newStatus)) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Invalid status:', newStatus)
      }
      return
    }
    
    const typedStatus = newStatus as RequestStatus
    
    // Cancel any existing pending update for this request
    const existingPending = pendingStatusUpdatesRef.current.get(requestId)
    if (existingPending) {
      existingPending.abortController.abort()
      pendingStatusUpdatesRef.current.delete(requestId)
    }
    
    // Create new AbortController for this update
    const abortController = new AbortController()
    pendingStatusUpdatesRef.current.set(requestId, {
      status: typedStatus,
      abortController
    })
    
    // Notify parent for bidirectional updates (table → modal)
    if (onRequestUpdate) {
      onRequestUpdate(requestId, { status: typedStatus })
    }
    
    try {
      await updateRequestStatus(requestId, typedStatus)
      
      // Check if this update was aborted before processing
      if (abortController.signal.aborted) {
        return
      }
      
      // Check if this update is still the latest before applying
      const pendingUpdate = pendingStatusUpdatesRef.current.get(requestId)
      if (pendingUpdate && pendingUpdate.status === typedStatus && !abortController.signal.aborted) {
        // Real-time subscription will handle UI updates
      }
      // If update was superseded, don't apply changes
    } catch (error) {
      // Ignore abort errors (request was cancelled by a newer update)
      // Check both the signal and if it's an AbortError
      if (abortController.signal.aborted || (error instanceof Error && error.name === 'AbortError')) {
        return
      }
      
      // Only handle error if this update is still the latest
      const pendingUpdate = pendingStatusUpdatesRef.current.get(requestId)
      if (pendingUpdate && pendingUpdate.status === typedStatus && !abortController.signal.aborted) {
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
      }
    } finally {
      // Clean up pending update if this was the latest one
      // Only clean up if this specific update (by status match) is still pending
      const pendingUpdate = pendingStatusUpdatesRef.current.get(requestId)
      if (pendingUpdate && pendingUpdate.status === typedStatus) {
        pendingStatusUpdatesRef.current.delete(requestId)
      }
    }
  }, [onRequestUpdate, requests])

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
  const handleRowClick = useCallback((requestId: string) => {
    // Prevent modal opening if drag occurred
    // hasDragged is managed by useRequestDragDrop hook
    onRequestClick?.(requestId)
  }, [onRequestClick])
  
  // Check if user can drag a request (same permissions as editing status)
  // Only agencies can drag requests (clients cannot edit request status)
  const canDragRequest = useCallback((_request: Request) => {
    if (isDisconnected) return false
    return isAgency
  }, [isDisconnected, isAgency])
  
  // Use drag & drop hook (simplified logic)
  const {
    draggedRequestId,
    dragStartPosition,
    hoveredGroupStatus,
    dragOffset,
    hasDragged,
    handleDragStart,
    dragGhostProps
  } = useRequestDragDrop({
    onStatusChange: async (requestId, newStatus) => {
      await handleStatusChange(requestId, newStatus)
    },
    onRequestUpdate,
    requests,
    containerRef,
    parentRef,
    openActionsDropdown
  })

  // Update handleRowClick to use hasDragged from hook
  const handleRowClickWithDragCheck = useCallback((requestId: string) => {
    if (hasDragged) {
      return
    }
    onRequestClick?.(requestId)
  }, [hasDragged, onRequestClick])

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
              placeholder="Search requests by title…"
              value={searchQuery || ''}
              onChange={(value) => {
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
              className="cursor-default text-sm-regular h-[32px] flex items-center gap-2 shadow-none pointer-events-none"
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
                    ? '44px 4fr 3fr 3fr 3fr 3fr 44px'
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
              {/* Request Row Skeletons - 20 per status group */}
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20].map((requestIndex) => (
                <div
                  key={requestIndex}
                  className="border-b border-[var(--color-neutral-4)] h-[44px] grid items-center"
                  style={{
                    gridTemplateColumns: isAgency 
                      ? '44px 4fr 3fr 3fr 3fr 3fr 44px'
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
                  {/* Assignee/Owner */}
                  <div className="px-3">
                    <Skeleton className="w-16 h-4 rounded" />
                  </div>
                  {/* Project */}
                  <div className="px-3">
                    <Skeleton className="w-20 h-4 rounded" />
                  </div>
                  {/* Created */}
                  <div className="px-3">
                    <Skeleton className="w-24 h-4 rounded" />
                  </div>
                  {/* Actions */}
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
                {REQUEST_STATUS_ORDER.map((status: RequestStatus) => {
                  // Use filtered counts when filtering, otherwise use server counts
                  const count = hasActiveFilters
                    ? filteredStatusCounts[status] || 0
                    : (statusCountsProp?.[status] || requestsByStatus[status]?.length || 0)
                  
                  return (
                    <StatusSection
                      key={status}
                      status={status}
                      requests={requestsByStatus[status] || []}
                      count={count}
                      // NO isExpanded prop - StatusSection owns this
                      // NO onToggle prop - StatusSection handles toggle internally
                      onDrop={(requestId) => handleStatusChange(requestId, status)}
                      isAgency={isAgency}
                      isDisconnected={isDisconnected}
                      comboboxOptions={comboboxOptions}
                      agencyMembers={agencyMembers}
                      agencyOrganization={agencyOrganization}
                      statusInlineRefs={statusInlineRefs}
                      onStatusChange={handleStatusChange}
                      onAssigneeSelect={handleAssigneeSelect}
                      onClearAssignee={handleClearAssignee}
                      onRowClick={handleRowClickWithDragCheck}
                      onCopyLink={handleCopyLink}
                      onDeleteRequest={handleDeleteRequest}
                      onContactClick={handleContactClick}
                      openActionsDropdown={openActionsDropdown}
                      setOpenActionsDropdown={setOpenActionsDropdown}
                      baseRoute={baseRoute}
                      currentOrgId={currentOrgId}
                      onConvertToTask={onConvertToTask}
                      draggedRequestId={draggedRequestId}
                      onDragStart={handleDragStart}
                      canDragRequest={canDragRequest}
                      isDraggingActive={draggedRequestId !== null}
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
      {dragGhostProps.draggedRequestId && dragGhostProps.dragStartPosition && dragGhostProps.dragOffset && (() => {
        const draggedRequest = requests.find(r => r.id === dragGhostProps.draggedRequestId)
        if (!draggedRequest) return null
        
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
            <RequestRow
              request={draggedRequest}
              isAgency={isAgency}
              isDisconnected={isDisconnected}
              comboboxOptions={comboboxOptions}
              agencyMembers={agencyMembers}
              agencyOrganization={agencyOrganization}
              statusInlineRefs={statusInlineRefs}
              onStatusChange={handleStatusChange}
              onAssigneeSelect={handleAssigneeSelect}
              onClearAssignee={handleClearAssignee}
              onRowClick={() => {}}
              onCopyLink={handleCopyLink}
              onDeleteRequest={handleDeleteRequest}
              onContactClick={handleContactClick}
              openActionsDropdown={null}
              setOpenActionsDropdown={() => {}}
              baseRoute={baseRoute}
              currentOrgId={currentOrgId}
              onConvertToTask={onConvertToTask}
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
