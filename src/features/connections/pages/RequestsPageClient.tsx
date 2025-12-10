'use client'

import { useState, useEffect, useRef, useCallback, useTransition } from 'react'
import { createClient as createSupabaseBrowserClient } from '@/lib/supabase/client'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { useConnection } from '../ConnectionContext';
import RequestsTable from '../requests/RequestsTable';
import { RequestDetailModal } from '../requests/RequestDetailModal'
import { NewRequestModal } from '../requests/NewRequestModal'
import type { Request, Comment } from '../server';
import { fetchRequestsForConnection, fetchRequestById, fetchCommentsForRequests } from '../requests/actions';
import { ConvertToTaskModal, type ConvertToTaskModalValues } from '../tasks/ConvertToTaskModal'
import { convertRequestToTask } from '../tasks/actions'
import { PAGE_SIZE, PREFETCH_TIMEOUT_MS, isDev } from '../constants';
import type { VirtualItem } from '@tanstack/react-virtual';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

interface RequestsPageClientProps {
  connectionId: string
  initialRequests: Request[]
  initialTotalCount: number
  initialNewCount: number
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
export default function RequestsPageClient({ connectionId, initialRequests, initialTotalCount, initialNewCount, agencyMembers, projects, initialComments = {} }: RequestsPageClientProps) {
  const { snapshot, context, setIsEmpty, setNewRequestsCount } = useConnection();
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const baseRoute = pathname.includes('/clients/') ? 'clients' : 'agencies'
  // MVP: read assigned filter synchronously from URL before first fetch
  const initiallyAssigned = (() => {
    try { return searchParams.get('assigned') === 'me' } catch { return false }
  })()
  
  // Get user avatar and organization from context
  const userAvatar = context.user?.avatarUrl || '';
  const userInitials = context.user?.firstName?.[0] + context.user?.lastName?.[0] || 'U';
  const currentOrgId = context.organization.id;

  // Local state for requests (for optimistic updates)
  const [requests, setRequests] = useState<Request[]>(initiallyAssigned ? [] : initialRequests)
  // Optimistic new requests disabled (relying on real-time updates)
  
  // Total count state (filtered)
  const [totalCount, setTotalCount] = useState<number>(initiallyAssigned ? 0 : initialTotalCount)
  
  // Unfiltered total count state (total requests for connection regardless of filters)
  const [unfilteredTotalCount, setUnfilteredTotalCount] = useState<number>(initialTotalCount)
  useEffect(() => {
    if (context.variant === 'agency') {
      setNewRequestsCount(initialNewCount ?? 0)
    }
  }, [context.variant, initialNewCount, setNewRequestsCount])
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('')
  const previousDebouncedSearchRef = useRef<string>('')
  const [assignedToMe, setAssignedToMe] = useState<boolean>(initiallyAssigned)
  
  // Pagination state
  const [hasMore, setHasMore] = useState(initiallyAssigned ? true : initialRequests.length === PAGE_SIZE)
  const [currentOffset, setCurrentOffset] = useState(PAGE_SIZE)
  const parentRef = useRef<HTMLDivElement>(null)
  // Buffer initial empty render with skeleton when assigned=me or when search/assigned filter changes
  const [isBootstrapping, setIsBootstrapping] = useState<boolean>(initiallyAssigned)
  const [isSearching, setIsSearching] = useState<boolean>(false)
  
  // useTransition for non-urgent state updates (improves UI responsiveness)
  const [_isPending, startTransition] = useTransition()
  
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
  // no optimistic reconcile attempts (disabled)
  
  // Comments map keyed by requestId for instant lookup
  // Initialize with server-fetched comments for instant availability
  const [commentsByRequest, setCommentsByRequest] = useState<Record<string, Comment[]>>(initialComments)
  
  // Update isEmpty in context when unfilteredTotalCount changes
  // Note: unfilteredTotalCount is initialized from initialTotalCount (server-side), no need to refetch on mount
  useEffect(() => {
    setIsEmpty(unfilteredTotalCount === 0 && !isBootstrapping)
  }, [unfilteredTotalCount, isBootstrapping, setIsEmpty])

  // DRY: refresh first page (used by realtime fallback and deletes under search)
  const refreshFirstPage = useCallback(async () => {
    try {
      const result = await fetchRequestsForConnection(connectionId, {
        limit: PAGE_SIZE,
        offset: 0,
        searchQuery: debouncedSearchQuery || undefined,
        assignedToUserId: assignedToMe && context.variant === 'agency' ? context.user?.id : undefined,
        createdByUserId: assignedToMe && context.variant === 'client' ? context.user?.id : undefined
      })
      if (!isMountedRef.current) return
      // Large state update - use transition for non-urgent render
      startTransition(() => {
        setRequests(result.requests)
        setTotalCount(result.totalCount)
        setHasMore(result.requests.length === PAGE_SIZE)
        setCurrentOffset(PAGE_SIZE)
        setPrefetchedRequests([])
        setPrefetchedOffset(null)
      })
      if (context.variant === 'agency') {
        setNewRequestsCount(result.newCount ?? 0)
      }
    } catch (_) {
      // ignore
    }
  }, [connectionId, debouncedSearchQuery, assignedToMe, context.user?.id, context.variant, setNewRequestsCount, startTransition])

  // DRY: prepend unique request by id
  const prependUnique = useCallback((request: Request) => {
    setRequests(prev => {
      if (prev.some(r => r.id === request.id)) return prev
      return [request, ...prev]
    })
  }, [])

  // DRY: remove by id, return whether something was removed
  const removeById = useCallback((id: string) => {
    let removed = false
    setRequests(prev => {
      const exists = prev.some(r => r.id === id)
      if (!exists) return prev
      removed = true
      return prev.filter(r => r.id !== id)
    })
    return removed
  }, [])

  // Cleanup on unmount - cancel in-flight requests and timeouts
  useEffect(() => {
    isMountedRef.current = true
    const inFlightRequestsRef = inFlightRequests.current
    const prefetchTimeoutsRef = prefetchTimeouts.current
    return () => {
      isMountedRef.current = false
      inFlightRequestsRef.clear()
      isLoadingMore.current = false
      // Clear all prefetch timeouts
      prefetchTimeoutsRef.forEach(timeout => clearTimeout(timeout))
      prefetchTimeoutsRef.clear()
    }
  }, [])

  // Helper to merge arrays by id while preserving order and uniqueness
  function mergeUniqueById<T extends { id: string }>(base: T[], incoming: T[]): T[] {
    const seen = new Set(base.map(i => i.id))
    const merged = [...base]
    for (const item of incoming) {
      if (!seen.has(item.id)) {
        seen.add(item.id)
        merged.push(item)
      }
    }
    return merged
  }

  // Debounce search query (150ms delay for faster responsiveness)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery)
    }, 150)

    return () => clearTimeout(timeoutId)
  }, [searchQuery])

  // Sync search to URL parameters (matching global tables pattern)
  useEffect(() => {
    const currentSearchParam = searchParams.get('search') || ''
    
    if (debouncedSearchQuery !== currentSearchParam) {
      const params = new URLSearchParams(searchParams.toString())
      if (debouncedSearchQuery.trim()) {
        params.set('search', debouncedSearchQuery.trim())
      } else {
        params.delete('search')
      }
      const newUrl = `${pathname}${params.toString() ? `?${params.toString()}` : ''}`
      router.replace(newUrl, { scroll: false })
    }
  }, [debouncedSearchQuery, searchParams, pathname, router])

  // Track if this is the initial mount
  const isInitialMount = useRef(true)

  // One-time: fetch filtered results immediately on mount if assigned=me
  useEffect(() => {
    if (initiallyAssigned) {
      (async () => {
        try {
          const result = await fetchRequestsForConnection(connectionId, {
            limit: PAGE_SIZE,
            offset: 0,
            searchQuery: debouncedSearchQuery || undefined,
            assignedToUserId: context.variant === 'agency' ? context.user?.id : undefined,
            createdByUserId: context.variant === 'client' ? context.user?.id : undefined
          })
          if (!isMountedRef.current) return
          setRequests(result.requests)
          setTotalCount(result.totalCount)
          setHasMore(result.requests.length === PAGE_SIZE)
          setCurrentOffset(PAGE_SIZE)
          if (context.variant === 'agency') {
            setNewRequestsCount(result.newCount ?? 0)
          }
        } finally {
          setIsBootstrapping(false)
        }
      })()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Reset pagination and fetch new results when debounced search query or assignedToMe changes
  useEffect(() => {
    // Skip on initial mount if there's no search query and not assigned to me (we already have initialRequests)
    if (isInitialMount.current && !debouncedSearchQuery && !assignedToMe) {
      isInitialMount.current = false
      previousDebouncedSearchRef.current = debouncedSearchQuery
      return
    }
    isInitialMount.current = false

    // Set loading state to show skeleton only when:
    // 1. There's an active search query, OR
    // 2. We're clearing search (had search before, now don't)
    // Don't show skeleton on initial page load or tab navigation without search
    const hadSearchBefore = previousDebouncedSearchRef.current.trim().length > 0
    const hasSearchNow = debouncedSearchQuery.trim().length > 0
    const isClearingSearch = hadSearchBefore && !hasSearchNow
    
    if (hasSearchNow || isClearingSearch) {
      setIsSearching(true)
    }
    
    // Update previous search ref for next comparison
    previousDebouncedSearchRef.current = debouncedSearchQuery

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
          searchQuery: debouncedSearchQuery || undefined,
          assignedToUserId: assignedToMe && context.variant === 'agency' ? context.user?.id : undefined,
          createdByUserId: assignedToMe && context.variant === 'client' ? context.user?.id : undefined
        })

        if (isMountedRef.current) {
          // Large state update - use transition for non-urgent render
          startTransition(() => {
            setRequests(result.requests)
            setTotalCount(result.totalCount)
            const newHasMore = result.requests.length === PAGE_SIZE
            setHasMore(newHasMore)
            setCurrentOffset(PAGE_SIZE)
            setPrefetchedRequests([])
            setPrefetchedOffset(null)
            setIsSearching(false)
          })
          if (context.variant === 'agency') {
            setNewRequestsCount(result.newCount ?? 0)
          }
          
          // Prefetch comments for search results
          const newIds = result.requests.map(r => r.id)
          if (newIds.length > 0) {
            fetchCommentsForRequests(newIds)
              .then(map => {
                if (isMountedRef.current) {
                  setCommentsByRequest(prev => ({ ...prev, ...map }))
                }
              })
              .catch(error => {
                if (isDev()) {
                  console.error('Error fetching comments for search results:', error)
                }
              })
          }
        }
      } catch (error) {
        if (isDev()) {
          console.error('Failed to fetch search results:', error)
        }
        if (isMountedRef.current) {
          setHasMore(false)
          setIsSearching(false)
        }
      }
    }

    fetchSearchResults()
  }, [debouncedSearchQuery, connectionId, assignedToMe, context.user?.id, context.variant, setNewRequestsCount, startTransition])
  
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
        searchQuery: debouncedSearchQuery || undefined,
        assignedToUserId: assignedToMe && context.variant === 'agency' ? context.user?.id : undefined,
        createdByUserId: assignedToMe && context.variant === 'client' ? context.user?.id : undefined
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
          if (context.variant === 'agency') {
            setNewRequestsCount(result.newCount ?? 0)
          }
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
  }, [connectionId, hasMore, isPrefetching, debouncedSearchQuery, assignedToMe, context.user?.id, context.variant, setNewRequestsCount])

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
            
            // Server-side filtering handles search/assignee filters
            // If filters are active, refresh first page to get filtered results
            if (debouncedSearchQuery || assignedToMe) {
              await refreshFirstPage()
            } else {
              // No filters - add directly
              prependUnique(req)
              setTotalCount(c => c + 1)
              setUnfilteredTotalCount(c => c + 1)
            }
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
          
          // Handle soft delete locally
          if (updated.deleted_at) {
            const wasRemoved = removeById(updated.id)
            if (wasRemoved) {
              setTotalCount(c => Math.max(0, c - 1))
              setUnfilteredTotalCount(c => Math.max(0, c - 1))
            }
            return
          }
          
          // For non-delete updates, use targeted update instead of refreshing entire first page
          // This prevents flickering when optimistic updates are in progress
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
            
            // Targeted update: update request in local state if it exists
            // Only refresh if filters are active and request might not match current filters
            const needsFullRefresh = debouncedSearchQuery || assignedToMe
            
            if (needsFullRefresh) {
              // With filters active, request might appear/disappear, so refresh to apply server-side filtering
              await refreshFirstPage()
            } else {
              // No filters - update request in place
              setRequests(prev => {
                const existingIndex = prev.findIndex(r => r.id === req.id)
                if (existingIndex !== -1) {
                  // Request exists in current list - update it
                  const next = [...prev]
                  next[existingIndex] = req
                  return next
                } else {
                  // Request not in current list - might need to be added (e.g., status changed)
                  // Check if it should be visible based on current view
                  // For now, add it if it's not already there (will be sorted correctly)
                  return [...prev, req]
                }
              })
            }
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
  }, [connectionId, debouncedSearchQuery, assignedToMe, refreshFirstPage, prependUnique, removeById])

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
        setRequests(prev => mergeUniqueById(prev, prefetchedRequests))
        setCurrentOffset(nextOffset)
      }
      
      // Fetch comments for the new requests
      const newIds = prefetchedRequests.map(r => r.id)
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
        searchQuery: debouncedSearchQuery || undefined,
        assignedToUserId: assignedToMe && context.variant === 'agency' ? context.user?.id : undefined,
        createdByUserId: assignedToMe && context.variant === 'client' ? context.user?.id : undefined
      })
      
      // Only update state if component is still mounted
      if (!isMountedRef.current) return
      
      if (result.requests.length === 0) {
        if (isMountedRef.current) {
          setHasMore(false)
        }
      } else {
        if (isMountedRef.current) {
          setRequests(prev => mergeUniqueById(prev, result.requests))
          setTotalCount(result.totalCount)
          const nextOffset = currentOffset + PAGE_SIZE
          setCurrentOffset(nextOffset)
          
          // Fetch comments for the new requests
          const newIds = result.requests.map(r => r.id)
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
            // Prefetch next batch
            prefetchNext(nextOffset)
          }
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
      inFlightRequests.current.delete(currentOffset)
    }
  }, [connectionId, hasMore, currentOffset, prefetchedRequests, prefetchedOffset, prefetchNext, debouncedSearchQuery, assignedToMe, context.user?.id, context.variant, setNewRequestsCount])

  // Toggle handler and URL sync for Assigned to me
  const handleToggleAssignedToMe = useCallback(() => {
    const next = !assignedToMe
    setAssignedToMe(next)
    // Update URL - the fetch useEffect will handle the actual fetch when assignedToMe state changes
    const newSearchParams = new URLSearchParams(searchParams.toString())
    if (next) newSearchParams.set('assigned', 'me')
    else newSearchParams.delete('assigned')
    const newUrl = `${pathname}${newSearchParams.toString() ? `?${newSearchParams.toString()}` : ''}`
    router.replace(newUrl, { scroll: false })
  }, [assignedToMe, searchParams, pathname, router])

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
  const handleLoadMore = useCallback((_virtualRows: VirtualItem[]) => {
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

  function getRequestById(requestId: string) {
    return requests.find(r => r.id === requestId)
  }

  function handleRequestUpdate(requestId: string, updates: { title?: string; description?: string; status?: 'new' | 'in_review' | 'accepted' | 'canceled' | 'closed'; project?: { id: string; name: string } | null }) {
    // Get the original request to compare status changes
    const originalRequest = requests.find(r => r.id === requestId)
    
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
    const deletedRequest = requests.find(r => r.id === requestId)
    
    // Optimistically remove request from table
    setRequests(prev => prev.filter(r => r.id !== requestId))
    
    // Update badge count if deleted request was 'new' status in agency view
    if (context.variant === 'agency' && deletedRequest?.status === 'new') {
      setNewRequestsCount(prev => Math.max(0, (prev || 0) - 1))
    }
    
    // Decrement total count
    setTotalCount(c => Math.max(0, c - 1))
    setUnfilteredTotalCount(c => Math.max(0, c - 1))
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
    const today = (() => {
      const day = now.getDate()
      const month = now.toLocaleDateString('en-US', { month: 'short' })
      const year = now.getFullYear()
      return `${day} ${month} ${year}`
    })()

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
    // Use ISO string for proper sorting (will be formatted by server response)
    // This ensures the optimistic request appears at the top when sorted by created_at DESC
    createdAt: now.toISOString(),
    createdByOrgId: context.organization.id,
    }

    setRequests(prev => [optimisticRow, ...prev])
    setTotalCount(c => c + 1)
    setUnfilteredTotalCount(c => c + 1)
    
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
      setRequests(prev => {
        const hadTemp = tempId ? prev.some(r => r.id === tempId) : false
        const without = prev.filter(r => r.id !== tempId && r.id !== req.id)
        const next = [req, ...without]
        if (hadTemp) {
          // keep count the same
          return next
        }
        // If no temp, we will increment count below
        return next
      })
      // If no temp was present, bump the count; if temp existed, count already included
      if (tempId) {
        // no-op for count
      } else {
        setTotalCount(c => c + 1)
        setUnfilteredTotalCount(c => c + 1)
      }
      
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
        requests={requests}
        agencyMembers={agencyMembers}
        onRequestUpdate={handleRequestUpdate}
        currentOrgId={currentOrgId}
          onLoadMore={handleLoadMore}
        onSearchChange={setSearchQuery}
        totalCount={totalCount}
        unfilteredTotalCount={unfilteredTotalCount}
          parentRef={parentRef}
        assignedToMe={assignedToMe}
        onToggleAssignedToMe={handleToggleAssignedToMe}
        isBootstrapping={isBootstrapping || isSearching || (searchQuery !== debouncedSearchQuery && searchQuery.trim().length > 0)}
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
          const deletedRequest = requests.find(r => r.id === requestId)
          
          // Optimistically remove request from table
          setRequests(prev => prev.filter(r => r.id !== requestId))
          
          // Update badge count if deleted request was 'new' status in agency view
          if (context.variant === 'agency' && deletedRequest?.status === 'new') {
            setNewRequestsCount(prev => Math.max(0, (prev || 0) - 1))
          }
          
          // Decrement counts
          setTotalCount(c => Math.max(0, c - 1))
          setUnfilteredTotalCount(c => Math.max(0, c - 1))
          
          // Safety: reconcile with DB shortly after in case delete fails or is delayed
          setTimeout(async () => {
            try {
              const result = await fetchRequestsForConnection(connectionId, {
                limit: PAGE_SIZE,
                offset: 0,
                searchQuery: debouncedSearchQuery || undefined
              })
              if (!isMountedRef.current) return
              setRequests(result.requests)
              setTotalCount(result.totalCount)
              setHasMore(result.requests.length === PAGE_SIZE)
              setCurrentOffset(PAGE_SIZE)
            } catch (_) {
              // ignore
            }
          }, 800)
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

