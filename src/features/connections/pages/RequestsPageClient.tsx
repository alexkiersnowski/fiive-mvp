'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, useParams, usePathname, useSearchParams } from 'next/navigation'
import { useConnection } from '../ConnectionContext';
import RequestsTable from '../requests/RequestsTable';
import { RequestDetailModal } from '../requests/RequestDetailModal'
import { NewRequestModal } from '../requests/NewRequestModal'
import type { Request } from '../server';
import { fetchRequestsForConnection } from '../requests/actions';
import { PAGE_SIZE, PREFETCH_TIMEOUT_MS, isDev } from '../requests/constants';

interface RequestsPageClientProps {
  connectionId: string
  initialRequests: Request[]
  initialTotalCount: number
  agencyMembers: Array<{
    id: string
    firstName: string
    lastName: string
    email: string
    avatarUrl?: string
    jobTitle?: string
  }>
}

// Client component wrapper that handles all client-side interactivity
export default function RequestsPageClient({ connectionId, initialRequests, initialTotalCount, agencyMembers }: RequestsPageClientProps) {
  const { snapshot, context } = useConnection();
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const baseRoute = pathname.includes('/clients/') ? 'clients' : 'agencies'
  
  // Get user avatar and organization from context
  const userAvatar = context.user?.avatarUrl || '';
  const userInitials = context.user?.firstName?.[0] + context.user?.lastName?.[0] || 'U';
  const currentOrgId = context.organization.id;

  // Local state for requests (for optimistic updates)
  const [requests, setRequests] = useState<Request[]>(initialRequests)
  
  // Total count state
  const [totalCount, setTotalCount] = useState<number>(initialTotalCount)
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('')
  
  // Pagination state
  const [hasMore, setHasMore] = useState(initialRequests.length === PAGE_SIZE)
  const [currentOffset, setCurrentOffset] = useState(PAGE_SIZE)
  const parentRef = useRef<HTMLDivElement>(null)
  
  // Loading state lock to prevent concurrent loadMore calls
  const isLoadingMore = useRef(false)
  
  // Prefetching state
  const [prefetchedRequests, setPrefetchedRequests] = useState<Request[]>([])
  const [prefetchedOffset, setPrefetchedOffset] = useState<number | null>(null)
  const [isPrefetching, setIsPrefetching] = useState(false)
  
  // Track in-flight requests to prevent duplicates and enable cancellation
  const inFlightRequests = useRef<Set<number>>(new Set())
  
  // Track prefetch timeouts for cleanup
  const prefetchTimeouts = useRef<Map<number, NodeJS.Timeout>>(new Map())
  
  // Track if component is mounted to prevent state updates after unmount
  const isMountedRef = useRef(true)
  
  // Cleanup on unmount - cancel in-flight requests and timeouts
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      inFlightRequests.current.clear()
      isLoadingMore.current = false
      // Clear all prefetch timeouts
      prefetchTimeouts.current.forEach(timeout => clearTimeout(timeout))
      prefetchTimeouts.current.clear()
    }
  }, [])

  // Debounce search query (150ms delay for faster responsiveness)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery)
    }, 150)

    return () => clearTimeout(timeoutId)
  }, [searchQuery])

  // Track if this is the initial mount
  const isInitialMount = useRef(true)

  // Reset pagination and fetch new results when debounced search query changes
  useEffect(() => {
    // Skip on initial mount if there's no search query (we already have initialRequests)
    if (isInitialMount.current && !debouncedSearchQuery) {
      isInitialMount.current = false
      return
    }
    isInitialMount.current = false

    // Cancel all in-flight requests
    inFlightRequests.current.clear()
    isLoadingMore.current = false
    // Clear all prefetch timeouts
    prefetchTimeouts.current.forEach(timeout => clearTimeout(timeout))
    prefetchTimeouts.current.clear()

    // Fetch new results with search query
    const fetchSearchResults = async () => {
      try {
        const result = await fetchRequestsForConnection(connectionId, {
          limit: PAGE_SIZE,
          offset: 0,
          searchQuery: debouncedSearchQuery || undefined
        })

        if (isMountedRef.current) {
          setRequests(result.requests)
          setTotalCount(result.totalCount)
          const newHasMore = result.requests.length === PAGE_SIZE
          setHasMore(newHasMore)
          setCurrentOffset(PAGE_SIZE)
          setPrefetchedRequests([])
          setPrefetchedOffset(null)
        }
      } catch (error) {
        if (isDev()) {
          console.error('Failed to fetch search results:', error)
        }
        if (isMountedRef.current) {
          setHasMore(false)
        }
      }
    }

    fetchSearchResults()
  }, [debouncedSearchQuery, connectionId])
  
  // Prefetch next batch of requests with timeout protection
  const prefetchNext = useCallback(async (offset: number) => {
    // Prevent duplicate requests
    if (inFlightRequests.current.has(offset)) {
      if (isDev()) {
        console.log('[Prefetch] Request already in flight for offset:', offset)
      }
      return
    }
    
    if (isPrefetching) {
      if (isDev()) {
        console.log('[Prefetch] Already prefetching, skipping')
      }
      return
    }
    
    if (!hasMore) {
      if (isDev()) {
        console.log('[Prefetch] Has no more data, skipping')
      }
      return
    }
    
    setIsPrefetching(true)
    inFlightRequests.current.add(offset)
    
    if (isDev()) {
      console.log('[Prefetch] Starting prefetch for offset:', offset)
    }
    
    // Timeout to prevent stale prefetches
    const timeoutId = setTimeout(() => {
      // Double-check we still own this request and component is mounted
      if (isMountedRef.current && inFlightRequests.current.has(offset)) {
        if (isDev()) {
          console.log('[Prefetch] Prefetch timeout for offset:', offset)
        }
        inFlightRequests.current.delete(offset)
        prefetchTimeouts.current.delete(offset)
        // Only update state if component is still mounted
        if (isMountedRef.current) {
          setIsPrefetching(false)
        }
      }
    }, PREFETCH_TIMEOUT_MS)
    
    // Track timeout for cleanup
    prefetchTimeouts.current.set(offset, timeoutId)
    
    try {
      const result = await fetchRequestsForConnection(connectionId, { 
        limit: PAGE_SIZE, 
        offset,
        searchQuery: debouncedSearchQuery || undefined
      })
      
      // Clear timeout - only if we still own this request
      if (inFlightRequests.current.has(offset)) {
        const existingTimeout = prefetchTimeouts.current.get(offset)
        if (existingTimeout) {
          clearTimeout(existingTimeout)
          prefetchTimeouts.current.delete(offset)
        }
        
        if (isDev()) {
          console.log('[Prefetch] Prefetch completed', { count: result.requests.length, offset })
        }
        
        // Only update state if component is still mounted and this request is still relevant
        if (isMountedRef.current && inFlightRequests.current.has(offset)) {
          // Store prefetched data - don't set hasMore here, let loadMore decide
          if (result.requests.length > 0) {
            setPrefetchedRequests(result.requests)
            setPrefetchedOffset(offset)
          }
          // Update total count (it should be the same, but keep it in sync)
          setTotalCount(result.totalCount)
        }
      }
    } catch (error) {
      // Clear timeout on error
      const existingTimeout = prefetchTimeouts.current.get(offset)
      if (existingTimeout) {
        clearTimeout(existingTimeout)
        prefetchTimeouts.current.delete(offset)
      }
      
      if (isDev()) {
        console.error('Failed to prefetch requests:', error)
      }
      // Silently fail - don't affect hasMore, let on-demand fetch handle it
    } finally {
      // Only update state if component is still mounted
      if (isMountedRef.current) {
        setIsPrefetching(false)
      }
      inFlightRequests.current.delete(offset)
    }
  }, [connectionId, hasMore, isPrefetching, debouncedSearchQuery])

  // Load more requests function (uses prefetched data if available)
  const loadMore = useCallback(async () => {
    // Prevent concurrent calls
    if (isLoadingMore.current) {
      if (isDev()) {
        console.log('[LoadMore] Already loading, skipping')
      }
      return
    }
    
    if (isDev()) {
      console.log('[LoadMore] Triggered', { 
        hasMore,
        hasPrefetched: prefetchedRequests.length > 0, 
        prefetchedCount: prefetchedRequests.length,
        currentOffset 
      })
    }
    
    // If we have prefetched data, use it immediately (even if hasMore is false)
    if (prefetchedRequests.length > 0 && prefetchedOffset !== null) {
      isLoadingMore.current = true
      
      if (isDev()) {
        console.log('[LoadMore] Using prefetched data', prefetchedRequests.length, 'requests')
      }
      
      const prefetchedCount = prefetchedRequests.length
      const nextOffset = prefetchedOffset + PAGE_SIZE
      
      if (isMountedRef.current) {
        setRequests(prev => [...prev, ...prefetchedRequests])
        setCurrentOffset(nextOffset)
      }
      
      // Clear prefetched data
      setPrefetchedRequests([])
      setPrefetchedOffset(null)
      inFlightRequests.current.delete(prefetchedOffset)
      
      // If we got fewer than PAGE_SIZE, there are no more
      if (prefetchedCount < PAGE_SIZE) {
        setHasMore(false)
      } else {
        // Immediately prefetch next batch if we still have more
        prefetchNext(nextOffset)
      }
      
      isLoadingMore.current = false
      return
    }
    
    // If no prefetched data and hasMore is false, nothing to do
    if (!hasMore) {
      if (isDev()) {
        console.log('[LoadMore] Has no more data and no prefetched data')
      }
      return
    }
    
    // Prevent duplicate fetches
    if (inFlightRequests.current.has(currentOffset)) {
      if (isDev()) {
        console.log('[LoadMore] Request for offset already in flight:', currentOffset)
      }
      return
    }
    
    isLoadingMore.current = true
    inFlightRequests.current.add(currentOffset)
    
    // Fallback: fetch on-demand if prefetch didn't complete in time
    if (isDev()) {
      console.log('[LoadMore] Fetching on-demand for offset:', currentOffset)
    }
    
    try {
      const result = await fetchRequestsForConnection(connectionId, { 
        limit: PAGE_SIZE, 
        offset: currentOffset,
        searchQuery: debouncedSearchQuery || undefined
      })
      
      // Only update state if component is still mounted
      if (!isMountedRef.current) return
      
      if (result.requests.length === 0) {
        if (isMountedRef.current) {
          setHasMore(false)
        }
      } else {
        if (isMountedRef.current) {
          setRequests(prev => [...prev, ...result.requests])
          setTotalCount(result.totalCount)
          const nextOffset = currentOffset + PAGE_SIZE
          setCurrentOffset(nextOffset)
          // If we got fewer than PAGE_SIZE, there are no more
          if (result.requests.length < PAGE_SIZE) {
            setHasMore(false)
          } else {
            // Prefetch next batch
            prefetchNext(nextOffset)
          }
        }
      }
    } catch (error) {
      if (isDev()) {
        console.error('Failed to load more requests:', error)
      }
      // Only update hasMore if component is still mounted
      if (isMountedRef.current) {
        setHasMore(false) // Stop trying if we get an error
      }
    } finally {
      isLoadingMore.current = false
      inFlightRequests.current.delete(currentOffset)
    }
  }, [connectionId, hasMore, currentOffset, prefetchedRequests, prefetchedOffset, prefetchNext, debouncedSearchQuery])

  // Prefetch next batch when initial requests load or after consuming prefetched data
  useEffect(() => {
    // Only prefetch if we have more data, aren't already prefetching, and don't already have prefetched data
    if (hasMore && !isPrefetching && prefetchedRequests.length === 0 && requests.length > 0) {
      const offsetToPrefetch = currentOffset
      if (isDev()) {
        console.log('[Prefetch] Triggering prefetch for offset:', offsetToPrefetch)
      }
      prefetchNext(offsetToPrefetch)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMore, isPrefetching, prefetchedRequests.length, currentOffset, requests.length])

  // Load more handler for virtual scroll
  const handleLoadMore = useCallback((virtualRows: any[]) => {
    // Virtual scroll triggers loadMore in RequestsTable based on scroll position
    // This handler is called when user scrolls near the end
            loadMore()
  }, [loadMore])

  // Handle optimistic deletion from query params (when navigating from detail page)
  useEffect(() => {
    const deletedRequestId = searchParams.get('deleted')
    if (deletedRequestId) {
      // Optimistically remove the deleted request
      setRequests(prev => prev.filter(r => r.id !== deletedRequestId))
      
      // Clean up the query param
      const newSearchParams = new URLSearchParams(searchParams.toString())
      newSearchParams.delete('deleted')
      const newUrl = `${pathname}${newSearchParams.toString() ? `?${newSearchParams.toString()}` : ''}`
      router.replace(newUrl, { scroll: false })
    }
  }, [searchParams, pathname, router])

  // Local state for modal (like ProfileCard pattern)
  const [selectedRequest, setSelectedRequest] = useState<{
    requestId: string
    title: string
    description: string
    client?: {
      id: string
      name: string
      logoUrl?: string
    }
    submittedBy?: {
      id: string
      name: string
      email: string
      avatarUrl?: string
    }
    assignee?: {
      id: string
      name: string
      email: string
      avatarUrl?: string
    } | null
    type?: string | null
    status?: 'new' | 'in_review' | 'accepted' | 'canceled'
    createdAt?: string
    createdByOrgId?: string
  } | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isNewModalOpen, setIsNewModalOpen] = useState(false)

  function getRequestById(requestId: string) {
    return requests.find(r => r.id === requestId)
  }

  function handleRequestUpdate(requestId: string, updates: { title?: string; description?: string; status?: 'new' | 'in_review' | 'accepted' | 'canceled' }) {
    // Update requests list optimistically
    setRequests(prevRequests =>
      prevRequests.map(req =>
        req.id === requestId
          ? { ...req, ...updates }
          : req
      )
    )

    // Also update selectedRequest if it's the current one
    setSelectedRequest(prev => 
      prev && prev.requestId === requestId
        ? { ...prev, ...updates }
        : prev
    )
  }

  function handleRowClick(requestId: string) {
    const request = getRequestById(requestId)
    if (request) {
      setSelectedRequest({
        requestId: request.id,
        title: request.title,
        description: request.description,
        client: request.client,
        submittedBy: request.submittedBy,
        assignee: request.assignee,
        type: request.type,
        status: request.status,
        createdAt: request.createdAt,
        createdByOrgId: request.createdByOrgId
      })
      setIsModalOpen(true)
    }
  }

  function handleModalClose() {
    // Close modal first, then clear data after animation completes
    setIsModalOpen(false)
    // Small delay to let animation finish
    setTimeout(() => {
      setSelectedRequest(null)
    }, 300)
  }

  function handleNewRequest() {
    setIsNewModalOpen(true)
  }
  
  function handleNewModalClose() {
    setIsNewModalOpen(false)
  }

  function handleExpand() {
    // Navigate to full page
    if (selectedRequest && selectedRequest.requestId !== 'new') {
      router.push(`/${baseRoute}/${connectionId}/requests/${selectedRequest.requestId}`)
    }
  }

  async function handleRequestCreated(optimisticRequest: {
    title: string
    description: string
    type: string | null
    assigneeUserId: string | null
  }) {
    // Optimistically add the new request to the table immediately
    const optimisticRequestData: Request = {
      id: `temp-${Date.now()}`, // Temporary ID until we get the real one
      connectionId: connectionId,
      title: optimisticRequest.title,
      description: optimisticRequest.description,
      type: optimisticRequest.type || 'general',
      status: 'new',
      assignee: optimisticRequest.assigneeUserId 
        ? agencyMembers.find(m => m.id === optimisticRequest.assigneeUserId) 
          ? {
              id: agencyMembers.find(m => m.id === optimisticRequest.assigneeUserId)!.id,
              name: `${agencyMembers.find(m => m.id === optimisticRequest.assigneeUserId)!.firstName} ${agencyMembers.find(m => m.id === optimisticRequest.assigneeUserId)!.lastName}`,
              email: agencyMembers.find(m => m.id === optimisticRequest.assigneeUserId)!.email,
              avatarUrl: agencyMembers.find(m => m.id === optimisticRequest.assigneeUserId)!.avatarUrl
            }
          : null
        : null,
      client: {
        id: snapshot.partner.id,
        name: snapshot.partner.name,
        logoUrl: snapshot.partner.logo
      },
      submittedBy: {
        id: context.user?.id || '',
        name: `${context.user?.firstName || ''} ${context.user?.lastName || ''}`,
        email: context.user?.email || '',
        avatarUrl: context.user?.avatarUrl,
        jobTitle: context.user?.jobTitle,
        orgId: context.organization.id,
        orgName: context.organization.name,
        orgLogo: context.organization.logoUrl
      },
      createdAt: (() => {
        const date = new Date();
        const day = date.getDate();
        const month = date.toLocaleDateString('en-US', { month: 'short' });
        const year = date.getFullYear();
        return `${day} ${month} ${year}`;
      })(),
      createdByOrgId: currentOrgId
    }

    // Add optimistic request to the top of the list
    setRequests(prevRequests => [optimisticRequestData, ...prevRequests])

    // Fetch real data from server in the background (only first page, reset pagination)
    try {
      // Cancel any in-flight requests
      inFlightRequests.current.clear()
      isLoadingMore.current = false
      
      const result = await fetchRequestsForConnection(connectionId, { 
        limit: PAGE_SIZE, 
        offset: 0,
        searchQuery: debouncedSearchQuery || undefined
      })
      
      // Only update state if component is still mounted
      if (isMountedRef.current) {
        setRequests(result.requests)
        setTotalCount(result.totalCount)
        // Reset pagination state
        const newHasMore = result.requests.length === PAGE_SIZE
        setHasMore(newHasMore)
        setCurrentOffset(PAGE_SIZE)
        // Clear any prefetched data
        setPrefetchedRequests([])
        setPrefetchedOffset(null)
      }
      // Prefetch will be triggered automatically by the useEffect when state updates
    } catch (error) {
      if (isDev()) {
        console.error('Failed to refresh requests:', error)
      }
      // Fallback to router.refresh if fetch fails
      router.refresh()
    }
  }

  return (
    <>
      {/* Requests Table */}
      <div ref={parentRef}>
      <RequestsTable
        userAvatar={userAvatar}
        userInitials={userInitials}
        onRequestClick={handleRowClick}
        onNewRequest={handleNewRequest}
        requests={requests}
        agencyMembers={agencyMembers}
        onRequestUpdate={handleRequestUpdate}
        currentOrgId={currentOrgId}
          onLoadMore={handleLoadMore}
        onSearchChange={setSearchQuery}
        totalCount={totalCount}
          parentRef={parentRef}
      />
      </div>

      {/* Request Detail Modal - For existing requests */}
      <RequestDetailModal
        requestData={selectedRequest}
        agencyMembers={agencyMembers}
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onExpand={handleExpand}
        onRequestUpdate={handleRequestUpdate}
        onRequestDeleted={(requestId) => {
          // Optimistically remove request from table
          setRequests(prev => prev.filter(r => r.id !== requestId))
        }}
        connectionId={connectionId}
        currentOrgId={currentOrgId}
      />
      
      {/* New Request Modal - For creating new requests */}
      <NewRequestModal
        client={{
          id: snapshot.partner.id,
          name: snapshot.partner.name,
          logoUrl: snapshot.partner.logo
        }}
        agencyMembers={agencyMembers}
        isOpen={isNewModalOpen}
        onClose={handleNewModalClose}
        onRequestCreated={handleRequestCreated}
        connectionId={connectionId}
        currentOrgId={currentOrgId}
      />
    </>
  );
}

