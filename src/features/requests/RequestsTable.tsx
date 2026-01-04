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
import { Plus, SortAscending, Eye, Users } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { PaywallModal } from '@/components/ui/paywall-modal'
import { runWithPaywallCheck } from '@/lib/tasks-requests-helpers'
import { updateRequest } from '@/features/connections/requests/actions'
import { isOptimisticId, updateRequestLatestDraft, scheduleRequestFlush } from '@/features/connections/utils/optimisticTracker'
import type { Request, RequestWithUiId, SearchResults } from './types'
import { StatusGroupHeader } from './StatusGroupHeader'
import { ClientGroupHeader } from './ClientGroupHeader'
import { GlobalRequestRow } from './GlobalRequestRow'
import { Skeleton } from '@/components/ui/skeleton'
import type { RequestStatus } from './requestGrouping'

interface RequestsTableProps {
  userAvatar?: string
  userInitials?: string
  onRequestClick?: (requestId: string) => void
  onNewRequest?: () => void
  requests: Request[] // Flat array of requests (only used in search mode)
  requestsByClientStatus?: Map<string, Request[]> // Map<`${status}-${clientOrgId}`, Request[]> - accordion cache
  isLoadingClientStatus?: Map<string, boolean> // Map<`${status}-${clientOrgId}`, boolean> - loading states
  onFetchClientRequests?: (status: string, clientOrgId: string, forceFetch?: boolean) => void // Fetch-on-expand callback
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
  onRequestDeleted?: (requestId: string) => void
  onConvertToTask?: (request: Request) => void
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

export default function RequestsTable({ userAvatar = '', userInitials = 'U', onRequestClick, onNewRequest, requests, requestsByClientStatus = new Map(), isLoadingClientStatus = new Map(), onFetchClientRequests, agencyMembers = [], onRequestUpdate, currentOrgId, onLoadMore, onSearchChange, totalCount, unfilteredTotalCount = 0, parentRef, headerOffset = 0, assignedToMe = false, onToggleAssignedToMe, isBootstrapping = false, isAgency = false, onRequestDeleted, onConvertToTask, allowedConnectionIds: _allowedConnectionIds = null, allConnectionsMetadata = new Map(), statusCounts, clientCounts, collapsedStatuses, collapsedClients, onToggleStatus, onToggleClient, hasOptimisticData, searchQuery: searchQueryProp, searchResults, isSearching = false, assignedFilterResults, isLoadingAssignedFilter = false }: RequestsTableProps) {
  const pathname = usePathname()
  const baseRoute = pathname.includes('/clients/') ? 'clients' : 'agencies'
  const [openActionsDropdown, setOpenActionsDropdown] = useState<string | null>(null)
  
  // Paywall modal state
  const [isPaywallModalOpen, setIsPaywallModalOpen] = useState(false)
  
  const statusInlineRefs = useRef<Record<string, InlineEditRef | null>>({})
  
  // Loading guard refs to prevent rapid-fire mutations
  const isMutingAssignee = useRef(false)
  const isMutingStatus = useRef(false)
  
  // Auto-expand refs removed - no longer needed with server-side search mode
  
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

  // Calculate total request count from statusCounts (sum of all statuses)
  // This gives us the accurate total across all connections, regardless of what's loaded
  // In search mode, use the count from search results instead
  const requestCount = useMemo(() => {
    // If in search mode, calculate count from search results
    if (searchResults) {
      return searchResults.clients.reduce((sum, client) => sum + client.requests.length, 0);
    }
    // If in assigned filter mode, calculate count from assigned filter results
    if (assignedFilterResults) {
      return assignedFilterResults.clients.reduce((sum, client) => sum + client.requests.length, 0);
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
      
      // Handle optimistic IDs
      if (isOptimisticId(requestId)) {
        // Track draft state and schedule flush
        updateRequestLatestDraft(requestId, { assignee_user_id: memberId })
        scheduleRequestFlush(requestId, async (realId, draft) => {
          await updateRequest(realId, draft)
        })
        return // Success - no error, no await
      }
      
      // Set loading guard
      isMutingAssignee.current = true
      
      await runWithPaywallCheck(
        async () => {
          await updateRequest(requestId, { assignee_user_id: memberId })
        },
        () => {
          // Success - real-time subscription will handle UI updates
        },
        () => {
          setIsPaywallModalOpen(true)
          // Revert parent state on paywall
          if (onRequestUpdate) {
            const originalRequest = requests.find(r => r.id === requestId)
            if (originalRequest) {
              onRequestUpdate(requestId, { assignee: originalRequest.assignee })
            }
          }
        }
      ).catch((error) => {
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
      }).finally(() => {
        // Clear loading guard
        isMutingAssignee.current = false
      })
    }
  }

  const handleClearAssignee = async (requestId: string) => {
    // Prevent rapid-fire mutations
    if (isMutingAssignee.current) return
    
    // Notify parent for bidirectional updates (table → modal)
    if (onRequestUpdate) {
      onRequestUpdate(requestId, { assignee: null })
    }
    
    // Handle optimistic IDs
    if (isOptimisticId(requestId)) {
      // Track draft state and schedule flush
      updateRequestLatestDraft(requestId, { assignee_user_id: null })
      scheduleRequestFlush(requestId, async (realId, draft) => {
        await updateRequest(realId, draft)
      })
      return // Success - no error, no await
    }
    
    // Set loading guard
    isMutingAssignee.current = true
    
    try {
      await updateRequest(requestId, { assignee_user_id: null })
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
    
    const validStatuses = ['new', 'in_review', 'accepted', 'canceled', 'closed'] as const
    if (!(validStatuses as readonly string[]).includes(newStatus)) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Invalid status:', newStatus)
      }
      return
    }
    
    const typedStatus = newStatus as 'new' | 'in_review' | 'accepted' | 'canceled' | 'closed'
    
    // Notify parent for bidirectional updates (table → modal)
    if (onRequestUpdate) {
      onRequestUpdate(requestId, { status: typedStatus })
    }
    
    // Handle optimistic IDs
    if (isOptimisticId(requestId)) {
      // Track draft state and schedule flush
      updateRequestLatestDraft(requestId, { status: typedStatus })
      scheduleRequestFlush(requestId, async (realId, draft) => {
        await updateRequest(realId, draft)
      })
      return // Success - no error, no await
    }
    
    // Set loading guard
    isMutingStatus.current = true
    
    await runWithPaywallCheck(
      async () => {
        await updateRequest(requestId, { status: typedStatus })
      },
      () => {
        // Success - real-time subscription will handle UI updates
      },
      () => {
        setIsPaywallModalOpen(true)
        // Revert parent state on paywall
        if (onRequestUpdate) {
          const originalRequest = requests.find(r => r.id === requestId)
          if (originalRequest) {
            onRequestUpdate(requestId, { status: originalRequest.status })
          }
        }
      }
    ).catch((error) => {
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
    // Parent handles optimistic update, toast, and server action
    onRequestDeleted?.(requestId)
  }

  // Status order for accordion rendering
  const statusOrder: RequestStatus[] = ['new', 'in_review', 'accepted', 'closed', 'canceled']

  // Build client groups by status from allConnectionsMetadata
  // This gives us all client headers even if requests aren't loaded yet
  // Filter by search query if provided (client-side filtering)
  const clientGroupsByStatus = useMemo(() => {
    const groups: Record<string, Array<{ orgId: string; name: string; logoUrl?: string }>> = {
      new: [],
      in_review: [],
      accepted: [],
      closed: [],
      canceled: [],
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

  // Auto-expand logic removed - using server-side search mode instead
  // Search mode handles expansion automatically with pre-loaded data

  // No search mode rendering - always use accordion mode
  
  // Empty state: only show if we're not bootstrapping AND there are truly no requests
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
                  placeholder="Search requests by client…"
                  value={searchQueryProp || ''}
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
              {/* Client Group + 4 Request Rows - repeatable pattern (2-3 times) */}
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
                  {/* Request Row Skeletons - 4 per client group */}
                  {[1, 2, 3, 4].map((requestIndex) => (
                    <div
                      key={`${clientIndex}-${requestIndex}`}
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
                      {/* Created */}
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
                  {/* Client Group + Request Row Skeletons - repeatable pattern (3 clients, 4 rows each) */}
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
                      {/* Request Row Skeletons - 4 per client group */}
                      {[1, 2, 3, 4].map((requestIndex) => (
                        <div
                          key={`${clientIndex}-${requestIndex}`}
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
                          {/* Created */}
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
                  // In search mode: Include ALL clients from search results (they match by organization name)
                  // This ensures clients with 0 requests still show their headers
                  const clientsInStatus = searchResults.clients;

                  // Calculate status count from search results
                  const statusCount = searchResults.clients.reduce((sum: number, client: SearchResults['clients'][0]) => 
                    sum + client.requests.filter((req: Request) => req.status === status).length, 0
                  );

                  // Always render status header, even if count is 0
                  return (
                    <React.Fragment key={status}>
                      <StatusGroupHeader
                        status={status}
                        statusCount={statusCount}
                        isCollapsed={collapsedStatuses.has(status)}
                        onToggle={() => onToggleStatus(status)}
                        isAgency={isAgency}
                      />
                      {!collapsedStatuses.has(status) && clientsInStatus.length > 0 && clientsInStatus.map((clientResult: SearchResults['clients'][0]) => {
                        // Filter requests for this status
                        const requestsInStatus = clientResult.requests.filter((req: Request) => req.status === status);
                        
                        // In search mode: Show client header even if 0 requests in this status
                        // (client matches by organization name, so it should appear in all status groups)

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
                              count={requestsInStatus.length}
                              isCollapsed={isClientCollapsed}
                              onToggle={() => onToggleClient(status, clientResult.client_id)}
                              isAgency={isAgency}
                            />
                            {/* Render requests only when expanded AND there are requests */}
                            {!isClientCollapsed && requestsInStatus.length > 0 && requestsInStatus.map((request: Request) => (
                              <GlobalRequestRow
                                key={(request as RequestWithUiId)._uiId ?? request.id}
                                request={request}
                                isAgency={isAgency}
                                comboboxOptions={comboboxOptions}
                                agencyMembers={agencyMembers}
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
                                currentOrgId={currentOrgId}
                                onConvertToTask={onConvertToTask}
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
                  {/* Client Group + Request Row Skeletons - repeatable pattern (3 clients, 4 rows each) */}
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
                      {/* Request Row Skeletons - 4 per client group */}
                      {[1, 2, 3, 4].map((requestIndex) => (
                        <div
                          key={`${clientIndex}-${requestIndex}`}
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
                          {/* Created */}
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
                  // Filter clients that have requests in this status
                  const clientsInStatus = assignedFilterResults.clients.filter((client: SearchResults['clients'][0]) => 
                    client.requests.some((req: Request) => req.status === status)
                  );

                  // Calculate status count from assigned filter results
                  const statusCount = assignedFilterResults.clients.reduce((sum: number, client: SearchResults['clients'][0]) => 
                    sum + client.requests.filter((req: Request) => req.status === status).length, 0
                  );

                  // Always render status header, even if count is 0
                  return (
                    <React.Fragment key={status}>
                      <StatusGroupHeader
                        status={status}
                        statusCount={statusCount}
                        isCollapsed={collapsedStatuses.has(status)}
                        onToggle={() => onToggleStatus(status)}
                        isAgency={isAgency}
                      />
                      {!collapsedStatuses.has(status) && clientsInStatus.length > 0 && clientsInStatus.map((clientResult: SearchResults['clients'][0]) => {
                        // Filter requests for this status
                        const requestsInStatus = clientResult.requests.filter((req: Request) => req.status === status);
                        
                        if (requestsInStatus.length === 0) {
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
                              count={requestsInStatus.length}
                              isCollapsed={isClientCollapsed}
                              onToggle={() => onToggleClient(status, clientResult.client_id)}
                              isAgency={isAgency}
                            />
                            {/* Render all requests - data is pre-loaded, only when expanded */}
                            {!isClientCollapsed && requestsInStatus.map((request: Request) => (
                              <GlobalRequestRow
                                key={(request as RequestWithUiId)._uiId ?? request.id}
                                request={request}
                                isAgency={isAgency}
                                comboboxOptions={comboboxOptions}
                                agencyMembers={agencyMembers}
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
                                currentOrgId={currentOrgId}
                                onConvertToTask={onConvertToTask}
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
                      isAgency={isAgency}
                    />
                    {!isStatusCollapsed && clients.length > 0 && clients.map((client) => {
                      const cacheKey = `${status}-${client.orgId}`
                      // Client is expanded if it's in the Set, collapsed otherwise (default to collapsed)
                      const isClientCollapsed = !collapsedClients.get(status)?.has(client.orgId)
                      
                      // 1. Get the raw value. DO NOT default to [].
                      // If this returns undefined, it means we haven't fetched it yet.
                      const clientRequests = requestsByClientStatus.get(cacheKey)
                      
                      const isLoading = isLoadingClientStatus.get(cacheKey) || false
                      const knownCount = clientCounts.get(cacheKey) ?? 0
                      
                      // 2. Derive the state
                      const isExpanded = !isClientCollapsed
                      const hasData = clientRequests !== undefined
                      const isEmpty = hasData && clientRequests.length === 0
                      
                      // Separate optimistic requests from real requests if we have data
                      const optimisticRequests = hasData ? clientRequests.filter(r => r.id.startsWith('temp-')) : []
                      const realRequests = hasData ? clientRequests.filter(r => !r.id.startsWith('temp-')) : []
                      
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
                              if (wasCollapsed && !isLoading && onFetchClientRequests) {
                                const cacheKey = `${status}-${client.orgId}`
                                const hasOptimistic = hasOptimisticData?.(cacheKey) ?? false
                                const expectedCount = knownCount
                                const cachedCount = hasData ? clientRequests.length : 0
                                
                                // Fetch if: haven't fetched yet OR optimistic data exists OR cache is incomplete
                                if (!hasData || hasOptimistic || cachedCount < expectedCount) {
                                  onFetchClientRequests(status, client.orgId)
                                }
                              }
                            }}
                            isAgency={isAgency}
                          />
                          {isExpanded && (
                            <>
                              {/* CASE 1: We have never fetched this OR we have optimistic requests but no real data yet.
                                  Show optimistic requests (if any) above the skeleton. */}
                              {(!hasData || (hasData && optimisticRequests.length > 0 && realRequests.length === 0 && isLoading)) && (
                                <>
                                  {/* Render optimistic requests FIRST (at the top) if they exist */}
                                  {optimisticRequests.map((request) => (
                                    <GlobalRequestRow
                                      key={(request as RequestWithUiId)._uiId ?? request.id}
                                      request={request}
                                      isAgency={isAgency}
                                      comboboxOptions={comboboxOptions}
                                      agencyMembers={agencyMembers}
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
                                      currentOrgId={currentOrgId}
                                      onConvertToTask={onConvertToTask}
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
                              
                              {/* CASE 2: We fetched, and it's truly empty (no optimistic requests either). */}
                              {/* No message shown - status header shows 0 requests */}
                              
                              {/* CASE 3: We have data (optimistic or real). Render optimistic requests first, then real requests. */}
                              {hasData && !isEmpty && !(optimisticRequests.length > 0 && realRequests.length === 0 && isLoading) && (
                                <>
                                  {/* Render optimistic requests FIRST (at the top) */}
                                  {optimisticRequests.map((request) => (
                                    <GlobalRequestRow
                                      key={(request as RequestWithUiId)._uiId ?? request.id}
                                      request={request}
                                      isAgency={isAgency}
                                      comboboxOptions={comboboxOptions}
                                      agencyMembers={agencyMembers}
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
                                      currentOrgId={currentOrgId}
                                      onConvertToTask={onConvertToTask}
                                    />
                                  ))}
                                  
                                  {/* Render real requests (below optimistic) */}
                                  {realRequests.map((request) => (
                                    <GlobalRequestRow
                                      key={(request as RequestWithUiId)._uiId ?? request.id}
                                      request={request}
                                      isAgency={isAgency}
                                      comboboxOptions={comboboxOptions}
                                      agencyMembers={agencyMembers}
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
                                      currentOrgId={currentOrgId}
                                      onConvertToTask={onConvertToTask}
                                    />
                                  ))}
                                </>
                              )}
                            </>
                          )}
                        </React.Fragment>
                      )
                    })}
                    {/* No message shown when no clients - status header shows 0 requests */}
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

