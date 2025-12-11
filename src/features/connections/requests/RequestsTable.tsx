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
import { groupRequestsByStatus, type RequestStatus } from './requestSort'
import type { Request } from '../server'
import { useVirtualTable, VirtualListBody } from '@/components/virtual-table'
import { useConnection } from '../ConnectionContext'
import type { VirtualItem } from '@tanstack/react-virtual'
import { RequestGroupHeader } from './RequestGroupHeader'
import { RequestRow } from './RequestRow'
import { useStableSet } from '../useStableCollapseState'
import { Skeleton } from '@/components/ui/skeleton'

// Drag ghost offset from cursor (pixels from left edge of row)
const DRAG_GHOST_OFFSET_X = 200
const DRAG_GHOST_OFFSET_Y = 22 // Half of row height (44px / 2)

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
  const baseRoute = pathname.includes('/clients/') ? 'clients' : 'agencies'
  
  const [searchQuery, setSearchQuery] = useState('')
  const [openActionsDropdown, setOpenActionsDropdown] = useState<string | null>(null)
  
  // Track collapsed groups with stable references (default: 'closed' and 'canceled' collapsed, rest expanded)
  const collapsedGroupsState = useStableSet<RequestStatus>(new Set(['closed', 'canceled']))
  
  // Drag & drop state
  const [draggedRequestId, setDraggedRequestId] = useState<string | null>(null)
  const [dragStartPosition, setDragStartPosition] = useState<{ x: number; y: number } | null>(null)
  const [hoveredGroupStatus, setHoveredGroupStatus] = useState<RequestStatus | null>(null)
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null)
  const [hasDragged, setHasDragged] = useState(false)
  const dragStartRef = useRef<{ requestId: string; startX: number; startY: number } | null>(null)
  const hoverDetectionThrottleRef = useRef<number | null>(null)
  
  // Group requests by status and create flattened array structure
  type FlattenedItem = 
    | { type: 'group'; status: RequestStatus; count: number }
    | { type: 'request'; request: Request }
  
  const flattenedItems = useMemo<FlattenedItem[]>(() => {
    const grouped = groupRequestsByStatus(requests)
    // Order: new, in_review, accepted, closed, canceled
    const statusOrder: RequestStatus[] = ['new', 'in_review', 'accepted', 'closed', 'canceled']
    const items: FlattenedItem[] = []
    
    for (const status of statusOrder) {
      const groupRequests = grouped[status]
      // Always show group header, even if 0 requests
      items.push({ type: 'group', status, count: groupRequests.length })
      
      // Add requests if group is not collapsed and has requests
      if (!collapsedGroupsState.set.has(status) && groupRequests.length > 0) {
        for (const request of groupRequests) {
          items.push({ type: 'request', request })
        }
      }
    }
    
    return items
  }, [requests, collapsedGroupsState.set])
  
  // Toggle group collapse/expand - prevent during drag - uses stable reference hook
  const toggleGroup = useCallback((status: RequestStatus) => {
    // Don't toggle if dragging
    if (draggedRequestId !== null) {
      return
    }
    collapsedGroupsState.toggle(status)
  }, [draggedRequestId, collapsedGroupsState])
  
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

  // Status handler with loading guard and pending update tracking
  const handleStatusChange = useCallback(async (requestId: string, newStatus: string): Promise<void> => {
    const validStatuses = ['new', 'in_review', 'accepted', 'canceled', 'closed'] as const
    if (!(validStatuses as readonly string[]).includes(newStatus)) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Invalid status:', newStatus)
      }
      return
    }
    
    const typedStatus = newStatus as 'new' | 'in_review' | 'accepted' | 'canceled' | 'closed'
    
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
    if (hasDragged) {
      return
    }
    onRequestClick?.(requestId)
  }, [hasDragged, onRequestClick])
  
  // Check if user can drag a request (same permissions as editing status)
  // Only agencies can drag requests (clients cannot edit request status)
  const canDragRequest = useCallback((_request: Request) => {
    if (isDisconnected) return false
    return isAgency
  }, [isDisconnected, isAgency])
  
  // Handle drag start (mouse down on request row)
  const handleDragStart = useCallback((requestId: string, e: React.MouseEvent) => {
    // Only allow drag if user has permission
    const request = requests.find(r => r.id === requestId)
    if (!request || !canDragRequest(request)) {
      return
    }
    
    // Prevent drag if dropdown is open or other interactions are active
    if (openActionsDropdown !== null) {
      return
    }
    
    dragStartRef.current = {
      requestId,
      startX: e.clientX,
      startY: e.clientY
    }
    setDragStartPosition({ x: e.clientX, y: e.clientY })
    setHasDragged(false)
  }, [requests, canDragRequest, openActionsDropdown])
  
  // Handle mouse move during drag
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragStartRef.current) return
    
    const { requestId, startX, startY } = dragStartRef.current
    const deltaX = Math.abs(e.clientX - startX)
    const deltaY = Math.abs(e.clientY - startY)
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)
    
    // 10px threshold to start drag
    if (distance > 10) {
      if (!draggedRequestId) {
        setDraggedRequestId(requestId)
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
          let groupStatus: RequestStatus | null = null
          
          for (const element of elementsAtPoint) {
            const htmlElement = element as HTMLElement
            
            // Skip ghost element
            if (htmlElement.closest('[data-ghost]') || htmlElement.getAttribute('data-ghost') === 'true') {
              continue
            }
            
            // Traverse up from this element to find group header or request row
            let currentElement: HTMLElement | null = htmlElement
            while (currentElement) {
              // Check for group header first
              const groupAttr = currentElement.getAttribute('data-group-status')
              if (groupAttr && ['new', 'in_review', 'accepted', 'closed', 'canceled'].includes(groupAttr)) {
                groupStatus = groupAttr as RequestStatus
                break
              }
              
              // Check for request row status
              const requestAttr = currentElement.getAttribute('data-request-status')
              if (requestAttr && ['new', 'in_review', 'accepted', 'closed', 'canceled'].includes(requestAttr)) {
                groupStatus = requestAttr as RequestStatus
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
  }, [draggedRequestId])
  
  // Handle mouse up (drop or cancel)
  const handleMouseUp = useCallback(() => {
    if (!dragStartRef.current) return
    
    const { requestId } = dragStartRef.current
    
    // If we were dragging and have a valid drop target
    if (draggedRequestId === requestId && hoveredGroupStatus) {
      const draggedRequest = requests.find(r => r.id === requestId)
      // Only update if status actually changed
      if (draggedRequest && draggedRequest.status !== hoveredGroupStatus) {
        // Store original status for error recovery
        const originalStatus = draggedRequest.status
        
        // Call status change with error recovery
        handleStatusChange(requestId, hoveredGroupStatus).catch(() => {
          // If status change fails, ensure UI is reverted immediately
          // onRequestUpdate callback in handleStatusChange should handle this,
          // but we ensure it happens here as well for drag operations
          if (onRequestUpdate) {
            const currentRequest = requests.find(r => r.id === requestId)
            if (currentRequest && currentRequest.status !== originalStatus) {
              onRequestUpdate(requestId, { status: originalStatus })
            }
          }
        })
      }
    }
    
    // Reset drag state
    dragStartRef.current = null
    setDraggedRequestId(null)
    setDragStartPosition(null)
    setHoveredGroupStatus(null)
    setDragOffset(null)
    
    // Reset hasDragged after a short delay to allow click handler to check it
    setTimeout(() => {
      setHasDragged(false)
    }, 100)
  }, [draggedRequestId, hoveredGroupStatus, requests, handleStatusChange, onRequestUpdate])
  
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
        setDraggedRequestId(null)
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
        setDraggedRequestId(null)
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

  return (
    <div className="w-full min-w-0">
      {/* Search section - Sticky */}
      <div className="sticky top-10 z-1 bg-[var(--color-base-surface-page-background)] pt-5 pb-4 px-5 rounded-t-lg relative">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-3">
            <SearchInput
              placeholder="Search requests by title…"
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
            <VirtualListBody
              items={flattenedItems}
              virtualItems={virtualItems}
              rowVirtualizer={rowVirtualizer}
              emptyState={isEmptyState ? emptyState : undefined}
              getItemKey={(item) => {
                if (item.type === 'group') {
                  return `group-${item.status}`
                }
                return `request-${item.request.id}`
              }}
              renderItem={(item) => {
                if (item.type === 'group') {
                  // Check if this is the first group (new is always first)
                  const isFirstGroup = item.status === 'new'
                  return (
                    <RequestGroupHeader
                      status={item.status}
                      count={item.count}
                      isExpanded={!collapsedGroupsState.set.has(item.status)}
                      onToggle={() => toggleGroup(item.status)}
                      isAgency={isAgency}
                      isDragHovered={hoveredGroupStatus === item.status && draggedRequestId !== null}
                      isFirstGroup={isFirstGroup}
                      isDraggingActive={draggedRequestId !== null}
                    />
                  )
                }
                const isDragging = draggedRequestId === item.request.id
                return (
                  <RequestRow
                    request={item.request}
                    isAgency={isAgency}
                    isDisconnected={isDisconnected}
                    comboboxOptions={comboboxOptions}
                    agencyMembers={agencyMembers}
                    agencyOrganization={agencyOrganization}
                    statusInlineRefs={statusInlineRefs}
                    onStatusChange={handleStatusChange}
                    onAssigneeSelect={handleAssigneeSelect}
                    onClearAssignee={handleClearAssignee}
                    onRowClick={handleRowClick}
                    onCopyLink={handleCopyLink}
                    onDeleteRequest={handleDeleteRequest}
                    onContactClick={handleContactClick}
                    openActionsDropdown={openActionsDropdown}
                    setOpenActionsDropdown={setOpenActionsDropdown}
                    baseRoute={baseRoute}
                    currentOrgId={currentOrgId}
                    onConvertToTask={onConvertToTask}
                    isDragging={isDragging}
                    onDragStart={handleDragStart}
                    canDrag={canDragRequest(item.request)}
                    isDraggingActive={draggedRequestId !== null}
                  />
                )
              }}
            />
          )}
        </div>
      </div>

      {/* Drag Ghost Preview */}
      {draggedRequestId && dragStartPosition && dragOffset && (() => {
        const draggedRequest = requests.find(r => r.id === draggedRequestId)
        if (!draggedRequest) return null
        
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
