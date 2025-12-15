'use client'

import { useState, useCallback, useEffect, useRef, useTransition, useMemo } from 'react';
import { flushSync } from 'react-dom';
import { toast } from 'sonner';
import TasksTable from '@/features/tasks/TasksTable';
import { TasksHeader } from '@/features/tasks/TasksHeader';
import { TaskDetailModal } from '@/features/connections/tasks/TaskDetailModal';
import { NewTaskModal } from '@/features/connections/tasks/NewTaskModal';
import { fetchTaskByIdGlobal, fetchCommentsForTaskGlobal, fetchTasksCounts, fetchTasksForClientStatus, searchClientsWithTasksAction, fetchAssignedTasksByClient } from '@/features/tasks/actions';
import type { TaskStatus } from '@/features/tasks/taskGrouping';
import { fetchProjectsForConnection } from '@/features/connections/tasks/actions';
import { PaywallModal } from '@/components/ui/paywall-modal';
import { runWithPaywallCheck } from '@/lib/tasks-requests-helpers';
import type { TasksSnapshot, Task, SearchResults } from '@/features/tasks/types';
import type { EnhancedModeContext } from '@/lib/mode/getActiveContext';
import type { Comment } from '@/features/connections/server';

interface TasksContentProps {
  snapshot: TasksSnapshot;
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
  clientMembers?: Array<{
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
    orgId: string // Organization ID (client_id for agencies, agency_id for clients)
  }>;
  membersByConnection?: Record<string, Array<{
    id: string
    firstName: string
    lastName: string
    email: string
    avatarUrl?: string
    jobTitle?: string
    orgId?: string
    orgName?: string
    orgType?: 'agency' | 'client'
  }>>;
  allowedConnectionIds?: string[] | null; // Array of allowed connection IDs (null = no limit for paid plans)
}

export function TasksContent({ 
  snapshot, 
  context, 
  initialSearchValue = '', 
  initialComments = {},
  agencyMembers = [],
  clientMembers = [],
  connections = [],
  membersByConnection = {},
  allowedConnectionIds = null
}: TasksContentProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const parentRef = useRef<HTMLDivElement | null>(null);
  const headerWrapperRef = useRef<HTMLDivElement>(null);
  const [headerOffset, setHeaderOffset] = useState(0);
  // Initialize assigned filter (always start with filter off)
  const [assignedToMe, setAssignedToMe] = useState(false);
  
  // Accordion state: tasks cached by client and status
  // Map<`${status}-${clientOrgId}`, Task[]>
  const [tasksByClientStatus, setTasksByClientStatus] = useState<Map<string, Task[]>>(new Map());
  
  // Loading state for client status fetches
  // Map<`${status}-${clientOrgId}`, boolean>
  const [isLoadingClientStatus, setIsLoadingClientStatus] = useState<Map<string, boolean>>(new Map());
  
  // Refs to track current state for fetch logic (avoid stale closures)
  const tasksByClientStatusRef = useRef<Map<string, Task[]>>(new Map());
  const isLoadingClientStatusRef = useRef<Map<string, boolean>>(new Map());
  
  // Sync refs with state
  useEffect(() => {
    tasksByClientStatusRef.current = tasksByClientStatus;
  }, [tasksByClientStatus]);
  
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
  
  // Ref to track count refresh timeout for debouncing
  const countRefreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Track cache keys that have optimistic data (so we always fetch to replace them)
  const optimisticCacheKeysRef = useRef<Set<string>>(new Set());
  
  // Track tempId → taskId mappings to coordinate optimistic replacement
  const tempIdToTaskIdRef = useRef<Map<string, string>>(new Map());
  
  // Ref to track fetch function to avoid circular dependency
  const fetchTasksForClientStatusRef = useRef<((status: string, clientOrgId: string) => Promise<void>) | null>(null);

  // Client-side collapse state
  // Status groups: expanded by default (except done)
  const [collapsedStatuses, setCollapsedStatuses] = useState<Set<string>>(new Set(['done']));
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
  const [isTaskDetailModalOpen, setIsTaskDetailModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isNewTaskModalOpen, setIsNewTaskModalOpen] = useState(false);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  const [projectsForConnection, setProjectsForConnection] = useState<Array<{ id: string; name: string }>>([]);
  
  // Comments map keyed by taskId for instant lookup
  // Initialize with server-fetched comments for instant availability
  const [commentsByTask, setCommentsByTask] = useState<Record<string, Comment[]>>(initialComments);
  
  // Paywall modal state
  const [isPaywallModalOpen, setIsPaywallModalOpen] = useState(false);

  // Calculate client team member IDs (all members of the client organization)
  // This filters tasks where assignee_user_id is a member of the client organization
  const clientTeamMemberIds = useMemo(() => {
    if (context.variant !== 'client') return [] as string[];
    // Use the directly fetched client members (all members of context.orgId)
    return clientMembers.map(member => member.id).filter((id): id is string => Boolean(id));
  }, [context.variant, clientMembers]);

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
    fetchTasksCounts(context, {
      assignedToUserId: assignedToMe && context.variant === 'agency' ? context.user?.id : undefined,
      assignedToUserIds: assignedToMe && context.variant === 'client' && clientTeamMemberIds.length > 0 ? clientTeamMemberIds : undefined,
    }).then(({ statusCounts: sc, clientCounts: cc }) => {
      setStatusCounts(new Map(Object.entries(sc)));
      setClientCounts(new Map(Object.entries(cc)));
    }).catch(error => {
      console.error('Error fetching tasks counts:', error);
    });
  }, [context, assignedToMe, clientTeamMemberIds, statusCounts.size, clientCounts.size]);

  // Initial load: only set metadata, no tasks fetched
  useEffect(() => {
    const hasActiveSearch = searchValue.trim().length > 0;
    
    if (hasActiveSearch) {
      return; // Search mode handled separately
    }
    
    // Accordion mode: only set metadata, no tasks
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
      // If client is in Set (expanded), remove it (collapse)
      // If client is NOT in Set (collapsed by default), add it to mark as expanded
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

  // Fetch tasks for a specific client in a specific status (fetch-on-expand)
  const handleFetchTasksForClientStatus = useCallback(async (status: string, clientOrgId: string, showLoadingSkeleton: boolean = true, forceFetch: boolean = false) => {
    const cacheKey = `${status}-${clientOrgId}`;
    
    // Check if already loading using ref
    if (isLoadingClientStatusRef.current.get(cacheKey)) {
      return; // Already fetching, don't duplicate
    }
    
    // CRITICAL: If this cache key has optimistic data, ALWAYS fetch to replace it with server data
    const hasOptimisticData = optimisticCacheKeysRef.current.has(cacheKey);
    
    // Check if we have complete cached data
    const cachedTasks = tasksByClientStatusRef.current.get(cacheKey);
    const expectedCount = clientCounts.get(cacheKey) || 0;
    const hasCompleteCache = cachedTasks && cachedTasks.length === expectedCount && expectedCount > 0;
    
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
      const tasks = await fetchTasksForClientStatus(context, clientOrgId, status as TaskStatus, {
        assignedToUserId: assignedToMe && context.variant === 'agency' ? context.user?.id : undefined,
        assignedToUserIds: assignedToMe && context.variant === 'client' && clientTeamMemberIds.length > 0 ? clientTeamMemberIds : undefined,
      });
      
      // Merge server data with optimistic tasks - preserve optimistic until replaced by real data
      setTasksByClientStatus(prev => {
        const newMap = new Map(prev);
        const existingTasks = newMap.get(cacheKey) || [];
        
        // Create a set of server task IDs for deduplication
        const serverTaskIds = new Set(tasks.map(t => t.id));
        
        // Find optimistic tasks (tempId) - these should persist until replaced
        const optimisticTasks = existingTasks.filter(t => t.id.startsWith('temp-'));
        
        // Find tasks that were added by handleTaskCreated (real taskId, not in server response yet)
        // These are tasks that exist in cache but not in server response (race condition)
        const cacheOnlyTasks = existingTasks.filter(t => 
          !t.id.startsWith('temp-') && !serverTaskIds.has(t.id)
        );
        
        // Check which optimistic tasks have been replaced via tempId → taskId mapping
        const replacedTempIds = new Set<string>();
        for (const [tempId, taskId] of tempIdToTaskIdRef.current.entries()) {
          // Check if the replacement task exists in server response or cache
          if (serverTaskIds.has(taskId) || existingTasks.some(t => t.id === taskId)) {
            replacedTempIds.add(tempId);
          }
        }
        
        // Match optimistic tasks to server tasks by connectionId + title
        // If server has a matching task, the optimistic one should be removed (replaced)
        const serverTaskKeys = new Set(
          tasks.map(t => `${t.connectionId}:${t.title}`)
        );
        
        // Create a set of cache-only task keys for matching
        const cacheOnlyTaskKeys = new Set(
          cacheOnlyTasks.map(t => `${t.connectionId}:${t.title}`)
        );
        
        // Preserve optimistic tasks that don't have a matching server task yet
        // BUT also check if handleTaskCreated already replaced them with real tasks
        const preservedOptimistic = optimisticTasks.filter(optTask => {
          // CRITICAL: If this tempId has been replaced via mapping, don't preserve it
          if (replacedTempIds.has(optTask.id)) {
            return false;
          }
          
          // CRITICAL: Check if there's a cache-only replacement (handleTaskCreated already ran)
          // This is the ONLY other way we should remove optimistic tasks
          const optKey = `${optTask.connectionId}:${optTask.title}`;
          const hasCacheOnlyReplacement = cacheOnlyTaskKeys.has(optKey);
          
          // Keep if: no cache-only replacement yet (meaning handleTaskCreated hasn't run yet)
          // DO NOT check server match - that could be a different task created at the same time
          return !hasCacheOnlyReplacement;
        });
        
        // Ensure replaced tasks are included in merged result
        // Find the real tasks that replaced optimistic ones
        const replacedTasks = Array.from(replacedTempIds)
          .map(tempId => {
            const taskId = tempIdToTaskIdRef.current.get(tempId);
            if (!taskId) return null;
            // Find the real task from server response, cache-only tasks, or existing tasks
            return tasks.find(t => t.id === taskId) || 
                   cacheOnlyTasks.find(t => t.id === taskId) ||
                   existingTasks.find(t => t.id === taskId);
          })
          .filter((t): t is Task => t !== null);
        
        // CRITICAL: Only preserve cache-only tasks that are tracked in tempId mapping
        // This ensures we only keep legitimate tasks from handleTaskCreated, not stale/deleted ones
        // If a task isn't in the server response AND isn't tracked in the mapping, it's stale and should be removed
        const trackedTaskIds = new Set(Array.from(tempIdToTaskIdRef.current.values()));
        const preservedCacheOnly = cacheOnlyTasks.filter(cacheTask => 
          trackedTaskIds.has(cacheTask.id)
        );
        
        // Combine: server tasks + replaced tasks + preserved cache-only + preserved optimistic
        // Server tasks are already sorted by createdAt DESC from the server
        const merged = [...tasks, ...replacedTasks, ...preservedCacheOnly, ...preservedOptimistic];
        
        // Deduplicate by taskId (in case server response includes tasks that were added by handleTaskCreated)
        const deduplicated = Array.from(
          new Map(merged.map(t => [t.id, t])).values()
        );
        
        // Sort merged list by createdAt DESC to maintain order (newest first)
        deduplicated.sort((a, b) => {
          const aTime = new Date(a.createdAtRaw || a.createdAt).getTime();
          const bTime = new Date(b.createdAtRaw || b.createdAt).getTime();
          return bTime - aTime; // Descending (newest first)
        });
        
        newMap.set(cacheKey, deduplicated);
        
        // Clean up tempId mappings for tasks now in server response
        for (const [tempId, taskId] of tempIdToTaskIdRef.current.entries()) {
          if (serverTaskIds.has(taskId)) {
            tempIdToTaskIdRef.current.delete(tempId);
          }
        }
        
        // Only remove from optimistic tracking if all optimistic tasks have been replaced
        const stillHasOptimistic = deduplicated.some(t => t.id.startsWith('temp-'));
        if (!stillHasOptimistic) {
          optimisticCacheKeysRef.current.delete(cacheKey);
        }
        
        return newMap;
      });
    } catch (error) {
      console.error('Error fetching tasks for client status:', error);
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
  }, [context, assignedToMe, clientTeamMemberIds, clientCounts]);

  // Sync the fetch function ref so it can be called from other callbacks
  useEffect(() => {
    fetchTasksForClientStatusRef.current = handleFetchTasksForClientStatus;
  }, [handleFetchTasksForClientStatus]);

  // Wrapper callback for TasksTable that bridges the signature difference
  // TasksTable calls: (status, clientOrgId, forceFetch?)
  // handleFetchTasksForClientStatus expects: (status, clientOrgId, showLoadingSkeleton, forceFetch)
  const handleFetchClientTasksWrapper = useCallback((
    status: string, 
    clientOrgId: string, 
    forceFetch?: boolean
  ) => {
    handleFetchTasksForClientStatus(status, clientOrgId, true, forceFetch || false);
  }, [handleFetchTasksForClientStatus]);

  // Sync comments when initialComments prop changes (when snapshot changes, page re-fetches comments)
  useEffect(() => {
    setCommentsByTask(prev => ({
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
      // This prevents collapsing clients that were expanded by task creation/updates
      if (wasInSearchMode) {
        // Transitioning from search → browse: reset to default collapse state
        setCollapsedStatuses(new Set(['done']));
        setCollapsedClients(new Map()); // Empty map = all clients collapsed
      }
      // If wasInSearchMode = false, we're already in browse mode - preserve collapse state
      
      // Update ref for next comparison
      wasInSearchModeRef.current = false;
      
      // Scroll to top when clearing search
      window.scrollTo({ top: 0, behavior: 'smooth' });
      
      // DO NOT clear tasksByClientStatus - preserve browse mode cache
      // The table will automatically switch to browse mode when searchResults is null
      
      return;
    }
    
    // Update ref: we're entering/remaining in search mode
    wasInSearchModeRef.current = true;

    // Perform server-side search (even for 1 char - let server handle it)
    const performSearch = async () => {
      try {
        const results = await searchClientsWithTasksAction(context, trimmedSearch, {
          assignedToUserId: assignedToMe && context.variant === 'agency' ? context.user?.id : undefined,
          assignedToUserIds: assignedToMe && context.variant === 'client' && clientTeamMemberIds.length > 0 ? clientTeamMemberIds : undefined,
        });
        setSearchResults(results);
        
        // Expand all status headers (empty set = all expanded)
        setCollapsedStatuses(new Set());
        
        // Expand all client headers (add all clients to expanded sets)
        const statusOrder = ['in_progress', 'to_do', 'on_hold', 'done'];
        const newCollapsedClients = new Map<string, Set<string>>();
        
        statusOrder.forEach(status => {
          const clientsInStatus = results.clients.filter(client => 
            client.tasks.some(task => task.status === status)
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
        console.error('Error searching clients with tasks:', error);
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
  }, [searchValue, context, assignedToMe, clientTeamMemberIds]);

  // Assigned filter effect - ONLY reacts to assignedToMe changes
  useEffect(() => {
    const wasInAssignedFilterMode = wasInAssignedFilterModeRef.current;
    
    if (!assignedToMe) {
      // Turn OFF - transition to browse mode
      setIsLoadingAssignedFilter(true);
      setAssignedFilterResults(null);
      // DO NOT clear tasksByClientStatus - preserve browse cache
      
      // CRITICAL: Only reset collapse state if we're transitioning FROM assigned filter mode TO browse mode
      // If we're already in browse mode (wasInAssignedFilterMode = false), preserve existing collapse state
      // This prevents collapsing clients that were expanded by task creation/updates
      if (wasInAssignedFilterMode) {
        // Transitioning from assigned filter → browse: reset to default collapse state
        setCollapsedStatuses(new Set(['done']));
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
        const results = await fetchAssignedTasksByClient(context);
        setAssignedFilterResults(results);
        
        // Expand all status headers (empty set = all expanded)
        setCollapsedStatuses(new Set());
        
        // Expand all client headers (add all clients to expanded sets)
        const statusOrder = ['in_progress', 'to_do', 'on_hold', 'done'];
        const newCollapsedClients = new Map<string, Set<string>>();
        
        statusOrder.forEach(status => {
          const clientsInStatus = results.clients.filter(client => 
            client.tasks.some(task => task.status === status)
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
        console.error('Error fetching assigned tasks by client:', error);
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
  // Search is handled by filtering allConnectionsMetadata client-side in TasksTable

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

  const handleNewTask = useCallback(() => {
    setIsNewTaskModalOpen(true);
  }, []);

  const handleNewTaskModalClose = useCallback(() => {
    setIsNewTaskModalOpen(false);
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

  const handleTaskOptimistic = useCallback((payload: {
    tempId: string
    title: string
    description: string
    projectId: string | null
    projectName?: string | null
    assigneeUserId: string | null
    assignee?: {
      id: string
      name: string
      email: string
      avatarUrl?: string
    } | null
    clientVisible?: boolean
    clientVisibilityLocked?: boolean
    connectionId: string
  }) => {
    // Use connectionId from payload instead of state (state gets cleared when modal closes)
    const targetConnectionId = payload.connectionId
    if (!targetConnectionId) return;
    
    // Find the selected connection using payload connectionId
    const selectedConnection = connections.find(c => c.id === targetConnectionId);
    if (!selectedConnection) return;

    // Find an existing task for this connection to reuse its client/agency structure
    // This ensures we use the exact same client ID that the server uses, preventing duplicate subgroups
    // Search in cached accordion state
    let existingTask: Task | undefined;
    for (const tasks of tasksByClientStatus.values()) {
      existingTask = tasks.find(t => t.connectionId === targetConnectionId);
      if (existingTask) break;
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
    
    // Create optimistic task
    // Use ISO timestamp for proper sorting (will be formatted for display in TaskRow)
    const now = new Date();
    
    // Reuse client/agency from existing task if available to ensure exact ID match
    // Otherwise construct from connection/context using the correct orgId
    const client = existingTask?.client || (isAgency 
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
    
    const agency = existingTask?.agency || (isAgency
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
    
    const optimisticTask: Task = {
      id: payload.tempId,
      connectionId: targetConnectionId,
      title: payload.title,
      description: payload.description,
      status: 'to_do',
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
      assignee: payload.assignee || null,
      client,
      agency,
      createdAt: now.toISOString(), // Use ISO timestamp for proper sorting (newest first)
      createdAtRaw: now.toISOString(),
      updatedAt: undefined,
      dueDate: undefined,
      dueDateRaw: null,
      completedAt: undefined,
      completedAtRaw: null,
      createdByUserId: context.user?.id || '',
      createdByOrgId: context.organization.id,
      createdByOrgType: context.variant,
      clientVisible: payload.clientVisible ?? false,
      clientVisibilityLocked: payload.clientVisibilityLocked ?? false,
      sourceRequestId: null,
      linkedRequest: null,
    };

    // Add to accordion cache (optimistic task is always 'to_do')
    // Determine client org ID for cache key
    const clientOrgId = isAgency ? optimisticTask.client.id : (optimisticTask.agency?.id || '');
    const cacheKey = `to_do-${clientOrgId}`;
    
    // FORCE IMMEDIATE SYNCHRONOUS UPDATES - no batching, render NOW
    flushSync(() => {
      // ALWAYS optimistically add the new task IMMEDIATELY (users need to see it instantly)
      setTasksByClientStatus(prev => {
        const newMap = new Map(prev);
        const existingTasks = newMap.get(cacheKey) || [];
        // Check if task already exists (avoid duplicates)
        if (!existingTasks.some(t => t.id === payload.tempId)) {
          newMap.set(cacheKey, [optimisticTask, ...existingTasks]);
          // Mark as optimistic so fetch replaces it with complete server data
          optimisticCacheKeysRef.current.add(cacheKey);
        }
        return newMap;
      });
      
      // IMMEDIATELY expand the client group (no checks, just expand it NOW)
      setCollapsedClients(prev => {
        const newMap = new Map(prev);
        const statusSet = newMap.get('to_do') || new Set();
        const newStatusSet = new Set(statusSet);
        // Add clientOrgId to mark as expanded
        newStatusSet.add(clientOrgId);
        newMap.set('to_do', newStatusSet);
        return newMap;
      });
      
      // IMMEDIATELY ensure the status group is expanded
      setCollapsedStatuses(prev => {
        const newSet = new Set(prev);
        newSet.delete('to_do');
        return newSet;
      });
      
      // Move count updates INSIDE flushSync for instant updates
      setUnfilteredTotalCount(prev => prev + 1);
      // Update status counts optimistically
      setStatusCounts(prev => {
        const newMap = new Map(prev);
        const currentCount = newMap.get('to_do') || 0;
        newMap.set('to_do', currentCount + 1);
        return newMap;
      });
      // Update client counts optimistically
      setClientCounts(prev => {
        const newMap = new Map(prev);
        const currentCount = newMap.get(cacheKey) || 0;
        newMap.set(cacheKey, currentCount + 1);
        return newMap;
      });
    });
    
    // Always trigger fetch to replace optimistic task with server data
    // Always show skeleton while loading (even if we have optimistic data)
    // This ensures user sees skeleton below optimistic task while server data loads
    handleFetchTasksForClientStatus('to_do', clientOrgId, true);
  }, [connections, context, allConnectionsMetadata, handleFetchTasksForClientStatus, tasksByClientStatus]);

  const handleTaskCreated = useCallback(async ({ taskId, tempId, connectionId }: { taskId: string; tempId?: string; connectionId?: string }) => {
    // Use connectionId from payload, fallback to selectedConnectionId for backward compatibility
    const targetConnectionId = connectionId || selectedConnectionId
    if (!targetConnectionId) return;
    
    try {
      // Use connectionId directly and skip cache for immediate post-insert fetch
      const task = await fetchTaskByIdGlobal(taskId, context, targetConnectionId, true);
      if (!task) {
        console.error('Failed to fetch newly created task');
        return;
      }
      
      // Show success toast after successfully fetching the task
      toast.success('Task created successfully');
      
      // Determine client org ID for cache key
      const clientOrgId = context.variant === 'agency' ? task.client.id : (task.agency?.id || '');
      const cacheKey = `${task.status}-${clientOrgId}`;
      
      // Record the tempId → taskId mapping to coordinate with fetch merge
      if (tempId) {
        tempIdToTaskIdRef.current.set(tempId, taskId);
      }
      
      // Check if the target client group is expanded
      const isNewStatusClientExpanded = collapsedClients.get(task.status)?.has(clientOrgId) || false;
      
      // Auto-expand the client group if it's collapsed (so user can see where the task was added)
      if (!isNewStatusClientExpanded) {
        setCollapsedClients(prev => {
          const newMap = new Map(prev);
          const statusSet = newMap.get(task.status) || new Set();
          const newStatusSet = new Set(statusSet);
          // Add clientOrgId to mark as expanded
          newStatusSet.add(clientOrgId);
          newMap.set(task.status, newStatusSet);
          return newMap;
        });
        
        // Also ensure the status group is expanded
        setCollapsedStatuses(prev => {
          const newSet = new Set(prev);
          newSet.delete(task.status);
          return newSet;
        });
      }
      
      // Replace temp task with real task (fetch is already in progress from optimistic step)
      // The fetch that started in handleTaskOptimistic will merge this with complete server data
      setTasksByClientStatus(prev => {
        const newMap = new Map(prev);
        const existingTasks = newMap.get(cacheKey) || [];
        
        // Always ensure real task exists, even if fetch merge already added it
        const hasRealTask = existingTasks.some(t => t.id === task.id);
        
        // Remove temp task and any duplicate real task
        const without = existingTasks.filter(t => t.id !== tempId && t.id !== task.id);
        
        // If real task already exists, just remove temp (don't add duplicate or overwrite)
        // Otherwise, replace temp with real task at the top
        if (hasRealTask) {
          // Real task already in cache (from fetch merge), just remove temp
          newMap.set(cacheKey, without);
        } else {
          // Replace temp with real task at the top
          newMap.set(cacheKey, [task, ...without]);
        }
        
        // Keep optimistic marker - the in-progress fetch will replace with complete data
        optimisticCacheKeysRef.current.add(cacheKey);
        return newMap;
      });
      
      // Note: Fetch was already triggered in handleTaskOptimistic, so we don't need to fetch again here
      // The in-progress fetch will merge the real task with complete server data when it completes
      
      // Update selectedTask if it matches tempId (using functional update to avoid stale closure)
      if (tempId) {
        setSelectedTask(prev => {
          if (prev?.id === tempId) {
            return task;
          }
          return prev;
        });
      }
      
      // Fetch comments for the new task
      try {
        const comments = await fetchCommentsForTaskGlobal(taskId);
        // Update comments map for the new task
        setCommentsByTask(prev => ({
          ...prev,
          [taskId]: comments
        }));
      } catch (error) {
        console.error('Error fetching comments:', error);
      }
    } catch (error) {
      console.error('Failed to fetch newly created task:', error);
      // If task creation failed, remove from mapping
      if (tempId) {
        tempIdToTaskIdRef.current.delete(tempId);
      }
    }
  }, [selectedConnectionId, context, collapsedClients]);

  // Helper to find task in cached accordion state or search results
  const findTaskInCache = useCallback((taskId: string): Task | null => {
    // Check accordion cache (tasksByClientStatus)
    for (const tasks of tasksByClientStatus.values()) {
      const found = tasks.find(t => t.id === taskId);
      if (found) return found;
    }
    
    // Check search results
    if (searchResults) {
      for (const client of searchResults.clients) {
        const found = client.tasks.find(t => t.id === taskId);
        if (found) return found;
      }
    }
    
    // Check assigned filter results
    if (assignedFilterResults) {
      for (const client of assignedFilterResults.clients) {
        const found = client.tasks.find(t => t.id === taskId);
        if (found) return found;
      }
    }
    
    return null;
  }, [tasksByClientStatus, searchResults, assignedFilterResults]);

  const handleTaskClick = useCallback(async (taskId: string) => {
    // Try to get task from local state first
    const localTask = findTaskInCache(taskId);
    
    if (!localTask) {
      // If not in local state, fetch from server (will trigger paywall check)
      await runWithPaywallCheck(
        async () => {
          const task = await fetchTaskByIdGlobal(taskId, context);
          if (!task) {
            throw new Error('Task not found');
          }
          return task;
        },
        (task) => {
          setSelectedTask(task);
          setIsTaskDetailModalOpen(true);
          
          // Use prefetched comments if available, otherwise fetch
          if (commentsByTask[taskId]) {
            // Comments already available, no need to fetch
          } else {
            // Fetch comments if not prefetched
            fetchCommentsForTaskGlobal(taskId).then(comments => {
              setCommentsByTask(prev => ({
                ...prev,
                [taskId]: comments
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
      if (!allowedConnectionIds.includes(localTask.connectionId)) {
        // Restricted connection - show paywall immediately
        setIsPaywallModalOpen(true);
        return;
      }
    }

    // Allowed - open modal instantly with local data
    setSelectedTask(localTask);
    setIsTaskDetailModalOpen(true);
    
    // Use prefetched comments if available, otherwise fetch
    if (commentsByTask[taskId]) {
      // Comments already available, no need to fetch
    } else {
      // Fetch comments if not prefetched
      fetchCommentsForTaskGlobal(taskId).then(comments => {
        setCommentsByTask(prev => ({
          ...prev,
          [taskId]: comments
        }));
      }).catch(error => {
        console.error('Error fetching comments:', error);
      });
    }
  }, [findTaskInCache, context, commentsByTask, allowedConnectionIds]);
  
  const handleTaskDetailModalClose = useCallback(() => {
    setIsTaskDetailModalOpen(false);
    // Allow modal exit animation before clearing data
    setTimeout(() => {
      setSelectedTask(null);
    }, 300);
  }, []);
  
  const handleExpandTask = useCallback(() => {
    if (selectedTask && selectedTask.connectionId) {
      // Check if this is a tempId (starts with 'temp-')
      // If so, prevent navigation and show a message
      if (selectedTask.id.startsWith('temp-')) {
        toast.error('Please wait for the task to finish creating');
        return;
      }
      
      // Determine baseRoute based on context variant
      // Agencies view clients, clients view agencies
      const baseRoute = context.variant === 'agency' ? 'clients' : 'agencies';
      const url = `/${baseRoute}/${selectedTask.connectionId}/tasks/${selectedTask.id}`;
      window.location.href = url;
    }
  }, [selectedTask, context.variant]);

  const handleTaskUpdate = useCallback((taskId: string, updates: { title?: string; description?: string; status?: 'to_do' | 'in_progress' | 'on_hold' | 'done'; assignee?: Task['assignee']; project?: { id: string; name: string } | null; dueDate?: string | null; dueDateRaw?: string | null; completedAtRaw?: string | null; clientVisible?: boolean; clientVisibilityLocked?: boolean }) => {
    // Optimistic update - update in accordion cache
    // If status changed, move task to new cache key
    const oldTask = findTaskInCache(taskId);
    if (oldTask && updates.status && updates.status !== oldTask.status) {
      // Status changed - remove from old cache key, add to new
      const oldClientOrgId = context.variant === 'agency' ? oldTask.client.id : (oldTask.agency?.id || '');
      const oldCacheKey = `${oldTask.status}-${oldClientOrgId}`;
      const newClientOrgId = context.variant === 'agency' ? oldTask.client.id : (oldTask.agency?.id || '');
      const newCacheKey = `${updates.status}-${newClientOrgId}`;
      
      // Optimistically update status counts
      const newStatus = updates.status; // Already checked above that updates.status exists
      if (newStatus) {
        setStatusCounts(prev => {
          const newMap = new Map(prev);
          const oldCount = newMap.get(oldTask.status) || 0;
          const newCount = newMap.get(newStatus) || 0;
          newMap.set(oldTask.status, Math.max(0, oldCount - 1));
          newMap.set(newStatus, newCount + 1);
          return newMap;
        });
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
      const isOldStatusClientExpanded = collapsedClients.get(oldTask.status)?.has(oldClientOrgId) || false;
      const isNewStatusClientExpanded = collapsedClients.get(newStatus)?.has(newClientOrgId) || false;
      
      // Get current cache state
      const _oldTasks = tasksByClientStatus.get(oldCacheKey) || [];
      const newTasks = tasksByClientStatus.get(newCacheKey) || [];
      const hasNewCacheData = newTasks.length > 0;
      
      // Update accordion cache (move task to new status)
      setTasksByClientStatus(prev => {
        const newMap = new Map(prev);
        
        // Always remove from old cache if that client group is expanded (user can see it)
        if (isOldStatusClientExpanded) {
          const oldCachedTasks = newMap.get(oldCacheKey) || [];
          newMap.set(oldCacheKey, oldCachedTasks.filter(t => t.id !== taskId));
        }
        
        // Only optimistically add to new cache if:
        // 1. The new client group is expanded (user can see it)
        // 2. We have cached data for that client group (so it appears alongside existing tasks)
        // If the client group is collapsed OR we don't have cached data, don't add optimistically
        // (it will be loaded when the user expands and fetches)
        if (isNewStatusClientExpanded && hasNewCacheData) {
          // Check if task already exists (avoid duplicates)
          if (!newTasks.some(t => t.id === taskId)) {
            newMap.set(newCacheKey, [{ ...oldTask, ...updates }, ...newTasks]);
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
        fetchTasksCounts(context, {
          assignedToUserId: assignedToMe && context.variant === 'agency' ? context.user?.id : undefined,
          assignedToUserIds: assignedToMe && context.variant === 'client' && clientTeamMemberIds.length > 0 ? clientTeamMemberIds : undefined,
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
          
          // If the new status's client group is expanded, refresh tasks to merge with server
          // This ensures optimistic data is replaced with complete server data
          if (isNewStatusClientExpanded && fetchTasksForClientStatusRef.current) {
            // Fetch fresh data from server (fetch logic will detect optimistic data and fetch)
            fetchTasksForClientStatusRef.current(newStatus, newClientOrgId);
          }
        }).catch(error => {
          console.error('Error refreshing counts after status update:', error);
        });
        countRefreshTimeoutRef.current = null;
      }, 500); // Debounce: wait 500ms after last status change
    } else {
      // Same status - update in place
      setTasksByClientStatus(prev => {
        const newMap = new Map(prev);
        for (const [key, tasks] of newMap.entries()) {
          const updated = tasks.map(t => t.id === taskId ? { ...t, ...updates } : t);
          if (updated.some(t => t.id === taskId)) {
            newMap.set(key, updated);
            break;
          }
        }
        return newMap;
      });
    }
    
    // Also update selectedTask if it's the current one
    if (selectedTask && selectedTask.id === taskId) {
      setSelectedTask(prev => prev ? { ...prev, ...updates } : null);
    }
  }, [selectedTask, findTaskInCache, context, assignedToMe, clientTeamMemberIds, collapsedClients, tasksByClientStatus]);

  const handleTaskDeleted = useCallback(async (taskId: string) => {
    // Find task in cache
    const deletedTask = findTaskInCache(taskId);
    
    // Optimistically remove task from accordion cache
    if (deletedTask) {
      const clientOrgId = context.variant === 'agency' ? deletedTask.client.id : (deletedTask.agency?.id || '');
      const cacheKey = `${deletedTask.status}-${clientOrgId}`;
      
      setTasksByClientStatus(prev => {
        const newMap = new Map(prev);
        const tasks = newMap.get(cacheKey) || [];
        newMap.set(cacheKey, tasks.filter(t => t.id !== taskId));
        return newMap;
      });
      
      // Update status counts optimistically
      setStatusCounts(prev => {
        const newMap = new Map(prev);
        const currentCount = newMap.get(deletedTask.status) || 0;
        newMap.set(deletedTask.status, Math.max(0, currentCount - 1));
        return newMap;
      });
      
      // Update client counts optimistically
      setClientCounts(prev => {
        const newMap = new Map(prev);
        const currentCount = newMap.get(cacheKey) || 0;
        newMap.set(cacheKey, Math.max(0, currentCount - 1));
        return newMap;
      });
    }
    
    setUnfilteredTotalCount(prev => Math.max(0, prev - 1));
    
    // Also close modal if this task is currently selected
    if (selectedTask?.id === taskId) {
      setIsTaskDetailModalOpen(false);
      setSelectedTask(null);
    }
    
    try {
      const { deleteTask } = await import('@/features/connections/tasks/actions');
      await deleteTask(taskId);
      // Only show success toast after server confirms
      toast.success('Task deleted');
    } catch (error) {
      // Revert optimistic update on error
      if (deletedTask) {
        const clientOrgId = context.variant === 'agency' ? deletedTask.client.id : (deletedTask.agency?.id || '');
        const cacheKey = `${deletedTask.status}-${clientOrgId}`;
        
        setTasksByClientStatus(prev => {
          const newMap = new Map(prev);
          const tasks = newMap.get(cacheKey) || [];
          newMap.set(cacheKey, [deletedTask, ...tasks]);
          return newMap;
        });
        
        // Revert status counts
        setStatusCounts(prev => {
          const newMap = new Map(prev);
          const currentCount = newMap.get(deletedTask.status) || 0;
          newMap.set(deletedTask.status, currentCount + 1);
          return newMap;
        });
        
        // Revert client counts
        setClientCounts(prev => {
          const newMap = new Map(prev);
          const currentCount = newMap.get(cacheKey) || 0;
          newMap.set(cacheKey, currentCount + 1);
          return newMap;
        });
        
        setUnfilteredTotalCount(prev => prev + 1);
      }
      console.error('Error deleting task:', error);
      toast.error('Failed to delete task');
    }
  }, [findTaskInCache, selectedTask, context]);
  
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
  // Use organization logo for clients, user avatar for agencies (matching connection-specific behavior)
  const userAvatar = context.variant === 'agency'
    ? (context.user?.avatarUrl || '')
    : (context.organization.logoUrl || '');
  
  const userInitials = context.variant === 'agency'
    ? ((context.user?.firstName?.[0] || '') + (context.user?.lastName?.[0] || '') || 'U')
    : (context.organization.name ? context.organization.name.slice(0, 2).toUpperCase() : 'TM');
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
        <TasksHeader
          onNewTask={handleNewTask}
          isAgency={isAgency}
        />
      </div>

      <div ref={parentRef}>
        <TasksTable
          tasks={[]} // Always use accordion mode, never pass search results
          tasksByClientStatus={tasksByClientStatus}
          isLoadingClientStatus={isLoadingClientStatus}
          onFetchClientTasks={handleFetchClientTasksWrapper}
          isBootstrapping={false} // No server-side search loading
          unfilteredTotalCount={unfilteredTotalCount}
          onLoadMore={undefined} // No pagination needed for client-side search
          searchQuery={searchValue} // Pass search query for client-side filtering (browse mode)
          searchResults={searchResults} // Pass server-side search results (search mode)
          isSearching={isSearching} // Pass search loading state
          assignedFilterResults={assignedFilterResults} // Pass assigned filter results (assigned filter mode)
          isLoadingAssignedFilter={isLoadingAssignedFilter} // Pass assigned filter loading state
          onNewTask={handleNewTask}
          onTaskClick={handleTaskClick}
          onTaskUpdate={handleTaskUpdate}
          onTaskDeleted={handleTaskDeleted}
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
          membersByConnection={membersByConnection}
          onSearchChange={handleSearchChange}
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

      {/* Task Detail Modal */}
      {selectedTask && (
        <TaskDetailModal
          taskData={{
            taskId: selectedTask.id,
            title: selectedTask.title,
            description: selectedTask.description,
            client: selectedTask.client,
            agency: selectedTask.agency,
            submittedBy: selectedTask.submittedBy,
            assignee: selectedTask.assignee,
            project: selectedTask.project,
            status: selectedTask.status,
            dueDate: selectedTask.dueDate,
            dueDateRaw: selectedTask.dueDateRaw,
            createdAt: selectedTask.createdAt,
            createdByOrgId: selectedTask.createdByOrgId,
            createdByOrgType: selectedTask.createdByOrgType,
            clientVisible: selectedTask.clientVisible,
            clientVisibilityLocked: selectedTask.clientVisibilityLocked,
            sourceRequestId: selectedTask.sourceRequestId,
            linkedRequest: selectedTask.linkedRequest,
          }}
          agencyMembers={membersByConnection[selectedTask.connectionId] || agencyMembers}
          projects={[]} // TODO: Fetch projects for global tasks
          isOpen={isTaskDetailModalOpen}
          onClose={handleTaskDetailModalClose}
          onExpand={handleExpandTask}
          onTaskUpdate={(taskId, updates) => {
            handleTaskUpdate(taskId, updates);
            // Also update selectedTask if it's the current one
            if (selectedTask && selectedTask.id === taskId) {
              setSelectedTask(prev => prev ? { ...prev, ...updates } : null);
            }
          }}
          onTaskDeleted={handleTaskDeleted}
          connectionId={selectedTask.connectionId}
          currentOrgId={context.orgId}
          variant={context.variant}
          activeUser={context.user ? {
            id: context.user.id,
            firstName: context.user.firstName,
            lastName: context.user.lastName,
            avatarUrl: context.user.avatarUrl,
          } : undefined}
          initialComments={commentsByTask[selectedTask.id] || []}
          onCommentsUpdate={(comments) => {
            setCommentsByTask(prev => ({
              ...prev,
              [selectedTask.id]: comments
            }));
          }}
          isDisconnected={false}
          isGlobalView={true}
        />
      )}

      {/* New Task Modal - Global Mode */}
      {isNewTaskModalOpen && (
        <NewTaskModal
          client={selectedConnectionId ? connections.find(c => c.id === selectedConnectionId) : undefined}
          connections={connections}
          agencyMembers={agencyMembers}
          projects={projectsForConnection}
          isOpen={isNewTaskModalOpen}
          onClose={handleNewTaskModalClose}
          onTaskOptimistic={handleTaskOptimistic}
          onTaskCreated={handleTaskCreated}
          connectionId={selectedConnectionId || undefined}
          currentOrgId={context.orgId}
          variant={context.variant}
          isGlobal={true}
          onConnectionSelect={handleConnectionSelect}
          allowedConnectionIds={allowedConnectionIds}
          onPaywallBlocked={() => setIsPaywallModalOpen(true)}
        />
      )}

      {/* Paywall Modal */}
      <PaywallModal 
        open={isPaywallModalOpen} 
        onOpenChange={setIsPaywallModalOpen} 
      />
    </div>
  );
}
