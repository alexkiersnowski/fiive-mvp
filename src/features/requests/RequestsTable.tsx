"use client"

import { useState, useRef, useMemo, useCallback, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { SearchInput } from '@/components/ui/search-input'
import AvatarButton from '@/components/ui/avatar-button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Badge } from '@/components/ui/badge'
import { InlineEdit, type InlineEditRef } from '@/components/ui/inline-edit'
import { ProfileCard } from '@/components/ui/profile-card'
import { Plus, SortAscending, Eye, Users } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { PaywallModal } from '@/components/ui/paywall-modal'
import { runWithPaywallCheck } from '@/lib/tasks-requests-helpers'
import { updateRequestAssignee, updateRequestStatus } from '@/features/connections/requests/actions'
import type { Request } from './types'
import { useVirtualTable, VirtualListBody } from '@/components/virtual-table'
import type { VirtualItem } from '@tanstack/react-virtual'
import { groupRequestsByStatusAndClient, flattenGroupedRequests, type FlattenedItem, type RequestStatus } from './requestGrouping'
import { StatusGroupHeader } from './StatusGroupHeader'
import { ClientGroupHeader } from './ClientGroupHeader'
import { GlobalRequestRow } from './GlobalRequestRow'
import { useStableSet, useStableNestedSet } from './useStableCollapseState'
import { Skeleton } from '@/components/ui/skeleton'

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
  headerOffset?: number
  assignedToMe?: boolean
  onToggleAssignedToMe?: () => void
  isBootstrapping?: boolean
  isAgency?: boolean
  onRequestDeleted?: (requestId: string) => void
  onConvertToTask?: (request: Request) => void
  allowedConnectionIds?: string[] | null // Array of allowed connection IDs (null = no limit for paid plans)
}

export default function RequestsTable({ userAvatar = '', userInitials = 'U', onRequestClick, onNewRequest, requests = [], agencyMembers = [], onRequestUpdate, currentOrgId, onLoadMore, onSearchChange, totalCount, unfilteredTotalCount = 0, parentRef, headerOffset = 0, assignedToMe = false, onToggleAssignedToMe, isBootstrapping = false, isAgency = false, onRequestDeleted, onConvertToTask, allowedConnectionIds = null }: RequestsTableProps) {
  const pathname = usePathname()
  const baseRoute = pathname.includes('/clients/') ? 'clients' : 'agencies'
  const [searchQuery, setSearchQuery] = useState('')
  const [openActionsDropdown, setOpenActionsDropdown] = useState<string | null>(null)
  
  // Paywall modal state
  const [isPaywallModalOpen, setIsPaywallModalOpen] = useState(false)
  
  // Track collapsed groups with stable references
  // Default: 'closed' and 'canceled' status groups collapsed
  const collapsedStatusesState = useStableSet<RequestStatus>(new Set(['closed', 'canceled']))
  // Track collapsed client groups per status: Map<status, Set<clientId>>
  const collapsedClientsState = useStableNestedSet<RequestStatus>(new Map())
  
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
      
      // Set loading guard
      isMutingAssignee.current = true
      
      await runWithPaywallCheck(
        async () => {
          await updateRequestAssignee(requestId, memberId)
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
    
      // Set loading guard
      isMutingStatus.current = true
      
      await runWithPaywallCheck(
        async () => {
          await updateRequestStatus(requestId, typedStatus)
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

  // Group requests by status and client (agency view) or agency (client view)
  // Only recomputes when requests array reference changes (which happens when requests are added/removed/updated)
  const { grouped: groupedRequests, allGroups: allClients } = useMemo(() => groupRequestsByStatusAndClient(requests, isAgency), [requests, isAgency])
  
  // Auto-expand groups that contain search results when search is active
  // Note: 'closed' and 'canceled' status groups always stay collapsed
  useEffect(() => {
    // Only auto-expand if there's an active search query
    if (searchQuery.trim().length === 0) {
      return
    }

    // Expand all status groups that have requests (except 'closed' and 'canceled')
    for (const status of Object.keys(groupedRequests) as RequestStatus[]) {
      // Skip 'closed' and 'canceled' - they always stay collapsed
      if (status === 'closed' || status === 'canceled') {
        continue
      }
      
      const clientGroups = groupedRequests[status]
      const hasRequests = Object.values(clientGroups).some(requests => requests.length > 0)
      
      if (hasRequests) {
        // Remove from collapsed set (expand the group)
        collapsedStatusesState.remove(status)
        
        // Expand all client groups within this status that have requests
        for (const [clientId, clientRequests] of Object.entries(clientGroups)) {
          if (clientRequests.length > 0) {
            // Remove from collapsed set (expand the client group)
            collapsedClientsState.remove(status, clientId)
          }
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requests, searchQuery, groupedRequests])
  
  // Flatten grouped requests for virtualization
  // Uses stable collapse state references - only recomputes when:
  // - groupedRequests changes (requests changed)
  // - allClients changes (new groups added)
  // - collapse state contents actually change (not just reference)
  const flattenedItems = useMemo<FlattenedItem[]>(() => {
    return flattenGroupedRequests(groupedRequests, allClients, collapsedStatusesState.set, collapsedClientsState.map, isAgency)
  }, [groupedRequests, allClients, collapsedStatusesState.set, collapsedClientsState.map, isAgency])
  
  // Toggle status group collapse/expand - uses stable reference hook
  const toggleStatusGroup = useCallback((status: RequestStatus) => {
    collapsedStatusesState.toggle(status)
  }, [collapsedStatusesState])
  
  // Toggle client group collapse/expand - uses stable reference hook
  const toggleClientGroup = useCallback((status: RequestStatus, clientId: string) => {
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
          <div className="pt-5 pb-4 px-5">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-3">
                <SearchInput
                  placeholder="Search requests by client or title…"
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
              ) : undefined}
              getItemKey={(item, index) => {
                if (item.type === 'status-group') {
                  return `status-${item.status}`
                }
                if (item.type === 'client-group') {
                  return `client-${item.status}-${item.clientId}`
                }
                return `request-${item.request.id}`
              }}
              renderItem={(item, index) => {
                if (item.type === 'status-group') {
                  const isFirstGroup = item.status === 'new'
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
                      agencyId={item.agencyId}
                      agencyName={item.agencyName}
                      agencyLogoUrl={item.agencyLogoUrl}
                      count={item.count}
                      isExpanded={!collapsedClientsState.get(item.status).has(item.clientId)}
                      onToggle={() => toggleClientGroup(item.status, item.clientId)}
                      isAgency={isAgency}
                      isFirstClient={isFirstClient}
                    />
                  )
                }
                // item.type === 'request'
                return (
                  <GlobalRequestRow
                    request={item.request}
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

