'use client'

import { useState, useEffect, useRef, useCallback, useTransition, Component, type ReactNode, useMemo } from 'react'
import { createClient as createSupabaseBrowserClient } from '@/lib/supabase/client'
import { useRouter, usePathname } from 'next/navigation'
import { toast } from 'sonner'
import { useConnection } from '../ConnectionContext';
import RequestsTable from '../requests/RequestsTable';
import { RequestDetailModal } from '../requests/RequestDetailModal'
import { NewRequestModal } from '../requests/NewRequestModal'
import type { Request, Comment } from '../server';
import { fetchRequestsForConnection, fetchRequestById, fetchCommentsForRequests } from '../requests/actions';
import { ConvertToTaskModal, type ConvertToTaskModalValues } from '../tasks/ConvertToTaskModal'
import { convertRequestToTask } from '../tasks/actions'
import { PAGE_SIZE, isDev } from '../constants';
import type { VirtualItem } from '@tanstack/react-virtual';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
// PREFETCH_TIMEOUT_MS and formatRequestDate imported but not used - kept for potential future use
import { sortRequestsForDisplay } from '../requests/requestSort';

// Error boundary for RequestsPageClient to catch runtime errors
class RequestsPageErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error for debugging
    console.error('[RequestsPageClient] Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center p-8" style={{ minHeight: '400px' }}>
          <p className="text-sm-medium mb-2" style={{ color: 'var(--color-base-text-primary)' }}>
            Something went wrong loading requests
          </p>
          <p className="text-sm-regular mb-4" style={{ color: 'var(--color-base-text-secondary)' }}>
            {this.state.error?.message || 'An unexpected error occurred'}
          </p>
          <details className="text-xs" style={{ color: 'var(--color-base-text-tertiary)', maxWidth: '600px' }}>
            <summary className="cursor-pointer mb-2">Error details</summary>
            <pre className="overflow-auto p-2 bg-[var(--color-neutral-3)] rounded">
              {this.state.error?.stack}
            </pre>
          </details>
        </div>
      );
    }

    return this.props.children;
  }
}

interface RequestsPageClientProps {
  connectionId: string
  initialRequests: Request[]
  initialTotalCount: number
  initialNewCount: number
  initialStatusCounts?: Record<string, number> // Server-side status counts to prevent flicker
  agencyMembers: Array<{
    id: string
    firstName: string
    lastName: string
    email: string
    avatarUrl?: string
    jobTitle?: string
  }>
  projects: Array<{
    id: string
    name: string
  }>
  initialComments?: Record<string, Comment[]>
}

type ModalRequest = {
  requestId: string
  title: string
  description: string
  client?: {
    id: string
    name: string
    logoUrl?: string
  }
  agency?: {
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
  project?: {
    id: string
    name: string
  } | null
  status?: 'new' | 'in_review' | 'accepted' | 'canceled' | 'closed'
  createdAt?: string
  createdByOrgId?: string
  createdByOrgType?: 'agency' | 'client'
}

// Client component wrapper that handles all client-side interactivity
function RequestsPageClientContent({ connectionId, initialRequests, initialTotalCount, initialNewCount, initialStatusCounts, agencyMembers, projects, initialComments = {} }: RequestsPageClientProps) {
  // CRITICAL: All hooks must be called before any early returns
  const { snapshot, context, setIsEmpty, setNewRequestsCount } = useConnection();
  const _router = useRouter()
  const pathname = usePathname()
  
  // Store unfiltered data (all requests fetched upfront)
  const [allRequests, setAllRequests] = useState<Request[]>(initialRequests)
  // Optimistic new requests disabled (relying on real-time updates)
  
  // Status counts from server (prevents flicker)
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>(() => {
    // Initialize with server counts if available, otherwise empty (will be computed from requests)
    return initialStatusCounts || {}
  })
  
  // Total count state (filtered)
  const [_totalCount, setTotalCount] = useState<number>(initialTotalCount)
  
  // Unfiltered total count state (total requests for connection regardless of filters)
  const [unfilteredTotalCount, setUnfilteredTotalCount] = useState<number>(initialTotalCount)
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('')
  const _previousDebouncedSearchRef = useRef<string>('')
  const [assignedToMe, setAssignedToMe] = useState<boolean>(false)
  
  // Pagination state (disabled - we fetch all data upfront)
  const [hasMore, setHasMore] = useState(false) // No pagination - all data fetched upfront
  const [currentOffset, setCurrentOffset] = useState(0) // Not used, but kept for compatibility
  const parentRef = useRef<HTMLDivElement>(null)
  // Buffer initial empty render with skeleton (no longer needed for filters, but kept for compatibility)
  const [isBootstrapping, _setIsBootstrapping] = useState<boolean>(false)
  const [_isSearching, _setIsSearching] = useState<boolean>(false)
  
  // useTransition for non-urgent state updates (improves UI responsiveness)
  const [_isPending, startTransition] = useTransition()
  
  // Loading state lock to prevent concurrent loadMore calls
  const isLoadingMore = useRef(false)
  
  // Prefetching state
  const [prefetchedRequests, setPrefetchedRequests] = useState<Request[]>([])
  const [prefetchedOffset, setPrefetchedOffset] = useState<number | null>(null)
  const [_isPrefetching, _setIsPrefetching] = useState(false)
  
  // fetchOnce gate: Single gate for all fetch operations to prevent duplicates
  // Uses Promise-based deduplication (server actions don't support AbortController cancellation)
  const inFlight = useRef(new Map<string, Promise<unknown>>())

  const fetchOnce = useCallback((key: string, fn: () => Promise<unknown>) => {
    const existing = inFlight.current.get(key)
    if (existing) {
      if (isDev()) {
        console.log('[fetchOnce] Request already in flight for key:', key)
      }
      return existing
    }
    
    const p = fn().finally(() => {
      inFlight.current.delete(key)
    })
    inFlight.current.set(key, p)
    return p
  }, [])

  // Helper to create request key from parameters
  // Key format: connectionId + tab + status? + query + offset + filters
  // Must uniquely represent the dataset slice to prevent "stuck data" bugs
  const getRequestKey = useCallback((intent: string, offset: number, searchQuery?: string, assignedToMe?: boolean) => {
    // Include connectionId, intent, offset, searchQuery, and assignedToMe in key
    // Intent distinguishes: 'refresh', 'search', 'prefetch', 'loadMore'
    return `requests:${connectionId}:${intent}:${offset}:${searchQuery || ''}:${assignedToMe ? 'assigned' : 'all'}`
  }, [connectionId])
  
  // Track if component is mounted to prevent state updates after unmount
  const isMountedRef = useRef(true)
  // no optimistic reconcile attempts (disabled)
  
  // Comments map keyed by requestId for instant lookup
  // Initialize with server-fetched comments for instant availability
  const [commentsByRequest, setCommentsByRequest] = useState<Record<string, Comment[]>>(initialComments)
  
  // Local state for modal (like ProfileCard pattern)
  const [selectedRequest, setSelectedRequest] = useState<ModalRequest | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isNewModalOpen, setIsNewModalOpen] = useState(false)
  const [selectedRequestComments, setSelectedRequestComments] = useState<Array<{
    id: string
    userId: string
    userName: string
    userAvatar?: string
    createdAt: Date
    text: string
  }>>([])
  const [convertRequest, setConvertRequest] = useState<ModalRequest | null>(null)
  const [isConvertModalOpen, setIsConvertModalOpen] = useState(false)
  const [isConverting, setIsConverting] = useState(false)
  
  // Get base route from pathname (before early returns)
  const baseRoute = pathname.includes('/clients/') ? 'clients' : 'agencies'
  
  // Get user avatar and organization from context (before early returns)
  const userAvatar = context.user?.avatarUrl || '';
  const userInitials = context.user?.firstName?.[0] + context.user?.lastName?.[0] || 'U';
  const currentOrgId = context.organization.id;
  
  useEffect(() => {
    if (context.variant === 'agency') {
      setNewRequestsCount(initialNewCount ?? 0)
    }
  }, [context.variant, initialNewCount, setNewRequestsCount])

  // Client-side filtering: filter allRequests based on searchQuery and assignedToMe
  const filteredRequests = useMemo(() => {
    let result = allRequests
    
    // Filter by search query (title contains, case-insensitive)
    if (debouncedSearchQuery.trim().length > 0) {
      const query = debouncedSearchQuery.trim().toLowerCase()
      result = result.filter(request => 
        request.title.toLowerCase().includes(query)
      )
    }
    
    // Filter by assigned to me
    if (assignedToMe) {
      if (context.variant === 'agency') {
        // Agency: assigned to current user
        result = result.filter(request => 
          request.assignee?.id === context.user?.id
        )
      } else {
        // Client: created by current user (requests don't have assignee filtering for clients)
        result = result.filter(request => 
          request.submittedBy?.id === context.user?.id
        )
      }
    }
    
    return sortRequestsForDisplay(result)
  }, [allRequests, debouncedSearchQuery, assignedToMe, context.variant, context.user?.id])
  
  // Update isEmpty in context when unfilteredTotalCount changes
  // Note: unfilteredTotalCount is initialized from initialTotalCount (server-side), no need to refetch on mount
  useEffect(() => {
    setIsEmpty(unfilteredTotalCount === 0 && !isBootstrapping)
  }, [unfilteredTotalCount, isBootstrapping, setIsEmpty])

  // DRY: refresh all requests (used by realtime fallback only - no filters)
  // Fetch ALL requests upfront for connection tables (no pagination, no filters)
  const refreshFirstPage = useCallback(async () => {
    const requestKey = `requests:${connectionId}:refresh:all:no-filters`
    
    return fetchOnce(requestKey, async () => {
      const result = await fetchRequestsForConnection(connectionId, {
        limit: 10000, // High safety limit (10k max, way more than any connection needs)
        offset: 0
        // No filters - fetch all requests
      })
      
      if (!isMountedRef.current) return result
      
      // Large state update - use transition for non-urgent render
      startTransition(() => {
        // Sort requests to ensure correct order (status ASC, created_at DESC, id DESC)
        setAllRequests(sortRequestsForDisplay(result.requests))
        setUnfilteredTotalCount(result.totalCount)
        // Filtered count will be computed from filteredRequests useMemo
        setTotalCount(result.totalCount)
        // No pagination - we fetched all data upfront
        setHasMore(false)
        setCurrentOffset(0)
        setPrefetchedRequests([])
        setPrefetchedOffset(null)
      })
      
      if (context.variant === 'agency') {
        setNewRequestsCount(result.newCount ?? 0)
      }
      
      return result
    })
  }, [connectionId, context.variant, setNewRequestsCount, startTransition, fetchOnce])

  // DRY: prepend unique request by id (updates unfiltered data)
  const prependUnique = useCallback((request: Request) => {
    setAllRequests(prev => {
      if (prev.some(r => r.id === request.id)) return prev
      // Sort after prepending to maintain correct order
      return sortRequestsForDisplay([request, ...prev])
    })
    setUnfilteredTotalCount(c => c + 1)
  }, [])

  // DRY: remove by id, return whether something was removed (updates unfiltered data)
  const removeById = useCallback((id: string) => {
    let removed = false
    setAllRequests(prev => {
      const exists = prev.some(r => r.id === id)
      if (!exists) return prev
      removed = true
      return prev.filter(r => r.id !== id)
    })
    if (removed) {
      setUnfilteredTotalCount(c => Math.max(0, c - 1))
    }
    return removed
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      isLoadingMore.current = false
      // Clear in-flight promises map (they'll complete naturally)
      inFlight.current.clear()
    }
  }, [])

  // Helper to merge arrays by id while preserving order and uniqueness
  // After merging, sorts requests to maintain correct order (status ASC, created_at DESC, id DESC)
  function mergeUniqueById(base: Request[], incoming: Request[]): Request[] {
    const seen = new Set(base.map(i => i.id))
    const merged = [...base]
    for (const item of incoming) {
      if (!seen.has(item.id)) {
        seen.add(item.id)
        merged.push(item)
      }
    }
    // Sort merged array to maintain correct order (status ASC, created_at DESC, id DESC)
    return sortRequestsForDisplay(merged)
  }

  // Debounce search query (150ms delay - industry standard for real-time client-side search)
  // Apply debounce only to the input value, not to filtering/rendering logic
  useEffect(() => {
    // If searchQuery hasn't changed from current debouncedSearchQuery, don't update
    if (searchQuery === debouncedSearchQuery) return
    
    const timeoutId = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery)
    }, 150)

    return () => clearTimeout(timeoutId)
  }, [searchQuery, debouncedSearchQuery]) // Include debouncedSearchQuery to satisfy linter

  
  // Prefetch next batch of requests (disabled - we fetch all data upfront)
  // This function is kept for compatibility but should not be called
  const prefetchNext = useCallback(async (_offset: number) => {
    // No-op: we fetch all data upfront, no pagination needed
    if (isDev()) {
      console.log('[Prefetch] Prefetch disabled - all data fetched upfront')
    }
  }, [])

  // Real-time: listen for inserts and updates (including soft-deletes)
  useEffect(() => {
    const supabase = createSupabaseBrowserClient()
    const channel = supabase
      .channel(`requests-insert-${connectionId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'requests', filter: `connection_id=eq.${connectionId}` },
        async (payload: RealtimePostgresChangesPayload<{ id: string; connection_id: string }>) => {
          const newId = (payload?.new as { id: string } | undefined)?.id
          if (!newId) return
          try {
            const req = await fetchRequestById(connectionId, newId)
            if (!req) return
            
            // Add directly to unfiltered data - filtered view will update automatically
            prependUnique(req)
          } catch (_) {
            // fallback to full refresh if single-row fetch fails
            await refreshFirstPage()
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'requests', filter: `connection_id=eq.${connectionId}` },
        async (payload: RealtimePostgresChangesPayload<{ id: string; connection_id: string; deleted_at: string | null }>) => {
          const updated = (payload?.new as { id: string; deleted_at: string | null } | undefined)
          if (!updated) return
          
          // Handle soft delete locally (updates unfiltered data)
          if (updated.deleted_at) {
            removeById(updated.id)
            return
          }
          
          // For non-delete updates, use targeted update (updates unfiltered data)
          try {
            const req = await fetchRequestById(connectionId, updated.id)
            if (!req) return
            
            // Update selectedRequest if it's the one being updated
            setSelectedRequest(prev => {
              if (prev && prev.requestId === req.id) {
                return {
                  ...prev,
                  title: req.title,
                  description: req.description,
                  assignee: req.assignee,
                  project: req.project,
                  status: req.status,
                  createdAt: req.createdAt,
                  createdByOrgId: req.createdByOrgId,
                  createdByOrgType: req.createdByOrgType
                }
              }
              return prev
            })
            
            // Update request in unfiltered data - filtered view will update automatically
            setAllRequests(prev => {
              const existingIndex = prev.findIndex((r: Request) => r.id === req.id)
              if (existingIndex !== -1) {
                // Request exists - update it
                const next = [...prev]
                next[existingIndex] = req
                // Sort after update to maintain correct order
                return sortRequestsForDisplay(next)
              } else {
                // Request not in list - add it (e.g., status changed)
                // Sort after adding to maintain correct order
                return sortRequestsForDisplay([...prev, req])
              }
            })
          } catch (_) {
            // Fallback to full refresh only on error
            await refreshFirstPage()
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [connectionId, refreshFirstPage, prependUnique, removeById])

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
        setAllRequests(prev => mergeUniqueById(prev, prefetchedRequests))
        setCurrentOffset(nextOffset)
      }
      
      // Fetch comments for the new requests
      const newIds = prefetchedRequests.map((r: Request) => r.id)
      if (newIds.length > 0) {
        fetchCommentsForRequests(newIds)
          .then(map => {
            if (isMountedRef.current) {
              setCommentsByRequest(prev => ({ ...prev, ...map }))
            }
          })
          .catch(error => {
            if (isDev()) {
              console.error('Error fetching comments for prefetched requests:', error)
            }
          })
      }
      
      // Clear prefetched data
      setPrefetchedRequests([])
      setPrefetchedOffset(null)
      
      // If we got fewer than PAGE_SIZE, there are no more
      if (prefetchedCount < PAGE_SIZE) {
        setHasMore(false)
      } else {
        // Only prefetch next batch if user is very close to end (< 5 rows)
        // Prefetch should ONLY happen from loadMore when user scrolls near end
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
    
    isLoadingMore.current = true
    
    // Fallback: fetch on-demand if prefetch didn't complete in time
    const requestKey = getRequestKey(`loadMore:${currentOffset}`, currentOffset, debouncedSearchQuery, assignedToMe)
    
    if (isDev()) {
      console.log('[LoadMore] Fetching on-demand for key:', requestKey)
    }
    
    try {
      const result = await fetchOnce(requestKey, async () => {
        return await fetchRequestsForConnection(connectionId, { 
          limit: PAGE_SIZE, 
          offset: currentOffset,
          searchQuery: debouncedSearchQuery || undefined,
          assignedToUserId: assignedToMe && context.variant === 'agency' ? context.user?.id : undefined,
          createdByUserId: assignedToMe && context.variant === 'client' ? context.user?.id : undefined
        })
      }) as Awaited<ReturnType<typeof fetchRequestsForConnection>>
      
      // Only update state if component is still mounted
      if (!isMountedRef.current) return
      
      if (result.requests.length === 0) {
        setHasMore(false)
      } else {
        setAllRequests(prev => mergeUniqueById(prev, result.requests))
        setUnfilteredTotalCount(result.totalCount)
        const nextOffset = currentOffset + PAGE_SIZE
        setCurrentOffset(nextOffset)
        
        // Fetch comments for the new requests
        const newIds = result.requests.map((r: Request) => r.id)
        if (newIds.length > 0) {
          fetchCommentsForRequests(newIds)
            .then(map => {
              if (isMountedRef.current) {
                setCommentsByRequest(prev => ({ ...prev, ...map }))
              }
            })
            .catch(error => {
              if (isDev()) {
                console.error('Error fetching comments for on-demand requests:', error)
              }
            })
        }
        
        // If we got fewer than PAGE_SIZE, there are no more
        if (result.requests.length < PAGE_SIZE) {
          setHasMore(false)
        } else {
          // Only prefetch next batch if user is very close to end (< 5 rows)
          // Prefetch should ONLY happen from loadMore when user scrolls near end
          prefetchNext(nextOffset)
        }
      }
      
      if (context.variant === 'agency' && isMountedRef.current) {
        setNewRequestsCount(result.newCount ?? 0)
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
    }
  }, [connectionId, hasMore, currentOffset, prefetchedRequests, prefetchedOffset, prefetchNext, debouncedSearchQuery, assignedToMe, context.user?.id, context.variant, setNewRequestsCount, getRequestKey, fetchOnce])

  // Toggle handler for Assigned to me (client-side filtering only)
  const handleToggleAssignedToMe = useCallback(() => {
    setAssignedToMe(prev => !prev)
  }, [])

  // REMOVED: Automatic prefetch effect
  // Prefetch should ONLY happen from loadMore() when user scrolls near end
  // This prevents ~80% of request spam

  // Load more handler for virtual scroll
  const _handleLoadMore = useCallback((_virtualRows: VirtualItem[]) => {
    // Virtual scroll triggers loadMore in RequestsTable based on scroll position
    // This handler is called when user scrolls near the end
            loadMore()
  }, [loadMore])

  // Handle optimistic deletion from query params (when navigating from detail page)
  useEffect(() => {
    // Note: This effect is kept for backward compatibility but URL params are no longer synced
    // If we need to handle deleted param in the future, we can read it from window.location.search
    // For now, real-time updates handle deletions
  }, [])

  function getRequestById(requestId: string) {
    return allRequests.find(r => r.id === requestId)
  }

  function handleRequestUpdate(requestId: string, updates: { title?: string; description?: string; status?: 'new' | 'in_review' | 'accepted' | 'canceled' | 'closed'; project?: { id: string; name: string } | null }) {
    // Get the original request to compare status changes
    const originalRequest = allRequests.find(r => r.id === requestId)
    
    // Update unfiltered requests list optimistically
    setAllRequests(prevRequests => {
      const updated = prevRequests.map(req =>
        req.id === requestId
          ? { ...req, ...updates }
          : req
      )
      // Sort after update to maintain correct order (status may have changed)
      return sortRequestsForDisplay(updated)
    })

    // Also update selectedRequest if it's the current one
    setSelectedRequest(prev => 
      prev && prev.requestId === requestId
        ? { ...prev, ...updates }
        : prev
    )
    
    // Optimistically update status counts when status changes
    if (updates.status && originalRequest && originalRequest.status !== updates.status) {
      setStatusCounts(prev => {
        const next = { ...prev }
        // Decrement old status count
        const oldStatus = originalRequest.status
        if (next[oldStatus] !== undefined) {
          next[oldStatus] = Math.max(0, (next[oldStatus] || 0) - 1)
        }
        // Increment new status count
        const newStatus = updates.status!
        next[newStatus] = (next[newStatus] || 0) + 1
        return next
      })
    }
    
    // Update badge count for agency view if status changed
    if (context.variant === 'agency' && updates.status && originalRequest) {
      const wasNew = originalRequest.status === 'new'
      const isNowNew = updates.status === 'new'
      
      // Increment count if status changed TO 'new'
      if (!wasNew && isNowNew) {
        setNewRequestsCount(prev => (prev || 0) + 1)
      }
      // Decrement count if status changed FROM 'new'
      else if (wasNew && !isNowNew) {
        setNewRequestsCount(prev => Math.max(0, (prev || 0) - 1))
      }
    }
  }

  function handleRowClick(requestId: string) {
    const request = getRequestById(requestId)
    if (request) {
      // Get comments from pre-fetched map (instant, no fetch)
      // Comments are always prefetched server-side for initial requests
      // and client-side for search/pagination results
      const comments = commentsByRequest[requestId] ?? []
      
      // Open modal immediately with request data and comments
      setSelectedRequest({
        requestId: request.id,
        title: request.title,
        description: request.description,
        client: request.client,
        agency: request.agency,
        submittedBy: request.submittedBy,
        assignee: request.assignee,
        project: request.project,
        status: request.status,
        createdAt: request.createdAt,
        createdByOrgId: request.createdByOrgId,
        createdByOrgType: request.createdByOrgType
      })
      setSelectedRequestComments(comments)
      setIsModalOpen(true)
    }
  }

  function handleTableRequestDeleted(requestId: string) {
    // Get the deleted request to check if it was 'new' status
    const deletedRequest = allRequests.find(r => r.id === requestId)
    
    // Optimistically remove request from unfiltered table
    setAllRequests(prev => prev.filter(r => r.id !== requestId))
    
    // Optimistically update status counts
    if (deletedRequest?.status) {
      setStatusCounts(prev => {
        const next = { ...prev }
        if (next[deletedRequest.status] !== undefined) {
          next[deletedRequest.status] = Math.max(0, (next[deletedRequest.status] || 0) - 1)
        }
        return next
      })
    }
    
    // Update badge count if deleted request was 'new' status in agency view
    if (context.variant === 'agency' && deletedRequest?.status === 'new') {
      setNewRequestsCount(prev => Math.max(0, (prev || 0) - 1))
    }
    
    // Decrement total count
    setUnfilteredTotalCount(c => Math.max(0, c - 1))
    // Filtered count will be computed from filteredRequests useMemo
  }

  function handleModalClose() {
    // Close modal first, then clear data after animation completes
    setIsModalOpen(false)
    // Small delay to let animation finish
    setTimeout(() => {
      setSelectedRequest(null)
      setSelectedRequestComments([])
    }, 300)
  }

  function handleConvertModalClose() {
    setIsConvertModalOpen(false)
    setTimeout(() => {
      setConvertRequest(null)
    }, 300)
  }

  async function handleConvertSubmit(values: ConvertToTaskModalValues) {
    const { requestId, title, description, status, project, assignee, dueDateRaw, clientVisible } = values
    if (!requestId) {
      toast.error('Request unavailable for conversion')
      return
    }
    setIsConverting(true)
    try {
      await convertRequestToTask(requestId, {
        connectionId,
        title,
        description,
        status,
        projectId: project?.id ?? null,
        assigneeUserId: assignee?.id ?? null,
        dueDateRaw,
        clientVisible,
      })

      toast.success('Task created from request')
      handleConvertModalClose()
      handleRequestUpdate(requestId, { status: 'accepted' })
      // Real-time subscription will handle UI updates
    } catch (error) {
      if (isDev()) {
        console.error('Failed to convert request to task:', error)
      }
      toast.error('Failed to convert request')
    } finally {
      setIsConverting(false)
    }
  }

  function handleRequestConvertToTask(request: ModalRequest) {
    setConvertRequest({
      ...request,
      description: request.description ?? '',
    })
    setIsConvertModalOpen(true)
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
      const url = `/${baseRoute}/${connectionId}/requests/${selectedRequest.requestId}`
      window.location.href = url
    }
  }

  // Optimistic add: show a temporary row immediately
  const handleRequestOptimistic = useCallback((payload: {
    tempId: string
    title: string
    description: string
    projectId: string | null
    projectName?: string | null
    assigneeUserId: string | null
  }) => {
    const now = new Date()

    const optimisticRow: Request = {
      id: payload.tempId,
      connectionId,
      title: payload.title,
      description: payload.description || '',
      status: 'new',
      project: payload.projectId && payload.projectName ? { id: payload.projectId, name: payload.projectName } : null,
      submittedBy: {
        id: context.user?.id || '',
        name: `${context.user?.firstName || ''} ${context.user?.lastName || ''}`.trim() || 'You',
        email: context.user?.email || '',
        avatarUrl: context.user?.avatarUrl || undefined,
        jobTitle: context.user?.jobTitle || undefined,
        orgId: context.organization.id,
        orgName: context.organization.name || '',
        orgLogo: undefined,
      },
      assignee: null,
      client: {
        id: snapshot.partner.id,
        name: snapshot.partner.name,
        logoUrl: snapshot.partner.logo,
      },
    // Store ISO timestamp for proper sorting (will be formatted for display in RequestRow)
    // The sorting function uses Date.parse() which works reliably with ISO strings
    createdAt: now.toISOString(),
    createdByOrgId: context.organization.id,
    }

    // Sort after prepending to maintain correct order
    setAllRequests(prev => sortRequestsForDisplay([optimisticRow, ...prev]))
    setUnfilteredTotalCount(c => c + 1)
    // Filtered count will be computed from filteredRequests useMemo
    
    // Optimistically update status counts (new request always has 'new' status)
    setStatusCounts(prev => {
      const next = { ...prev }
      next['new'] = (next['new'] || 0) + 1
      return next
    })
    
    // Optimistically update badge count for agency view
    if (context.variant === 'agency') {
      setNewRequestsCount(prev => (prev || 0) + 1)
    }
  }, [connectionId, context.user, context.organization, snapshot.partner, context.variant, setNewRequestsCount])

  async function handleRequestCreated({ requestId, tempId }: { requestId: string; tempId?: string }) {
    try {
      const req = await fetchRequestById(connectionId, requestId)
      if (!req) return
      // Replace temp row if present; otherwise prepend and increment count
      setAllRequests(prev => {
        const optimisticEntry = tempId ? prev.find(r => r.id === tempId) : null
        
        // If replacing optimistic entry, preserve its ISO timestamp for proper sorting
        // Server returns formatted date which doesn't include time, causing sorting issues
        const finalReq = optimisticEntry && optimisticEntry.createdAt.includes('T') 
          ? { ...req, createdAt: optimisticEntry.createdAt }
          : req
        
        const without = prev.filter(r => r.id !== tempId && r.id !== req.id)
        const next = [finalReq, ...without]
        // Sort after replacing/adding to maintain correct order
        return sortRequestsForDisplay(next)
      })
      // If no temp was present, bump the count; if temp existed, count already included
      if (!tempId) {
        setUnfilteredTotalCount(c => c + 1)
      }
      // Filtered count will be computed from filteredRequests useMemo
      
      // Update badge count if request is new and we're in agency view (only if no temp was present)
      if (!tempId && context.variant === 'agency' && req.status === 'new') {
        setNewRequestsCount(prev => (prev || 0) + 1)
      }
    } catch (error) {
      if (isDev()) {
        console.error('Failed to insert newly created request into table:', error)
      }
    }
  }

  // No optimistic display merge; show server-backed list only

  return (
    <>
      {/* Requests Table */}
      <div ref={parentRef}>
      <RequestsTable
        userAvatar={userAvatar}
        userInitials={userInitials}
        onRequestClick={handleRowClick}
        onNewRequest={handleNewRequest}
        requests={filteredRequests}
        agencyMembers={agencyMembers}
        onRequestUpdate={handleRequestUpdate}
        currentOrgId={currentOrgId}
        // No onLoadMore - we fetch all data upfront for connection tables
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        totalCount={filteredRequests.length}
        unfilteredTotalCount={unfilteredTotalCount}
          parentRef={parentRef}
        assignedToMe={assignedToMe}
        onToggleAssignedToMe={handleToggleAssignedToMe}
        isBootstrapping={false}
        isAgency={context.variant === 'agency'}
        agencyOrganization={context.variant === 'client' ? {
          id: snapshot.agency.id,
          name: snapshot.agency.name,
          logoUrl: snapshot.agency.logo || undefined
        } : undefined}
        onRequestDeleted={handleTableRequestDeleted}
        onConvertToTask={(request) => {
          handleRequestConvertToTask({
            requestId: request.id,
            title: request.title,
            description: request.description ?? '',
            client: request.client,
            agency: request.agency,
            submittedBy: request.submittedBy
              ? {
                  id: request.submittedBy.id,
                  name: request.submittedBy.name,
                  email: request.submittedBy.email,
                  avatarUrl: request.submittedBy.avatarUrl,
                }
              : undefined,
            assignee: request.assignee
              ? {
                  id: request.assignee.id,
                  name: request.assignee.name,
                  email: request.assignee.email,
                  avatarUrl: request.assignee.avatarUrl,
                }
              : null,
            project: request.project,
            status: request.status,
            createdAt: request.createdAt,
            createdByOrgId: request.createdByOrgId,
            createdByOrgType: request.createdByOrgType,
          })
        }}
        statusCounts={statusCounts}
      />
      </div>

      {/* Request Detail Modal - For existing requests */}
      <RequestDetailModal
        requestData={selectedRequest}
        agencyMembers={agencyMembers}
        projects={projects}
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onExpand={handleExpand}
        onRequestUpdate={handleRequestUpdate}
        onCommentsUpdate={(comments) => {
          // Update comments cache when comments are created/deleted in modal
          if (selectedRequest?.requestId) {
            setCommentsByRequest(prev => ({
              ...prev,
              [selectedRequest.requestId]: comments
            }))
            // Also update selectedRequestComments so modal shows updated comments immediately
            setSelectedRequestComments(comments)
          }
        }}
        onConvertToTask={(request) => {
          if (!request) return
          handleRequestConvertToTask({
            requestId: request.requestId,
            title: request.title,
            description: request.description || '',
            client: request.client,
            agency: request.agency,
            submittedBy: request.submittedBy,
            assignee: request.assignee ?? null,
            project: request.project ?? null,
            status: request.status,
            createdAt: request.createdAt,
            createdByOrgId: request.createdByOrgId,
            createdByOrgType: request.createdByOrgType,
          })
        }}
        onRequestDeleted={(requestId) => {
          // Get the deleted request to check if it was 'new' status
          const deletedRequest = allRequests.find(r => r.id === requestId)
          
          // Optimistically remove request from unfiltered table
          setAllRequests(prev => prev.filter(r => r.id !== requestId))
          
          // Update badge count if deleted request was 'new' status in agency view
          if (context.variant === 'agency' && deletedRequest?.status === 'new') {
            setNewRequestsCount(prev => Math.max(0, (prev || 0) - 1))
          }
          
          // Decrement counts
          setUnfilteredTotalCount(c => Math.max(0, c - 1))
          // Filtered count will be computed from filteredRequests useMemo
          
          // REMOVED: setTimeout reconciliation hack
          // Let realtime or next user action refresh, not timers
        }}
        connectionId={connectionId}
        currentOrgId={currentOrgId}
        variant={context.variant}
        activeUser={context.user ? {
          id: context.user.id,
          firstName: context.user.firstName,
          lastName: context.user.lastName,
          avatarUrl: context.user.avatarUrl
        } : undefined}
        initialComments={selectedRequestComments}
      />
      
      <ConvertToTaskModal
        isOpen={isConvertModalOpen}
        onClose={handleConvertModalClose}
        onSubmit={handleConvertSubmit}
        isSubmitting={isConverting}
        connectionId={connectionId}
        request={convertRequest}
        agencyMembers={agencyMembers}
        projects={projects}
        variant={context.variant}
      />
      
      {/* New Request Modal - For creating new requests */}
      <NewRequestModal
        client={{
          id: snapshot.partner.id,
          name: snapshot.partner.name,
          logoUrl: snapshot.partner.logo
        }}
        agencyMembers={agencyMembers}
        projects={projects}
        isOpen={isNewModalOpen}
        onClose={handleNewModalClose}
        onRequestOptimistic={handleRequestOptimistic}
        onRequestCreated={handleRequestCreated}
        connectionId={connectionId}
        currentOrgId={currentOrgId}
        variant={context.variant}
      />
    </>
  );
}

// Export wrapped component with error boundary
export default function RequestsPageClient(props: RequestsPageClientProps) {
  return (
    <RequestsPageErrorBoundary>
      <RequestsPageClientContent {...props} />
    </RequestsPageErrorBoundary>
  );
}

