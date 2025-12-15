'use client'

import { useState, useCallback, useEffect, useRef, useTransition } from 'react';
import { flushSync } from 'react-dom';
import { toast } from 'sonner';
import RequestsTable from '@/features/requests/RequestsTable';
import { RequestsHeader } from '@/features/requests/RequestsHeader';
import { RequestDetailModal } from '@/features/connections/requests/RequestDetailModal';
import { NewRequestModal } from '@/features/connections/requests/NewRequestModal';
import { fetchRequestByIdGlobal, fetchCommentsForRequestGlobal, fetchRequestsCounts, fetchRequestsForClientStatus, searchClientsWithRequests, fetchAssignedRequestsByClient } from '@/features/requests/actions';
import type { RequestStatus } from '@/features/requests/requestGrouping';
import { fetchProjectsForConnection } from '@/features/connections/requests/actions';
import { ConvertToTaskModal, type ConvertToTaskModalValues } from '@/features/connections/tasks/ConvertToTaskModal';
import { PaywallModal } from '@/components/ui/paywall-modal';
import { runWithPaywallCheck } from '@/lib/tasks-requests-helpers';
import { convertRequestToTask } from '@/features/connections/tasks/actions';
import type { RequestsSnapshot, Request, SearchResults } from '@/features/requests/types';
import type { EnhancedModeContext } from '@/lib/mode/getActiveContext';
import type { Comment } from '@/features/connections/server';

interface RequestsContentProps {
  snapshot: RequestsSnapshot;
  context: EnhancedModeContext;
  initialSearchValue?: string;
  initialComments?: Record<string, Comment[]>;
  agencyMembers?: Array<{
    id: string
    firstName: string
    lastName: string
    email: string
    avatarUrl?: string
    jobTitle?: string
  }>;
  connections?: Array<{
    id: string
    name: string
    logoUrl?: string
  }>;
  newRequestsCount?: number;
  allowedConnectionIds?: string[] | null; // Array of allowed connection IDs (null = no limit for paid plans)
}

export function RequestsContent({ 
  snapshot, 
  context, 
  initialSearchValue = '', 
  initialComments = {},
  agencyMembers = [],
  connections = [],
  newRequestsCount,
  allowedConnectionIds = null
}: RequestsContentProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const parentRef = useRef<HTMLDivElement | null>(null);
  const headerWrapperRef = useRef<HTMLDivElement>(null);
  const [headerOffset, setHeaderOffset] = useState(0);
  // Initialize assigned filter (always start with filter off)
  const [assignedToMe, setAssignedToMe] = useState(false);
  
  // Accordion state: requests cached by client and status
  // Map<`${status}-${clientOrgId}`, Request[]>
  const [requestsByClientStatus, setRequestsByClientStatus] = useState<Map<string, Request[]>>(new Map());
  
  // Loading state for client status fetches
  // Map<`${status}-${clientOrgId}`, boolean>
  const [isLoadingClientStatus, setIsLoadingClientStatus] = useState<Map<string, boolean>>(new Map());
  
  // Refs to track current state for fetch logic (avoid stale closures)
  const requestsByClientStatusRef = useRef<Map<string, Request[]>>(new Map());
  const isLoadingClientStatusRef = useRef<Map<string, boolean>>(new Map());
  
  // Sync refs with state
  useEffect(() => {
    requestsByClientStatusRef.current = requestsByClientStatus;
  }, [requestsByClientStatus]);
  
  useEffect(() => {
    isLoadingClientStatusRef.current = isLoadingClientStatus;
  }, [isLoadingClientStatus]);

  // Minimal metadata for accurate counts
  // Initialize from server-fetched snapshot to prevent flicker
  const [statusCounts, setStatusCounts] = useState<Map<string, number>>(() => {
    const counts = (snapshot as { statusCounts?: Record<string, number> }).statusCounts || {};
    return new Map(Object.entries(counts));
  });
  const [clientCounts, setClientCounts] = useState<Map<string, number>>(() => {
    const counts = (snapshot as { clientCounts?: Record<string, number> }).clientCounts || {};
    return new Map(Object.entries(counts));
  });
  
  // Optimistic new requests count (for agency badge)
  // Initialize from prop, but update optimistically when requests are created/updated
  const [optimisticNewRequestsCount, setOptimisticNewRequestsCount] = useState<number>(newRequestsCount || 0);
  
  // Sync optimistic count with prop when it changes (e.g., on page refresh)
  useEffect(() => {
    if (typeof newRequestsCount === 'number') {
      setOptimisticNewRequestsCount(newRequestsCount);
    }
  }, [newRequestsCount]);
  
  // Ref to track count refresh timeout for debouncing
  const countRefreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Track cache keys that have optimistic data (so we always fetch to replace them)
  const optimisticCacheKeysRef = useRef<Set<string>>(new Set());
  
  // Track tempId → requestId mappings to coordinate optimistic replacement
  const tempIdToRequestIdRef = useRef<Map<string, string>>(new Map());
  
  // Ref to track fetch function to avoid circular dependency
  const fetchRequestsForClientStatusRef = useRef<((status: string, clientOrgId: string) => Promise<void>) | null>(null);

  // Client-side collapse state
  // Status groups: expanded by default (except closed and canceled)
  const [collapsedStatuses, setCollapsedStatuses] = useState<Set<string>>(new Set(['closed', 'canceled']));
  // Client groups: all collapsed by default (empty Map means all are collapsed)
  const [collapsedClients, setCollapsedClients] = useState<Map<string, Set<string>>>(new Map()); // Map<status, Set<clientOrgId>>
  
  // Track if we're currently in search mode (to detect transitions)
  // Initialize based on initialSearchValue to correctly detect transitions
  const wasInSearchModeRef = useRef((initialSearchValue || '').trim().length > 0);
  
  // Track if we're currently in assigned filter mode (to detect transitions)
  const wasInAssignedFilterModeRef = useRef(false);

  // Global state (for search mode and metadata)
  const [unfilteredTotalCount, setUnfilteredTotalCount] = useState(snapshot.unfilteredTotalCount);
  const [allConnectionsMetadata, setAllConnectionsMetadata] = useState<Map<string, { name: string; logoUrl?: string }>>(snapshot.allConnectionsMetadata || new Map());
  // Initialize searchValue from prop only
  const [searchValue, setSearchValue] = useState(initialSearchValue || '');
  const [_debouncedSearchValue, setDebouncedSearchValue] = useState(initialSearchValue || '');
  const [_isLoading, _setIsLoading] = useState(false);
  const [, startTransition] = useTransition();
  
  // Search mode state (server-side search with atomic results)
  const [searchResults, setSearchResults] = useState<SearchResults | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  
  // Assigned filter mode state (server-side filter with atomic results)
  const [assignedFilterResults, setAssignedFilterResults] = useState<SearchResults | null>(null);
  const [isLoadingAssignedFilter, setIsLoadingAssignedFilter] = useState(false);
  
  // Modal state
  const [isRequestDetailModalOpen, setIsRequestDetailModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null);
  const [isNewRequestModalOpen, setIsNewRequestModalOpen] = useState(false);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  const [projectsForConnection, setProjectsForConnection] = useState<Array<{ id: string; name: string }>>([]);
  
  // Convert to task modal state
  const [convertRequest, setConvertRequest] = useState<Request | null>(null);
  const [isConvertModalOpen, setIsConvertModalOpen] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [projectsForConvert, setProjectsForConvert] = useState<Array<{ id: string; name: string }>>([]);
  const [membersForConvert, setMembersForConvert] = useState<Array<{
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    avatarUrl?: string;
    jobTitle?: string;
    orgId?: string;
    orgName?: string;
    orgType?: 'agency' | 'client';
  }>>(agencyMembers);
  
  // Comments map keyed by requestId for instant lookup
  // Initialize with server-fetched comments for instant availability
  const [commentsByRequest, setCommentsByRequest] = useState<Record<string, Comment[]>>(initialComments);
  
  // Paywall modal state
  const [isPaywallModalOpen, setIsPaywallModalOpen] = useState(false);

  // Track if we've initialized counts from server snapshot
  const hasInitializedCountsRef = useRef(false);
  
  // Refresh counts when assignedToMe changes
  // This ensures counts update when filter is toggled, but doesn't cause flicker on initial load
  useEffect(() => {
    // On initial mount, if we have counts from snapshot, skip fetch
    if (!hasInitializedCountsRef.current) {
      hasInitializedCountsRef.current = true;
      // If we already have counts from snapshot, don't fetch again
      if (statusCounts.size > 0 || clientCounts.size > 0) {
        return;
      }
    }
    
    // Fetch counts when assignedToMe filter changes
    fetchRequestsCounts(context, {
      assignedToUserId: assignedToMe && context.variant === 'agency' ? context.user?.id : undefined,
      createdByUserId: assignedToMe && context.variant === 'client' ? context.user?.id : undefined,
    }).then(({ statusCounts: sc, clientCounts: cc }) => {
      setStatusCounts(new Map(Object.entries(sc)));
      setClientCounts(new Map(Object.entries(cc)));
    }).catch(error => {
      console.error('Error fetching requests counts:', error);
    });
  }, [context, assignedToMe, statusCounts.size, clientCounts.size]);

  // Initial load: only set metadata, no requests fetched
  useEffect(() => {
    const hasActiveSearch = searchValue.trim().length > 0;
    
    if (hasActiveSearch) {
      return; // Search mode handled separately
    }
    
    // Accordion mode: only set metadata, no requests
    startTransition(() => {
      setUnfilteredTotalCount(snapshot.unfilteredTotalCount || 0);
      setAllConnectionsMetadata(snapshot.allConnectionsMetadata || new Map());
    });
  }, [snapshot, startTransition, searchValue]);

  // Toggle functions (simple state updates - NO network calls or resets!)
  const toggleStatus = useCallback((status: string) => {
    setCollapsedStatuses(prev => {
      const newSet = new Set(prev);
      if (newSet.has(status)) {
        newSet.delete(status);
      } else {
        newSet.add(status);
      }
      return newSet;
    });
  }, []);

  const toggleClient = useCallback((status: string, clientOrgId: string) => {
    setCollapsedClients(prev => {
      const newMap = new Map(prev);
      const statusSet = newMap.get(status) || new Set();
      const newStatusSet = new Set(statusSet);
      // If client is in Set (collapsed), remove it (expand)
      // If client is NOT in Set (collapsed by default), add it to mark as expanded
      // Actually, with default collapsed, we need to track expanded clients instead
      // For now, let's invert: if in Set, it's expanded; if not, it's collapsed
      if (newStatusSet.has(clientOrgId)) {
        // Currently expanded, collapse it
        newStatusSet.delete(clientOrgId);
      } else {
        // Currently collapsed (default), expand it
        newStatusSet.add(clientOrgId);
      }
      newMap.set(status, newStatusSet);
      return newMap;
    });
  }, []);

  // Fetch requests for a specific client in a specific status (fetch-on-expand)
  const handleFetchRequestsForClientStatus = useCallback(async (status: string, clientOrgId: string, showLoadingSkeleton: boolean = true, forceFetch: boolean = false) => {
    const cacheKey = `${status}-${clientOrgId}`;
    
    // Check if already loading using ref
    if (isLoadingClientStatusRef.current.get(cacheKey)) {
      return; // Already fetching, don't duplicate
    }
    
    // CRITICAL: If this cache key has optimistic data, ALWAYS fetch to replace it with server data
    const hasOptimisticData = optimisticCacheKeysRef.current.has(cacheKey);
    
    // Check if we have complete cached data
    const cachedRequests = requestsByClientStatusRef.current.get(cacheKey);
    const expectedCount = clientCounts.get(cacheKey) || 0;
    const hasCompleteCache = cachedRequests && cachedRequests.length === expectedCount && expectedCount > 0;
    
    // If forceFetch is true (search mode), skip cache checks and always fetch
    if (!forceFetch) {
      if (!hasOptimisticData && hasCompleteCache) {
        // No optimistic data and cache is complete - no need to fetch
        return;
      }
    }
    
    // Always show skeleton if forceFetch is true, otherwise show based on cache state
    const shouldShowSkeleton = forceFetch || (showLoadingSkeleton && !hasCompleteCache);
    
    // Set loading state (only if we should show skeleton)
    if (shouldShowSkeleton) {
      setIsLoadingClientStatus(prev => {
        const newMap = new Map(prev);
        newMap.set(cacheKey, true);
        return newMap;
      });
    }
    
    try {
      const requests = await fetchRequestsForClientStatus(context, clientOrgId, status as RequestStatus, {
        assignedToUserId: assignedToMe && context.variant === 'agency' ? context.user?.id : undefined,
        createdByUserId: assignedToMe && context.variant === 'client' ? context.user?.id : undefined,
      });
      
      // Track merged count for count updates
      let mergedCount = 0;
      
      // CRITICAL: Capture hasOptimistic BEFORE merge callback (merge might clear it)
      // This ensures we can preserve optimistic count even if merge clears the flag
      const hadOptimisticBeforeMerge = optimisticCacheKeysRef.current.has(cacheKey);
      
      // Merge server data with optimistic requests - preserve optimistic until replaced by real data
      setRequestsByClientStatus(prev => {
        const newMap = new Map(prev);
        
        // CRITICAL: If we have optimistic data, ALWAYS read from ref first (before checking prev)
        // This ensures we get the optimistic item even if prev doesn't have it yet (collapsed client auto-expand)
        // The ref is synced synchronously in flushSync, so it should always have the latest data
        const hasOptimisticData = optimisticCacheKeysRef.current.has(cacheKey);
        let existingRequests = newMap.get(cacheKey);
        
        if (hasOptimisticData) {
          // Always try to read from ref when optimistic data exists
          const refRequests = requestsByClientStatusRef.current.get(cacheKey);
          if (refRequests && refRequests.length > 0) {
            // Ref has data - use it (this is the source of truth for optimistic items)
            existingRequests = refRequests;
            // Update newMap to include ref data so merge works correctly
            newMap.set(cacheKey, existingRequests);
          } else if (!existingRequests || existingRequests.length === 0) {
            // Ref doesn't have it but optimistic data exists - this shouldn't happen
            // But if it does, we need to preserve the optimistic count, so keep existingRequests as undefined
            // This will be handled in the count update logic
            if (process.env.NODE_ENV !== 'production') {
              console.warn('Optimistic data exists but not found in ref or prev for cacheKey:', cacheKey);
            }
          }
        }
        
        // Fallback to empty array if still no data (only if no optimistic data exists)
        if (!existingRequests) {
          existingRequests = [];
        }
        
        // Create a set of server request IDs for deduplication
        const serverRequestIds = new Set(requests.map(r => r.id));
        
        // Find optimistic requests (tempId) - these should persist until replaced
        const optimisticRequests = existingRequests.filter(r => r.id.startsWith('temp-'));
        
        // Find requests that were added by handleRequestCreated (real requestId, not in server response yet)
        // These are requests that exist in cache but not in server response (race condition)
        const cacheOnlyRequests = existingRequests.filter(r => 
          !r.id.startsWith('temp-') && !serverRequestIds.has(r.id)
        );
        
        // Check which optimistic requests have been replaced via tempId → requestId mapping
        const replacedTempIds = new Set<string>();
        for (const [tempId, requestId] of tempIdToRequestIdRef.current.entries()) {
          // Check if the replacement request exists in server response or cache
          if (serverRequestIds.has(requestId) || existingRequests.some(r => r.id === requestId)) {
            replacedTempIds.add(tempId);
          }
        }
        
        // Match optimistic requests to server requests by connectionId + title
        // If server has a matching request, the optimistic one should be removed (replaced)
        const serverRequestKeys = new Set(
          requests.map(r => `${r.connectionId}:${r.title}`)
        );
        
        // Create a set of cache-only request keys for matching
        const cacheOnlyRequestKeys = new Set(
          cacheOnlyRequests.map(r => `${r.connectionId}:${r.title}`)
        );
        
        // Preserve optimistic requests that don't have a matching server request yet
        // BUT also check if handleRequestCreated already replaced them with real requests
        const preservedOptimistic = optimisticRequests.filter(optReq => {
          // CRITICAL: If this tempId has been replaced via mapping, don't preserve it
          if (replacedTempIds.has(optReq.id)) {
            return false;
          }
          
          // CRITICAL: Check if there's a cache-only replacement (handleRequestCreated already ran)
          // This is the ONLY other way we should remove optimistic requests
          const optKey = `${optReq.connectionId}:${optReq.title}`;
          const hasCacheOnlyReplacement = cacheOnlyRequestKeys.has(optKey);
          
          // Keep if: no cache-only replacement yet (meaning handleRequestCreated hasn't run yet)
          // DO NOT check server match - that could be a different request created at the same time
          return !hasCacheOnlyReplacement;
        });
        
        // Ensure replaced requests are included in merged result
        // Find the real requests that replaced optimistic ones
        const replacedRequests = Array.from(replacedTempIds)
          .map(tempId => {
            const requestId = tempIdToRequestIdRef.current.get(tempId);
            if (!requestId) return null;
            // Find the real request from server response, cache-only requests, or existing requests
            return requests.find(r => r.id === requestId) || 
                   cacheOnlyRequests.find(r => r.id === requestId) ||
                   existingRequests.find(r => r.id === requestId);
          })
          .filter((r): r is Request => r !== null);
        
        // CRITICAL: Only preserve cache-only requests that are tracked in tempId mapping
        // This ensures we only keep legitimate requests from handleRequestCreated, not stale/deleted ones
        // If a request isn't in the server response AND isn't tracked in the mapping, it's stale and should be removed
        const trackedRequestIds = new Set(Array.from(tempIdToRequestIdRef.current.values()));
        const preservedCacheOnly = cacheOnlyRequests.filter(cacheReq => 
          trackedRequestIds.has(cacheReq.id)
        );
        
        // Combine: server requests + replaced requests + preserved cache-only + preserved optimistic
        // Server requests are already sorted by createdAt DESC from the server
        const merged = [...requests, ...replacedRequests, ...preservedCacheOnly, ...preservedOptimistic];
        
        // Deduplicate by requestId (in case server response includes requests that were added by handleRequestCreated)
        const deduplicated = Array.from(
          new Map(merged.map(r => [r.id, r])).values()
        );
        
        // Sort merged list by createdAt DESC to maintain order (newest first)
        deduplicated.sort((a, b) => {
          const aTime = new Date(a.createdAt).getTime();
          const bTime = new Date(b.createdAt).getTime();
          return bTime - aTime; // Descending (newest first)
        });
        
        newMap.set(cacheKey, deduplicated);
        
        // Clean up tempId mappings for requests now in server response
        for (const [tempId, requestId] of tempIdToRequestIdRef.current.entries()) {
          if (serverRequestIds.has(requestId)) {
            tempIdToRequestIdRef.current.delete(tempId);
          }
        }
        
        // Only remove from optimistic tracking if all optimistic requests have been replaced
        const stillHasOptimistic = deduplicated.some(r => r.id.startsWith('temp-'));
        if (!stillHasOptimistic) {
          optimisticCacheKeysRef.current.delete(cacheKey);
        }
        
        // Store merged count for count updates outside this callback
        mergedCount = deduplicated.length;
        
        return newMap;
      });
      
      // Update counts to reflect merged state
      // CRITICAL: Optimistic counts MUST persist until server confirms
      // If optimistic data existed before merge, NEVER update count to 0 - only update if mergedCount > 0
      setClientCounts(prev => {
        const newMap = new Map(prev);
        const currentClientCount = newMap.get(cacheKey) || 0;
        
        // If we had optimistic data before merge, preserve the count unless mergedCount is > 0
        // This ensures optimistic count persists until server data confirms it
        // (We check hadOptimisticBeforeMerge because merge callback might have cleared the flag)
        if (hadOptimisticBeforeMerge && mergedCount === 0 && currentClientCount > 0) {
          // Optimistic count exists - preserve it, don't update to 0
          return newMap;
        }
        
        // Update client count if merged count differs
        // mergedCount includes optimistic items if they were preserved in the merge
        if (mergedCount !== currentClientCount) {
          newMap.set(cacheKey, mergedCount);
          
          // Recalculate status count by summing all client counts for this status
          // This ensures statusCounts always matches sum of clientCounts
          const statusPrefix = `${status}-`;
          let statusTotal = 0;
          for (const [key, count] of newMap.entries()) {
            if (key.startsWith(statusPrefix)) {
              statusTotal += count;
            }
          }
          
          // Update status count atomically
          setStatusCounts(prevStatus => {
            const newStatusMap = new Map(prevStatus);
            newStatusMap.set(status, statusTotal);
            return newStatusMap;
          });
        }
        
        return newMap;
      });
    } catch (error) {
      console.error('Error fetching requests for client status:', error);
    } finally {
      // Clear loading state (only if we set it)
      if (shouldShowSkeleton) {
        setIsLoadingClientStatus(prev => {
          const newMap = new Map(prev);
          newMap.delete(cacheKey);
          return newMap;
        });
      }
    }
  }, [context, assignedToMe, clientCounts]);

  // Sync the fetch function ref so it can be called from other callbacks
  useEffect(() => {
    fetchRequestsForClientStatusRef.current = handleFetchRequestsForClientStatus;
  }, [handleFetchRequestsForClientStatus]);

  // Wrapper callback for RequestsTable that bridges the signature difference
  // RequestsTable calls: (status, clientOrgId, forceFetch?)
  // handleFetchRequestsForClientStatus expects: (status, clientOrgId, showLoadingSkeleton, forceFetch)
  const handleFetchClientRequestsWrapper = useCallback((
    status: string, 
    clientOrgId: string, 
    forceFetch?: boolean
  ) => {
    handleFetchRequestsForClientStatus(status, clientOrgId, true, forceFetch || false);
  }, [handleFetchRequestsForClientStatus]);

  // Sync comments when initialComments prop changes (when snapshot changes, page re-fetches comments)
  useEffect(() => {
    setCommentsByRequest(prev => ({
      ...prev,
      ...initialComments
    }));
  }, [initialComments]);

  // Debounce server fetch (150ms - reduced from 300ms for faster response)
  // Note: debouncedSearchValue is only used for server search debouncing, not URL updates
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchValue(searchValue);
    }, 150);

    return () => clearTimeout(timer);
  }, [searchValue]);

  // Server-side search effect (triggers on any non-empty search)
  useEffect(() => {
    const trimmedSearch = searchValue.trim();
    const wasInSearchMode = wasInSearchModeRef.current;
    
    // Only clear search results if search is completely empty
    if (trimmedSearch.length === 0) {
      // Transition to browse mode - preserve cache, no skeleton
      setSearchResults(null);
      setIsSearching(false); // Explicitly set to false, don't show skeleton
      
      // CRITICAL: Only reset collapse state if we're transitioning FROM search mode TO browse mode
      // If we're already in browse mode (wasInSearchMode = false), preserve existing collapse state
      // This prevents collapsing clients that were expanded by request creation/updates
      if (wasInSearchMode) {
        // Transitioning from search → browse: reset to default collapse state
        setCollapsedStatuses(new Set(['closed', 'canceled']));
        setCollapsedClients(new Map()); // Empty map = all clients collapsed
      }
      // If wasInSearchMode = false, we're already in browse mode - preserve collapse state
      
      // Update ref for next comparison
      wasInSearchModeRef.current = false;
      
      // Scroll to top when clearing search
      window.scrollTo({ top: 0, behavior: 'smooth' });
      
      // DO NOT clear requestsByClientStatus - preserve browse mode cache
      // The table will automatically switch to browse mode when searchResults is null
      
      return;
    }
    
    // Update ref: we're entering/remaining in search mode
    wasInSearchModeRef.current = true;

    // Perform server-side search (even for 1 char - let server handle it)
    const performSearch = async () => {
      try {
        const results = await searchClientsWithRequests(context, trimmedSearch, {
          assignedToUserId: assignedToMe && context.variant === 'agency' ? context.user?.id : undefined,
          createdByUserId: assignedToMe && context.variant === 'client' ? context.user?.id : undefined,
        });
        setSearchResults(results);
        
        // Expand all status headers (empty set = all expanded)
        setCollapsedStatuses(new Set());
        
        // Expand all client headers (add all clients to expanded sets)
        const statusOrder = ['new', 'in_review', 'accepted', 'closed', 'canceled'];
        const newCollapsedClients = new Map<string, Set<string>>();
        
        statusOrder.forEach(status => {
          const clientsInStatus = results.clients.filter(client => 
            client.requests.some(req => req.status === status)
          );
          
          if (clientsInStatus.length > 0) {
            const expandedSet = new Set<string>();
            clientsInStatus.forEach(client => {
              expandedSet.add(client.client_id);
            });
            newCollapsedClients.set(status, expandedSet);
          }
        });
        
        setCollapsedClients(newCollapsedClients);
      } catch (error) {
        console.error('Error searching clients with requests:', error);
        setSearchResults({ clients: [], totalClients: 0 });
      } finally {
        setIsSearching(false);
      }
    };

    // Set searching state IMMEDIATELY when user types (before debounce)
    // This ensures skeleton shows instantly, not after 300ms delay
    setIsSearching(true);
    // Clear previous results immediately to show skeleton
    setSearchResults(null);
    
    // Scroll to top when starting a new search
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Debounce search to avoid excessive calls (300ms)
    const searchTimer = setTimeout(performSearch, 300);
    return () => {
      clearTimeout(searchTimer);
      // Cancel in-flight requests if search changes
    };
  }, [searchValue, context, assignedToMe]);

  // Assigned filter effect - ONLY reacts to assignedToMe changes
  useEffect(() => {
    const wasInAssignedFilterMode = wasInAssignedFilterModeRef.current;
    
    if (!assignedToMe) {
      // Turn OFF - transition to browse mode
      setIsLoadingAssignedFilter(true);
      setAssignedFilterResults(null);
      // DO NOT clear requestsByClientStatus - preserve browse cache
      
      // CRITICAL: Only reset collapse state if we're transitioning FROM assigned filter mode TO browse mode
      // If we're already in browse mode (wasInAssignedFilterMode = false), preserve existing collapse state
      // This prevents collapsing clients that were expanded by request creation/updates
      if (wasInAssignedFilterMode) {
        // Transitioning from assigned filter → browse: reset to default collapse state
        setCollapsedStatuses(new Set(['closed', 'canceled']));
        setCollapsedClients(new Map()); // Empty map = all clients collapsed
      }
      // If wasInAssignedFilterMode = false, we're already in browse mode - preserve collapse state
      
      // Update ref for next comparison
      wasInAssignedFilterModeRef.current = false;
      
      // Scroll to top when turning off filter
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setTimeout(() => setIsLoadingAssignedFilter(false), 200);
      return;
    }
    
    // Update ref: we're entering/remaining in assigned filter mode
    wasInAssignedFilterModeRef.current = true;

    const performAssignedFilter = async () => {
      try {
        const results = await fetchAssignedRequestsByClient(context);
        setAssignedFilterResults(results);
        
        // Expand all status headers (empty set = all expanded)
        setCollapsedStatuses(new Set());
        
        // Expand all client headers (add all clients to expanded sets)
        const statusOrder = ['new', 'in_review', 'accepted', 'closed', 'canceled'];
        const newCollapsedClients = new Map<string, Set<string>>();
        
        statusOrder.forEach(status => {
          const clientsInStatus = results.clients.filter(client => 
            client.requests.some(req => req.status === status)
          );
          
          if (clientsInStatus.length > 0) {
            const expandedSet = new Set<string>();
            clientsInStatus.forEach(client => {
              expandedSet.add(client.client_id);
            });
            newCollapsedClients.set(status, expandedSet);
          }
        });
        
        setCollapsedClients(newCollapsedClients);
      } catch (error) {
        console.error('Error fetching assigned requests by client:', error);
        setAssignedFilterResults({ clients: [], totalClients: 0 });
      } finally {
        setIsLoadingAssignedFilter(false);
      }
    };

    // Show skeleton and scroll to top
    setIsLoadingAssignedFilter(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    performAssignedFilter();
  }, [assignedToMe, context]);

  // Client-side search: No server-side queries needed
  // Search is handled by filtering allConnectionsMetadata client-side in RequestsTable

  // Always use accordion mode - no search mode
  const _displayedTotal = unfilteredTotalCount;

  // Track header height for sticky table offset
  useEffect(() => {
    if (!headerWrapperRef.current) return;
    const node = headerWrapperRef.current;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setHeaderOffset(entry.contentRect.height);
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // No load more needed - client-side search uses accordion mode

  const handleSearchChange = useCallback((value: string) => {
    setSearchValue(value); // UI updates immediately
  }, []);

  const handleNewRequest = useCallback(() => {
    setIsNewRequestModalOpen(true);
  }, []);

  const handleNewRequestModalClose = useCallback(() => {
    setIsNewRequestModalOpen(false);
    setSelectedConnectionId(null);
    setProjectsForConnection([]);
  }, []);

  const handleConnectionSelect = useCallback(async (connectionId: string) => {
    setSelectedConnectionId(connectionId);
    // Fetch projects for the selected connection
    try {
      const projects = await fetchProjectsForConnection(connectionId);
      setProjectsForConnection(projects);
    } catch (error) {
      console.error('Error fetching projects:', error);
      setProjectsForConnection([]);
    }
  }, []);

  const handleRequestOptimistic = useCallback((payload: {
    tempId: string
    title: string
    description: string
    projectId: string | null
    projectName?: string | null
    assigneeUserId: string | null
    connectionId: string
  }) => {
    // Use connectionId from payload instead of state (state gets cleared when modal closes)
    const targetConnectionId = payload.connectionId
    if (!targetConnectionId) return;
    
    // Find the selected connection using payload connectionId
    const selectedConnection = connections.find(c => c.id === targetConnectionId);
    if (!selectedConnection) return;

    // Find an existing request for this connection to reuse its client/agency structure
    // This ensures we use the exact same client ID that the server uses, preventing duplicate subgroups
    // Search in cached accordion state
    let existingRequest: Request | undefined;
    for (const requests of requestsByClientStatus.values()) {
      existingRequest = requests.find(r => r.connectionId === targetConnectionId);
      if (existingRequest) break;
    }
    
    // Determine client and agency based on variant
    // Agency view: selectedConnection is a client, current org is agency
    // Client view: selectedConnection is an agency, current org is client
    const isAgency = context.variant === 'agency';
    
    // Look up the orgId from allConnectionsMetadata by matching name/logoUrl
    // This is needed because connections array doesn't include orgId, but cache keys use orgId
    let partnerOrgId: string | undefined;
    for (const [orgId, metadata] of allConnectionsMetadata.entries()) {
      if (metadata.name === selectedConnection.name && 
          (metadata.logoUrl || undefined) === (selectedConnection.logoUrl || undefined)) {
        partnerOrgId = orgId;
        break;
      }
    }
    
    // If we couldn't find orgId from metadata, fall back to using connectionId (shouldn't happen)
    // But this will cause cache key mismatch, so we log a warning
    if (!partnerOrgId) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('Could not find orgId for connection:', targetConnectionId, 'Falling back to connectionId');
      }
      partnerOrgId = targetConnectionId;
    }
    
    // Create optimistic request
    // Use ISO timestamp for proper sorting (will be formatted for display in RequestRow)
    const now = new Date();
    
    // Reuse client/agency from existing request if available to ensure exact ID match
    // Otherwise construct from connection/context using the correct orgId
    const client = existingRequest?.client || (isAgency 
      ? {
          id: partnerOrgId, // Use orgId, not connectionId
          name: selectedConnection.name,
          logoUrl: selectedConnection.logoUrl,
        }
      : {
          id: context.organization.id,
          name: context.organization.name || '',
          logoUrl: context.organization.logoUrl,
        });
    
    const agency = existingRequest?.agency || (isAgency
      ? {
          id: context.organization.id,
          name: context.organization.name || '',
          logoUrl: context.organization.logoUrl,
        }
      : {
          id: partnerOrgId, // Use orgId, not connectionId
          name: selectedConnection.name,
          logoUrl: selectedConnection.logoUrl,
        });
    
    const optimisticRequest: Request = {
      id: payload.tempId,
      connectionId: targetConnectionId,
      title: payload.title,
      description: payload.description,
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
      client,
      agency,
      createdAt: now.toISOString(), // Use ISO timestamp for proper sorting (newest first)
      createdByOrgId: context.organization.id,
      createdByOrgType: context.variant,
    };

    // Add to accordion cache (optimistic request is always 'new')
    // Determine client org ID for cache key
    const clientOrgId = isAgency ? optimisticRequest.client.id : (optimisticRequest.agency?.id || '');
    const cacheKey = `new-${clientOrgId}`;
    
    // FORCE IMMEDIATE SYNCHRONOUS UPDATES - no batching, render NOW
    flushSync(() => {
      // ALWAYS optimistically add the new request IMMEDIATELY (users need to see it instantly)
      setRequestsByClientStatus(prev => {
        const newMap = new Map(prev);
        const existingRequests = newMap.get(cacheKey) || [];
        // Check if request already exists (avoid duplicates)
        if (!existingRequests.some(r => r.id === payload.tempId)) {
          newMap.set(cacheKey, [optimisticRequest, ...existingRequests]);
          // Mark as optimistic so fetch replaces it with complete server data
          optimisticCacheKeysRef.current.add(cacheKey);
        }
        // CRITICAL: Sync ref synchronously so fetch callback can read it
        requestsByClientStatusRef.current = newMap;
        return newMap;
      });
      
      // IMMEDIATELY expand the client group (no checks, just expand it NOW)
      setCollapsedClients(prev => {
        const newMap = new Map(prev);
        const statusSet = newMap.get('new') || new Set();
        const newStatusSet = new Set(statusSet);
        // Add clientOrgId to mark as expanded
        newStatusSet.add(clientOrgId);
        newMap.set('new', newStatusSet);
        return newMap;
      });
      
      // IMMEDIATELY ensure the status group is expanded
      setCollapsedStatuses(prev => {
        const newSet = new Set(prev);
        newSet.delete('new');
        return newSet;
      });
      
      // Move count updates INSIDE flushSync for instant updates
      setUnfilteredTotalCount(prev => prev + 1);
      // Update status counts optimistically
      setStatusCounts(prev => {
        const newMap = new Map(prev);
        const currentCount = newMap.get('new') || 0;
        newMap.set('new', currentCount + 1);
        return newMap;
      });
      // Update client counts optimistically
      setClientCounts(prev => {
        const newMap = new Map(prev);
        const currentCount = newMap.get(cacheKey) || 0;
        newMap.set(cacheKey, currentCount + 1);
        return newMap;
      });
      // Update new requests count optimistically (for agency badge)
      if (isAgency) {
        setOptimisticNewRequestsCount(prev => prev + 1);
      }
    });
    
    // Always trigger fetch to replace optimistic request with server data
    // Always show skeleton while loading (even if we have optimistic data)
    // This ensures user sees skeleton below optimistic request while server data loads
    handleFetchRequestsForClientStatus('new', clientOrgId, true);
  }, [connections, context, allConnectionsMetadata, handleFetchRequestsForClientStatus, requestsByClientStatus]);

  const handleRequestCreated = useCallback(async ({ requestId, tempId, connectionId }: { requestId: string; tempId?: string; connectionId?: string }) => {
    // Use connectionId from payload, fallback to selectedConnectionId for backward compatibility
    const targetConnectionId = connectionId || selectedConnectionId
    if (!targetConnectionId) return;
    
    try {
      // Use connectionId directly and skip cache for immediate post-insert fetch
      const request = await fetchRequestByIdGlobal(requestId, context, targetConnectionId, true);
      if (!request) {
        console.error('Failed to fetch newly created request');
        return;
      }
      
      // Determine client org ID for cache key
      const clientOrgId = context.variant === 'agency' ? request.client.id : (request.agency?.id || '');
      const cacheKey = `${request.status}-${clientOrgId}`;
      
      // Record the tempId → requestId mapping to coordinate with fetch merge
      if (tempId) {
        tempIdToRequestIdRef.current.set(tempId, requestId);
      }
      
      // Check if the target client group is expanded
      const isNewStatusClientExpanded = collapsedClients.get(request.status)?.has(clientOrgId) || false;
      
      // Auto-expand the client group if it's collapsed (so user can see where the request was added)
      if (!isNewStatusClientExpanded) {
        setCollapsedClients(prev => {
          const newMap = new Map(prev);
          const statusSet = newMap.get(request.status) || new Set();
          const newStatusSet = new Set(statusSet);
          // Add clientOrgId to mark as expanded
          newStatusSet.add(clientOrgId);
          newMap.set(request.status, newStatusSet);
          return newMap;
        });
        
        // Also ensure the status group is expanded
        setCollapsedStatuses(prev => {
          const newSet = new Set(prev);
          newSet.delete(request.status);
          return newSet;
        });
      }
      
      // Replace temp request with real request (fetch is already in progress from optimistic step)
      // The fetch that started in handleRequestOptimistic will merge this with complete server data
      setRequestsByClientStatus(prev => {
        const newMap = new Map(prev);
        const existingRequests = newMap.get(cacheKey) || [];
        
        // Always ensure real request exists, even if fetch merge already added it
        const hasRealRequest = existingRequests.some(r => r.id === request.id);
        
        // Remove temp request and any duplicate real request
        const without = existingRequests.filter(r => r.id !== tempId && r.id !== request.id);
        
        // If real request already exists, just remove temp (don't add duplicate or overwrite)
        // Otherwise, replace temp with real request at the top
        if (hasRealRequest) {
          // Real request already in cache (from fetch merge), just remove temp
          newMap.set(cacheKey, without);
        } else {
          // Replace temp with real request at the top
          newMap.set(cacheKey, [request, ...without]);
        }
        
        // CRITICAL: Sync ref synchronously so fetch callback can read the real request
        // This ensures when fetch merge runs, it sees the real request instead of temp
        requestsByClientStatusRef.current = newMap;
        
        // Keep optimistic marker - the in-progress fetch will replace with complete data
        optimisticCacheKeysRef.current.add(cacheKey);
        return newMap;
      });
      
      // Note: Fetch was already triggered in handleRequestOptimistic, so we don't need to fetch again here
      // The in-progress fetch will merge the real request with complete server data when it completes
      
      // Update selectedRequest if it matches tempId (using functional update to avoid stale closure)
      if (tempId) {
        setSelectedRequest(prev => {
          if (prev?.id === tempId) {
            return request;
          }
          return prev;
        });
      }
      
      // Fetch comments for the new request
      try {
        const comments = await fetchCommentsForRequestGlobal(requestId);
        // Update comments map for the new request
        setCommentsByRequest(prev => ({
          ...prev,
          [requestId]: comments
        }));
      } catch (error) {
        console.error('Error fetching comments:', error);
      }
    } catch (error) {
      console.error('Failed to fetch newly created request:', error);
      // If request creation failed, remove from mapping
      if (tempId) {
        tempIdToRequestIdRef.current.delete(tempId);
      }
    }
  }, [selectedConnectionId, context, collapsedClients]);

  // Helper to find request in cached accordion state or search results
  const findRequestInCache = useCallback((requestId: string): Request | null => {
    // Check accordion cache (requestsByClientStatus)
    for (const requests of requestsByClientStatus.values()) {
      const found = requests.find(r => r.id === requestId);
      if (found) return found;
    }
    
    return null;
  }, [requestsByClientStatus]);

  const handleRequestClick = useCallback(async (requestId: string) => {
    // Try to get request from local state first
    const localRequest = findRequestInCache(requestId);
    
    if (!localRequest) {
      // If not in local state, fetch from server (will trigger paywall check)
      await runWithPaywallCheck(
        async () => {
          const request = await fetchRequestByIdGlobal(requestId, context);
          if (!request) {
            throw new Error('Request not found');
          }
          return request;
        },
        (request) => {
          setSelectedRequest(request);
          setIsRequestDetailModalOpen(true);
          
          // Use prefetched comments if available, otherwise fetch
          if (commentsByRequest[requestId]) {
            // Comments already available, no need to fetch
          } else {
            // Fetch comments if not prefetched
            fetchCommentsForRequestGlobal(requestId).then(comments => {
              setCommentsByRequest(prev => ({
                ...prev,
                [requestId]: comments
              }));
            }).catch(error => {
              console.error('Error fetching comments:', error);
            });
          }
        },
        () => {
          setIsPaywallModalOpen(true);
        }
      );
      return;
    }

    // Check paywall client-side using prefetched allowedConnectionIds
    const billingStatus = context.organization.billing_status || 'free';
    if (context.variant === 'agency' && billingStatus === 'free' && allowedConnectionIds != null) {
      if (!allowedConnectionIds.includes(localRequest.connectionId)) {
        // Restricted connection - show paywall immediately
        setIsPaywallModalOpen(true);
        return;
      }
    }

    // Allowed - open modal instantly with local data
    setSelectedRequest(localRequest);
    setIsRequestDetailModalOpen(true);
    
    // Use prefetched comments if available, otherwise fetch
    if (commentsByRequest[requestId]) {
      // Comments already available, no need to fetch
    } else {
      // Fetch comments if not prefetched
      fetchCommentsForRequestGlobal(requestId).then(comments => {
        setCommentsByRequest(prev => ({
          ...prev,
          [requestId]: comments
        }));
      }).catch(error => {
        console.error('Error fetching comments:', error);
      });
    }
  }, [findRequestInCache, context, commentsByRequest, allowedConnectionIds]);
  
  const handleRequestDetailModalClose = useCallback(() => {
    setIsRequestDetailModalOpen(false);
    // Allow modal exit animation before clearing data
    setTimeout(() => {
      setSelectedRequest(null);
    }, 300);
  }, []);
  
  const handleExpandRequest = useCallback(() => {
    if (selectedRequest && selectedRequest.connectionId) {
      // Check if this is a tempId (starts with 'temp-')
      // If so, prevent navigation and show a message
      if (selectedRequest.id.startsWith('temp-')) {
        toast.error('Please wait for the request to finish creating');
        return;
      }
      
      // Determine baseRoute based on context variant
      // Agencies view clients, clients view agencies
      const baseRoute = context.variant === 'agency' ? 'clients' : 'agencies';
      const url = `/${baseRoute}/${selectedRequest.connectionId}/requests/${selectedRequest.id}`;
      window.location.href = url;
    }
  }, [selectedRequest, context.variant]);

  const handleRequestUpdate = useCallback((requestId: string, updates: { title?: string; description?: string; status?: 'new' | 'in_review' | 'accepted' | 'canceled' | 'closed'; assignee?: Request['assignee']; project?: { id: string; name: string } | null }) => {
    // Optimistic update - update in accordion cache
    // If status changed, move request to new cache key
    const oldRequest = findRequestInCache(requestId);
    if (oldRequest && updates.status && updates.status !== oldRequest.status) {
      // Status changed - remove from old cache key, add to new
      const oldClientOrgId = context.variant === 'agency' ? oldRequest.client.id : (oldRequest.agency?.id || '');
      const oldCacheKey = `${oldRequest.status}-${oldClientOrgId}`;
      const newClientOrgId = context.variant === 'agency' ? oldRequest.client.id : (oldRequest.agency?.id || '');
      const newCacheKey = `${updates.status}-${newClientOrgId}`;
      
      // Optimistically update status counts
      const newStatus = updates.status; // Already checked above that updates.status exists
      if (newStatus) {
        setStatusCounts(prev => {
          const newMap = new Map(prev);
          const oldCount = newMap.get(oldRequest.status) || 0;
          const newCount = newMap.get(newStatus) || 0;
          newMap.set(oldRequest.status, Math.max(0, oldCount - 1));
          newMap.set(newStatus, newCount + 1);
          return newMap;
        });
        // Update new requests count optimistically (for agency badge)
        // Decrement if status changed FROM 'new' to something else
        // Increment if status changed TO 'new' from something else
        if (context.variant === 'agency') {
          if (oldRequest.status === 'new' && newStatus !== 'new') {
            setOptimisticNewRequestsCount(prev => Math.max(0, prev - 1));
          } else if (oldRequest.status !== 'new' && newStatus === 'new') {
            setOptimisticNewRequestsCount(prev => prev + 1);
          }
        }
      }
      
      // Optimistically update client counts for OLD cache key (decrement)
      // DO NOT optimistically update NEW cache key - let server provide accurate count
      // This ensures fetch logic detects incomplete data and fetches fresh
      setClientCounts(prev => {
        const newMap = new Map(prev);
        const oldClientCount = newMap.get(oldCacheKey) || 0;
        newMap.set(oldCacheKey, Math.max(0, oldClientCount - 1));
        // Don't update newCacheKey - server will provide accurate count
        return newMap;
      });
      
      // Check expansion states and cached data
      const isOldStatusClientExpanded = collapsedClients.get(oldRequest.status)?.has(oldClientOrgId) || false;
      const isNewStatusClientExpanded = collapsedClients.get(newStatus)?.has(newClientOrgId) || false;
      
      // Get current cache state
      const _oldRequests = requestsByClientStatus.get(oldCacheKey) || [];
      const newRequests = requestsByClientStatus.get(newCacheKey) || [];
      const hasNewCacheData = newRequests.length > 0;
      
      // Update accordion cache (move request to new status)
      setRequestsByClientStatus(prev => {
        const newMap = new Map(prev);
        
        // Always remove from old cache if that client group is expanded (user can see it)
        if (isOldStatusClientExpanded) {
          const oldCachedRequests = newMap.get(oldCacheKey) || [];
          newMap.set(oldCacheKey, oldCachedRequests.filter(r => r.id !== requestId));
        }
        
        // Only optimistically add to new cache if:
        // 1. The new client group is expanded (user can see it)
        // 2. We have cached data for that client group (so it appears alongside existing requests)
        // If the client group is collapsed OR we don't have cached data, don't add optimistically
        // (it will be loaded when the user expands and fetches)
        if (isNewStatusClientExpanded && hasNewCacheData) {
          // Check if request already exists (avoid duplicates)
          if (!newRequests.some(r => r.id === requestId)) {
            newMap.set(newCacheKey, [{ ...oldRequest, ...updates }, ...newRequests]);
            // Mark as optimistic so fetch replaces it with complete server data
            optimisticCacheKeysRef.current.add(newCacheKey);
          }
        }
        
        return newMap;
      });
      
      // Fetch fresh counts from server to merge (debounced to avoid too many requests)
      // Clear any pending refresh
      if (countRefreshTimeoutRef.current) {
        clearTimeout(countRefreshTimeoutRef.current);
      }
      
      // Schedule refresh after debounce delay
      countRefreshTimeoutRef.current = setTimeout(() => {
        fetchRequestsCounts(context, {
          assignedToUserId: assignedToMe && context.variant === 'agency' ? context.user?.id : undefined,
          createdByUserId: assignedToMe && context.variant === 'client' ? context.user?.id : undefined,
        }).then(({ statusCounts: sc, clientCounts: cc }) => {
          // Merge server counts (server is source of truth)
          setStatusCounts(prev => {
            const newMap = new Map(prev);
            Object.entries(sc).forEach(([status, count]) => {
              newMap.set(status, count);
            });
            return newMap;
          });
          setClientCounts(prev => {
            const newMap = new Map(prev);
            Object.entries(cc).forEach(([key, count]) => {
              newMap.set(key, count);
            });
            return newMap;
          });
          
          // If the new status's client group is expanded, refresh requests to merge with server
          // This ensures optimistic data is replaced with complete server data
          if (isNewStatusClientExpanded && fetchRequestsForClientStatusRef.current) {
            // Fetch fresh data from server (fetch logic will detect optimistic data and fetch)
            fetchRequestsForClientStatusRef.current(newStatus, newClientOrgId);
          }
        }).catch(error => {
          console.error('Error refreshing counts after status update:', error);
        });
        countRefreshTimeoutRef.current = null;
      }, 500); // Debounce: wait 500ms after last status change
    } else {
      // Same status - update in place
      setRequestsByClientStatus(prev => {
        const newMap = new Map(prev);
        for (const [key, requests] of newMap.entries()) {
          const updated = requests.map(r => r.id === requestId ? { ...r, ...updates } : r);
          if (updated.some(r => r.id === requestId)) {
            newMap.set(key, updated);
            break;
          }
        }
        return newMap;
      });
    }
    
    // Also update selectedRequest if it's the current one
    if (selectedRequest && selectedRequest.id === requestId) {
      setSelectedRequest(prev => prev ? { ...prev, ...updates } : null);
    }
  }, [selectedRequest, findRequestInCache, context, assignedToMe, collapsedClients, requestsByClientStatus]);

  const handleRequestDeleted = useCallback(async (requestId: string) => {
    // Find request in cache
    const deletedRequest = findRequestInCache(requestId);
    
    // Optimistically remove request from accordion cache
    if (deletedRequest) {
      const clientOrgId = context.variant === 'agency' ? deletedRequest.client.id : (deletedRequest.agency?.id || '');
      const cacheKey = `${deletedRequest.status}-${clientOrgId}`;
      
      setRequestsByClientStatus(prev => {
        const newMap = new Map(prev);
        const requests = newMap.get(cacheKey) || [];
        newMap.set(cacheKey, requests.filter(r => r.id !== requestId));
        return newMap;
      });
      
      // Update status counts optimistically
      setStatusCounts(prev => {
        const newMap = new Map(prev);
        const currentCount = newMap.get(deletedRequest.status) || 0;
        newMap.set(deletedRequest.status, Math.max(0, currentCount - 1));
        return newMap;
      });
      
      // Update client counts optimistically
      setClientCounts(prev => {
        const newMap = new Map(prev);
        const currentCount = newMap.get(cacheKey) || 0;
        newMap.set(cacheKey, Math.max(0, currentCount - 1));
        return newMap;
      });
      
      // Update new requests count optimistically (for agency badge)
      // Decrement if deleted request had status 'new'
      if (context.variant === 'agency' && deletedRequest.status === 'new') {
        setOptimisticNewRequestsCount(prev => Math.max(0, prev - 1));
      }
    }
    
    setUnfilteredTotalCount(prev => Math.max(0, prev - 1));
    
    // Also close modal if this request is currently selected
    if (selectedRequest?.id === requestId) {
      setIsRequestDetailModalOpen(false);
      setSelectedRequest(null);
    }
    
    try {
      const { deleteRequest } = await import('@/features/connections/requests/actions');
      await deleteRequest(requestId);
      // Only show success toast after server confirms
      toast.success('Request deleted');
    } catch (error) {
      // Revert optimistic update on error
      if (deletedRequest) {
        const clientOrgId = context.variant === 'agency' ? deletedRequest.client.id : (deletedRequest.agency?.id || '');
        const cacheKey = `${deletedRequest.status}-${clientOrgId}`;
        
        setRequestsByClientStatus(prev => {
          const newMap = new Map(prev);
          const requests = newMap.get(cacheKey) || [];
          newMap.set(cacheKey, [deletedRequest, ...requests]);
          return newMap;
        });
        
        // Revert status counts
        setStatusCounts(prev => {
          const newMap = new Map(prev);
          const currentCount = newMap.get(deletedRequest.status) || 0;
          newMap.set(deletedRequest.status, currentCount + 1);
          return newMap;
        });
        
        // Revert client counts
        setClientCounts(prev => {
          const newMap = new Map(prev);
          const currentCount = newMap.get(cacheKey) || 0;
          newMap.set(cacheKey, currentCount + 1);
          return newMap;
        });
        
        // Revert new requests count optimistically (for agency badge)
        // Restore if deleted request had status 'new'
        if (context.variant === 'agency' && deletedRequest.status === 'new') {
          setOptimisticNewRequestsCount(prev => prev + 1);
        }
        
        setUnfilteredTotalCount(prev => prev + 1);
      }
      console.error('Error deleting request:', error);
      toast.error('Failed to delete request');
    }
  }, [findRequestInCache, selectedRequest, context]);

  const handleConvertModalClose = useCallback(() => {
    setIsConvertModalOpen(false);
    setTimeout(() => {
      setConvertRequest(null);
      setProjectsForConvert([]);
      setMembersForConvert(agencyMembers);
    }, 300);
  }, [agencyMembers]);

  const handleRequestConvertToTask = useCallback((request: Request) => {
    setConvertRequest(request);
    
    // Include the request's project in the initial projects array to prevent flicker
    // ConvertToTaskModal will fetch the full projects list in the background
    if (request.project) {
      setProjectsForConvert([{ id: request.project.id, name: request.project.name }]);
    } else {
      setProjectsForConvert([]);
    }
    
    // Set initial members from agencyMembers prop
    setMembersForConvert(agencyMembers);
    
    // Open the convert modal immediately (matching home page implementation)
    // ConvertToTaskModal will handle fetching projects/members if needed
    setIsConvertModalOpen(true);
    
    // Fetch projects and members in the background
    Promise.all([
      import('@/features/connections/tasks/actions').then(m => m.fetchProjectsForConnection(request.connectionId)),
      import('@/features/connections/tasks/actions').then(m => m.fetchMembersForConnection(request.connectionId)),
    ]).then(([projectsData, membersData]) => {
      // Update projects list (ensuring request's project is included)
      const mappedProjects = projectsData.map(p => ({ id: p.id, name: p.name }));
      if (request.project) {
        const hasProject = mappedProjects.some(p => p.id === request.project!.id);
        if (!hasProject) {
          mappedProjects.unshift({ id: request.project.id, name: request.project.name });
        }
      }
      setProjectsForConvert(mappedProjects);
      
      // Combine agency and client members, deduplicate by id
      const combined = [...membersData.agencyMembers, ...membersData.clientMembers];
      const dedupedMap = new Map<string, typeof combined[0]>();
      combined.forEach(member => {
        if (!dedupedMap.has(member.id)) {
          dedupedMap.set(member.id, member);
        }
      });
      setMembersForConvert(Array.from(dedupedMap.values()));
    }).catch(error => {
      console.error('Error fetching projects/members for convert modal:', error);
    });
  }, [agencyMembers]);

  const handleConvertSubmit = useCallback(async (values: ConvertToTaskModalValues) => {
    if (!convertRequest) {
      toast.error('Request unavailable for conversion');
      return;
    }

    setIsConverting(true);
    
    try {
      await convertRequestToTask(values.requestId, {
        connectionId: convertRequest.connectionId,
        title: values.title,
        description: values.description,
        status: values.status,
        projectId: values.project?.id ?? null,
        assigneeUserId: values.assignee?.id ?? null,
        dueDateRaw: values.dueDateRaw,
        clientVisible: values.clientVisible,
      });

      toast.success('Task created from request');
      handleRequestUpdate(values.requestId, { status: 'accepted' });
      handleConvertModalClose();
    } catch (error) {
      console.error('Failed to convert request to task:', error);
      toast.error('Failed to convert request');
    } finally {
      setIsConverting(false);
    }
  }, [convertRequest, handleRequestUpdate, handleConvertModalClose]);
  
  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (countRefreshTimeoutRef.current) {
        clearTimeout(countRefreshTimeoutRef.current);
      }
    };
  }, []);

  const handleToggleAssignedToMe = useCallback(() => {
    // MVP: Clear search if it has text (prevent feature mixing - only one filter at a time)
    if (searchValue.trim().length > 0) {
      setSearchValue('');
    }
    setAssignedToMe(prev => !prev);
  }, [searchValue]);

  // Get user avatar and initials from context
  const userAvatar = context.user?.avatarUrl || '';
  const userInitials = (context.user?.firstName?.[0] || '') + (context.user?.lastName?.[0] || '') || 'U';
  const isAgency = context.variant === 'agency';

  return (
    <div ref={rootRef} className="flex flex-col" style={{ padding: '0 16px 24px 24px' }}>
      <div
        ref={headerWrapperRef}
        className="sticky z-20"
        style={{
          top: 0,
          backgroundColor: 'var(--color-neutral-2)',
          backdropFilter: 'saturate(180%) blur(12px)',
        }}
      >
        <RequestsHeader
          onNewRequest={handleNewRequest}
          newRequestsCount={optimisticNewRequestsCount}
          isAgency={isAgency}
        />
      </div>

      <div ref={parentRef}>
        <RequestsTable
          requests={[]} // Always use accordion mode, never pass search results
          requestsByClientStatus={requestsByClientStatus}
          isLoadingClientStatus={isLoadingClientStatus}
          onFetchClientRequests={handleFetchClientRequestsWrapper}
          isBootstrapping={false} // No server-side search loading
          unfilteredTotalCount={unfilteredTotalCount}
          onLoadMore={undefined} // No pagination needed for client-side search
          searchQuery={searchValue} // Pass search query for client-side filtering (browse mode)
          searchResults={searchResults} // Pass server-side search results (search mode)
          isSearching={isSearching} // Pass search loading state
          assignedFilterResults={assignedFilterResults} // Pass assigned filter results (assigned filter mode)
          isLoadingAssignedFilter={isLoadingAssignedFilter} // Pass assigned filter loading state
          onNewRequest={handleNewRequest}
          onRequestClick={handleRequestClick}
          onRequestUpdate={handleRequestUpdate}
          onRequestDeleted={handleRequestDeleted}
          parentRef={parentRef}
          headerOffset={headerOffset}
          currentOrgId={context.orgId}
          totalCount={unfilteredTotalCount}
          assignedToMe={assignedToMe}
          onToggleAssignedToMe={handleToggleAssignedToMe}
          userAvatar={userAvatar}
          userInitials={userInitials}
          isAgency={isAgency}
          agencyMembers={agencyMembers}
          onSearchChange={handleSearchChange}
          onConvertToTask={handleRequestConvertToTask}
          allowedConnectionIds={allowedConnectionIds}
          allConnectionsMetadata={allConnectionsMetadata}
          statusCounts={statusCounts}
          clientCounts={clientCounts}
          collapsedStatuses={collapsedStatuses}
          collapsedClients={collapsedClients}
          onToggleStatus={toggleStatus}
          onToggleClient={toggleClient}
          hasOptimisticData={(cacheKey: string) => optimisticCacheKeysRef.current.has(cacheKey)}
        />
      </div>

      {/* Request Detail Modal */}
      {selectedRequest && (
        <RequestDetailModal
          requestData={{
            requestId: selectedRequest.id,
            title: selectedRequest.title,
            description: selectedRequest.description,
            client: selectedRequest.client,
            agency: selectedRequest.agency,
            submittedBy: selectedRequest.submittedBy,
            assignee: selectedRequest.assignee,
            project: selectedRequest.project,
            status: selectedRequest.status,
            createdAt: selectedRequest.createdAt,
            createdByOrgId: selectedRequest.createdByOrgId,
            createdByOrgType: selectedRequest.createdByOrgType,
          }}
          agencyMembers={agencyMembers}
          projects={[]} // TODO: Fetch projects for global requests
          isOpen={isRequestDetailModalOpen}
          onClose={handleRequestDetailModalClose}
          onExpand={handleExpandRequest}
          onRequestUpdate={(requestId, updates) => {
            handleRequestUpdate(requestId, updates);
            // Also update selectedRequest if it's the current one
            if (selectedRequest && selectedRequest.id === requestId) {
              setSelectedRequest(prev => prev ? { ...prev, ...updates } : null);
            }
          }}
          onRequestDeleted={handleRequestDeleted}
          connectionId={selectedRequest.connectionId}
          currentOrgId={context.orgId}
          variant={context.variant}
          activeUser={context.user ? {
            id: context.user.id,
            firstName: context.user.firstName,
            lastName: context.user.lastName,
            avatarUrl: context.user.avatarUrl,
          } : undefined}
          initialComments={commentsByRequest[selectedRequest.id] || []}
          onCommentsUpdate={(comments) => {
            setCommentsByRequest(prev => ({
              ...prev,
              [selectedRequest.id]: comments
            }));
          }}
          isDisconnected={false}
          isGlobalView={true}
          onConvertToTask={(request) => {
            if (!request || !selectedRequest) return
            // RequestDetailModal already handles closing with animation and 175ms delay
            // before calling this callback, so we can open convert modal immediately
            handleRequestConvertToTask(selectedRequest)
          }}
        />
      )}

      {/* Convert to Task Modal */}
      {convertRequest && (
        <ConvertToTaskModal
          isOpen={isConvertModalOpen}
          onClose={handleConvertModalClose}
          onSubmit={handleConvertSubmit}
          isSubmitting={isConverting}
          connectionId={convertRequest.connectionId}
          variant={context.variant}
          request={{
            requestId: convertRequest.id,
            title: convertRequest.title,
            description: convertRequest.description ?? '',
            client: convertRequest.client,
            agency: convertRequest.agency,
            submittedBy: convertRequest.submittedBy
              ? {
                  id: convertRequest.submittedBy.id,
                  name: convertRequest.submittedBy.name,
                  email: convertRequest.submittedBy.email,
                  avatarUrl: convertRequest.submittedBy.avatarUrl,
                }
              : undefined,
            assignee: convertRequest.assignee
              ? {
                  id: convertRequest.assignee.id,
                  name: convertRequest.assignee.name,
                  email: convertRequest.assignee.email,
                  avatarUrl: convertRequest.assignee.avatarUrl,
                }
              : null,
            project: convertRequest.project,
            createdAt: convertRequest.createdAt,
            createdByOrgId: convertRequest.createdByOrgId,
            createdByOrgType: convertRequest.createdByOrgType,
          }}
          agencyMembers={membersForConvert}
          projects={projectsForConvert}
        />
      )}

      {/* New Request Modal - Global Mode */}
      <NewRequestModal
        connections={connections}
        agencyMembers={agencyMembers}
        projects={projectsForConnection}
        isOpen={isNewRequestModalOpen}
        onClose={handleNewRequestModalClose}
        onRequestOptimistic={handleRequestOptimistic}
        onRequestCreated={handleRequestCreated}
        connectionId={selectedConnectionId || undefined}
        currentOrgId={context.orgId}
        variant={context.variant}
        isGlobal={true}
        onConnectionSelect={handleConnectionSelect}
        allowedConnectionIds={allowedConnectionIds}
        onPaywallBlocked={() => setIsPaywallModalOpen(true)}
      />

      {/* Paywall Modal */}
      <PaywallModal 
        open={isPaywallModalOpen} 
        onOpenChange={setIsPaywallModalOpen} 
      />
    </div>
  );
}

