'use client'

import { useState, useEffect, useRef, useCallback, useTransition, useMemo } from 'react'
import { createClient as createSupabaseBrowserClient } from '@/lib/supabase/client'
import { useRouter, usePathname } from 'next/navigation'
import { toast } from 'sonner'
import { useConnection } from '../ConnectionContext';
import TasksTable from '../tasks/TasksTable';
import { TaskDetailModal } from '../tasks/TaskDetailModal'
import { NewTaskModal } from '../tasks/NewTaskModal'
import type { Task, Comment } from '../server';
import { fetchTasksForConnection, fetchTaskById, fetchCommentsForTasks } from '../tasks/actions';
import { sortTasksWithPinnedFirst } from '../tasks/taskSort';
import { sortMembersWithActiveFirst, type MemberSummary } from '../utils/memberSorting';
import { PAGE_SIZE, isDev } from '../constants';
// PREFETCH_TIMEOUT_MS imported but not used - kept for potential future use
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

type PrefetchedComment = {
  id: string
  userId: string
  userName: string
  userAvatar?: string
  createdAt: string
  text: string
}

interface TasksPageClientProps {
  connectionId: string
  initialTasks: Task[]
  initialTotalCount: number
  initialStatusCounts?: Record<string, number> // Server-side status counts to prevent flicker
  agencyMembers: MemberSummary[]
  projects: Array<{
    id: string
    name: string
  }>
  initialCommentsByTask?: Record<string, PrefetchedComment[]>
}

// Client component wrapper that handles all client-side interactivity
export default function TasksPageClient({ connectionId, initialTasks, initialTotalCount, initialStatusCounts, agencyMembers, projects, initialCommentsByTask }: TasksPageClientProps) {
  const { snapshot, context, setIsEmpty } = useConnection();
  const _router = useRouter()
  const pathname = usePathname()
  const baseRoute = pathname.includes('/clients/') ? 'clients' : 'agencies'
  
  // Get user avatar and organization from context
  const userAvatar = context.variant === 'agency'
    ? context.user?.avatarUrl || ''
    : context.organization.logoUrl || '';

  const userInitials = context.variant === 'agency'
    ? (`${context.user?.firstName?.[0] || ''}${context.user?.lastName?.[0] || ''}`.trim() || 'U')
    : (context.organization.name ? context.organization.name.slice(0, 2).toUpperCase() : 'TM');
  const currentOrgId = context.organization.id;

  // Local state for tasks (for optimistic updates)
  const pinnedTaskIdsRef = useRef<Set<string>>(new Set())

  const mergePinnedTasks = useCallback((incoming: Task[]) => {
    if (pinnedTaskIdsRef.current.size === 0) return incoming
    const pinned: Task[] = []
    const unpinned: Task[] = []
    for (const task of incoming) {
      if (pinnedTaskIdsRef.current.has(task.id)) {
        pinned.push({ ...task, isPinned: true })
      } else {
        unpinned.push(task)
      }
    }
    return [...pinned, ...unpinned]
  }, [])

  const registerPinnedTask = useCallback((taskId: string) => {
    pinnedTaskIdsRef.current.add(taskId)
  }, [])

  const _unregisterPinnedTask = useCallback((taskId: string) => {
    pinnedTaskIdsRef.current.delete(taskId)
  }, [])

  // Store unfiltered data (all tasks fetched upfront)
  const [allTasks, setAllTasks] = useState<Task[]>(() => {
    const initial = mergePinnedTasks(sortTasksWithPinnedFirst(initialTasks))
    if (isDev()) {
      const inProgressCount = initial.filter(t => t.status === 'in_progress').length
      console.log('[TasksPageClient] Initial allTasks state', {
        totalTasks: initial.length,
        inProgressCount,
        statuses: initial.map(t => t.status)
      })
    }
    return initial
  })

  const sortTasksWithMode = useCallback((items: Task[]): Task[] => (
    mergePinnedTasks(sortTasksWithPinnedFirst(items))
  ), [mergePinnedTasks])
  // Optimistic new tasks disabled (relying on real-time updates)
  
  // Status counts from server (prevents flicker)
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>(() => {
    // Initialize with server counts if available, otherwise empty (will be computed from tasks)
    return initialStatusCounts || {}
  })
  
  // Total count state (filtered)
  const [_totalCount, setTotalCount] = useState<number>(initialTotalCount)
  
  // Unfiltered total count state (total tasks for connection regardless of filters)
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
  const [prefetchedTasks, setPrefetchedTasks] = useState<Task[]>([])
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
  // Never reuse a key across different lifecycle intents (refresh vs search vs filter change)
  const _getRequestKey = useCallback((intent: string, offset: number, searchQuery?: string, assignedToMe?: boolean) => {
    // Include connectionId, intent, offset, searchQuery, and assignedToMe in key
    // Intent distinguishes: 'refresh', 'search', 'prefetch', 'loadMore'
    return `tasks:${connectionId}:${intent}:${offset}:${searchQuery || ''}:${assignedToMe ? 'assigned' : 'all'}`
  }, [connectionId])
  
  // Track if component is mounted to prevent state updates after unmount
  const isMountedRef = useRef(true)
  // no optimistic reconcile attempts (disabled)
  
  // Comments map keyed by taskId for instant lookup
  const [commentsByTask, setCommentsByTask] = useState<Record<string, Comment[]>>(() => {
    if (!initialCommentsByTask) return {}
    const map: Record<string, Comment[]> = {}
    for (const [taskId, comments] of Object.entries(initialCommentsByTask)) {
      map[taskId] = comments.map(comment => ({
        ...comment,
        createdAt: new Date(comment.createdAt),
      }))
    }
    return map
  })

  const sortedMembers = useMemo(() => (
    sortMembersWithActiveFirst(agencyMembers, context.user?.id)
  ), [agencyMembers, context.user?.id])

  const clientTeamMemberIds = useMemo(() => {
    if (context.variant !== 'client') return [] as string[]
    const ids = new Set<string>()
    sortedMembers.forEach(member => {
      if (member.id && member.orgType === 'client') {
        ids.add(member.id)
      }
    })
    if (context.user?.id) {
      ids.add(context.user.id)
    }
    return Array.from(ids)
  }, [context.variant, sortedMembers, context.user?.id])

  // Client-side filtering: filter allTasks based on searchQuery and assignedToMe
  const filteredTasks = useMemo(() => {
    let result = allTasks
    
    // Filter by search query (title contains, case-insensitive)
    if (debouncedSearchQuery.trim().length > 0) {
      const query = debouncedSearchQuery.trim().toLowerCase()
      result = result.filter(task => 
        task.title.toLowerCase().includes(query)
      )
    }
    
    // Filter by assigned to me
    if (assignedToMe) {
      if (context.variant === 'agency') {
        // Agency: assigned to current user
        result = result.filter(task => 
          task.assignee?.id === context.user?.id
        )
      } else {
        // Client: assigned to any client team member OR created by current user
        result = result.filter(task => 
          (task.assignee?.id && clientTeamMemberIds.includes(task.assignee.id)) ||
          task.submittedBy?.id === context.user?.id
        )
      }
    }
    
    return sortTasksWithMode(result)
  }, [allTasks, debouncedSearchQuery, assignedToMe, context.variant, context.user?.id, clientTeamMemberIds, sortTasksWithMode])

  // REMOVED: Unnecessary useEffect that re-sorts tasks on mount
  // Tasks are already sorted in initial state: useState(() => mergePinnedTasks(sortTasksWithPinnedFirst(initialTasks)))
  // This useEffect was causing task rows to not render initially, then all render at once
  // Re-sorting only happens when tasks actually change via other useEffects (refreshFirstPage, loadMore, etc.)
  
  // Throttle realtime refresh calls to prevent POST storms (must be declared before useEffect that uses it)
  const lastRealtimeRefreshRef = useRef<number>(0)
  const REALTIME_REFRESH_THROTTLE_MS = 1000 // 1 second throttle
  
  // Update isEmpty in context when unfilteredTotalCount changes
  // Note: unfilteredTotalCount is initialized from initialTotalCount (server-side), no need to refetch on mount
  useEffect(() => {
    setIsEmpty(unfilteredTotalCount === 0 && !isBootstrapping)
  }, [unfilteredTotalCount, isBootstrapping, setIsEmpty])
  
  // DRY: refresh all tasks (used by realtime fallback only - no filters)
  // Fetch ALL tasks upfront for connection tables (no pagination, no filters)
  const refreshFirstPage = useCallback(async (fromRealtime = false) => {
    // Throttle realtime-triggered refreshes
    if (fromRealtime) {
      const now = Date.now()
      const timeSinceLastRefresh = now - lastRealtimeRefreshRef.current
      if (timeSinceLastRefresh < REALTIME_REFRESH_THROTTLE_MS) {
        if (isDev()) {
          console.log('[TasksPageClient] Throttling realtime refresh', { timeSinceLastRefresh, throttle: REALTIME_REFRESH_THROTTLE_MS })
        }
        return Promise.resolve()
      }
      lastRealtimeRefreshRef.current = now
    }
    
    const requestKey = `tasks:${connectionId}:refresh:all:no-filters`
    
    if (isDev()) {
      console.log('[TasksPageClient] refreshFirstPage called', { requestKey, fromRealtime })
    }
    
    return fetchOnce(requestKey, async () => {
      const result = await fetchTasksForConnection(connectionId, {
        limit: 10000, // High safety limit
        offset: 0
        // No filters - fetch all tasks
      })
      
      if (!isMountedRef.current) return result
      
      // Debug logging for in_progress tasks
      if (isDev()) {
        const inProgressCount = result.tasks.filter(t => t.status === 'in_progress').length
        console.log('[TasksPageClient] refreshFirstPage completed', {
          totalTasks: result.tasks.length,
          inProgressCount,
          statuses: result.tasks.map(t => t.status),
          requestKey
        })
      }
      
      // Large state update - use transition for non-urgent render
      startTransition(() => {
        const sortedTasks = sortTasksWithMode(result.tasks)
        setAllTasks(sortedTasks)
        setUnfilteredTotalCount(result.totalCount)
        // Filtered count will be computed from filteredTasks useMemo
        setTotalCount(result.totalCount)
        setHasMore(false) // No pagination
        setCurrentOffset(0)
        setPrefetchedTasks([])
        setPrefetchedOffset(null)
      })
      
      return result
    })
  }, [connectionId, startTransition, sortTasksWithMode, fetchOnce])

  // DRY: prepend unique task by id (updates unfiltered data)
  const prependUnique = useCallback((task: Task) => {
    setAllTasks(prev => {
      const existingIndex = prev.findIndex(r => r.id === task.id)
      if (existingIndex !== -1) {
        const next = [...prev]
        const existingPinned = Boolean(next[existingIndex]?.isPinned)
        next[existingIndex] = existingPinned ? { ...task, isPinned: true } : task
        return sortTasksWithMode(next)
      }
      return sortTasksWithMode([...prev, task])
    })
    setUnfilteredTotalCount(c => c + 1)
  }, [sortTasksWithMode])

  // DRY: remove by id, return whether something was removed (updates unfiltered data)
  const removeById = useCallback((id: string) => {
    let removed = false
    setAllTasks(prev => {
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

  useEffect(() => {
    if (!initialCommentsByTask || Object.keys(initialCommentsByTask).length === 0) return
    setCommentsByTask(prev => {
      const next = { ...prev }
      let changed = false
      for (const [taskId, comments] of Object.entries(initialCommentsByTask)) {
        const normalized = comments.map(comment => ({
          ...comment,
          createdAt: new Date(comment.createdAt),
        }))
        const existing = next[taskId]
        const isSameLength = existing?.length === normalized.length
        const isSame = isSameLength
          ? existing?.every((comment, index) => comment.id === normalized[index].id)
          : false
        if (!isSame) {
          next[taskId] = normalized
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [initialCommentsByTask])

  // Helper to merge arrays by id while preserving order and uniqueness
  const mergeUniqueTasks = useCallback((base: Task[], incoming: Task[]): Task[] => {
    const seen = new Set(base.map(i => i.id))
    const merged = [...base]
    let changed = false
    for (const item of incoming) {
      if (!seen.has(item.id)) {
        seen.add(item.id)
        merged.push(item)
        changed = true
      }
    }
    if (!changed) {
      return base
    }
    return sortTasksWithMode(merged)
  }, [sortTasksWithMode])

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

  
  // Prefetch next batch of tasks (disabled - we fetch all data upfront)
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
      .channel(`tasks-insert-${connectionId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'tasks', filter: `connection_id=eq.${connectionId}` },
        async (payload: RealtimePostgresChangesPayload<{ id: string; connection_id: string }>) => {
          const newId = (payload?.new as { id: string } | undefined)?.id
          if (!newId) return
          try {
            const task = await fetchTaskById(connectionId, newId)
            if (!task) return
            
            // Add directly to unfiltered data - filtered view will update automatically
            prependUnique(task)
          } catch (_) {
            // fallback to full refresh if single-row fetch fails
            await refreshFirstPage(true) // Pass true to indicate this is from realtime
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'tasks', filter: `connection_id=eq.${connectionId}` },
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
            const task = await fetchTaskById(connectionId, updated.id)
            if (!task) return
            
            // Update selected task if it's the one being updated
            setSelectedTask(prev => {
              if (prev && prev.taskId === task.id) {
                return {
                  ...prev,
                  title: task.title,
                  description: task.description,
                  assignee: task.assignee,
                  project: task.project,
                  status: task.status,
                  dueDate: task.dueDate ?? null,
                  dueDateRaw: task.dueDateRaw ?? null,
                  createdAt: task.createdAt,
                  createdByOrgId: task.createdByOrgId,
                  createdByOrgType: task.createdByOrgType,
                  clientVisible: task.clientVisible,
                  clientVisibilityLocked: task.clientVisibilityLocked
                }
              }
              return prev
            })
            
            // Update task in unfiltered data - filtered view will update automatically
            setAllTasks(prev => {
              const existingIndex = prev.findIndex(t => t.id === task.id)
              if (existingIndex !== -1) {
                // Task exists - update it
                const existingTask = prev[existingIndex]
                const existingPinned = Boolean(existingTask?.isPinned)
                
                // Update the task
                const next = [...prev]
                next[existingIndex] = existingPinned ? { ...task, isPinned: true } : task
                
                // Re-sort to ensure task appears in correct group
                return sortTasksWithMode(next)
              } else {
                // Task not in list - add it (e.g., status changed)
                return sortTasksWithMode([...prev, task])
              }
            })
          } catch (_) {
            // Fallback to full refresh only on error (from realtime UPDATE)
            await refreshFirstPage(true) // Pass true to indicate this is from realtime
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [connectionId, refreshFirstPage, prependUnique, removeById, sortTasksWithMode])

  // Load more tasks function (uses prefetched data if available)
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
        hasPrefetched: prefetchedTasks.length > 0, 
        prefetchedCount: prefetchedTasks.length,
        currentOffset 
      })
    }
    
    // If we have prefetched data, use it immediately (even if hasMore is false)
    if (prefetchedTasks.length > 0 && prefetchedOffset !== null) {
      isLoadingMore.current = true
      
      if (isDev()) {
        console.log('[LoadMore] Using prefetched data', prefetchedTasks.length, 'tasks')
      }
      
      const prefetchedCount = prefetchedTasks.length
      const nextOffset = prefetchedOffset + PAGE_SIZE
      
      if (isMountedRef.current) {
        setAllTasks(prev => mergeUniqueTasks(prev, prefetchedTasks))
        setCurrentOffset(nextOffset)
      }
      
      // Fetch comments for the new tasks
      const newIds = prefetchedTasks.map(r => r.id)
      if (newIds.length > 0) {
        fetchCommentsForTasks(newIds)
          .then(map => {
            if (isMountedRef.current) {
              setCommentsByTask(prev => ({ ...prev, ...map }))
            }
          })
          .catch(error => {
            if (isDev()) {
              console.error('Error fetching comments for prefetched tasks:', error)
            }
          })
      }
      
      // Clear prefetched data
      setPrefetchedTasks([])
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
    // Use comprehensive queryKey pattern (same as search effect) to ensure correct deduplication
    const loadMoreAssignedKey = assignedToMe
      ? (context.variant === 'agency'
          ? `u:${context.user?.id ?? 'none'}`
          : `ids:${clientTeamMemberIds.join(',')}`)
      : 'none'
    const loadMoreQueryKey = `q:${debouncedSearchQuery || ''}|a:${loadMoreAssignedKey}|v:${context.variant}`
    const requestKey = `tasks:${connectionId}:loadMore:${currentOffset}:${loadMoreQueryKey}`
    
    if (isDev()) {
      console.log('[LoadMore] Fetching on-demand for key:', requestKey)
    }
    
    try {
      const result = await fetchOnce(requestKey, async () => {
        return await fetchTasksForConnection(connectionId, { 
          limit: PAGE_SIZE, 
          offset: currentOffset,
          searchQuery: debouncedSearchQuery || undefined,
          assignedToUserId: assignedToMe && context.variant === 'agency' ? context.user?.id : undefined,
          assignedToUserIds: assignedToMe && context.variant === 'client' && clientTeamMemberIds.length > 0 ? clientTeamMemberIds : undefined
        })
      }) as Awaited<ReturnType<typeof fetchTasksForConnection>>
      
      // Only update state if component is still mounted
      if (!isMountedRef.current) return
      
      if (result.tasks.length === 0) {
        setHasMore(false)
      } else {
        setAllTasks(prev => mergeUniqueTasks(prev, result.tasks))
        setUnfilteredTotalCount(result.totalCount)
        const nextOffset = currentOffset + PAGE_SIZE
        setCurrentOffset(nextOffset)
        
        // Fetch comments for the new tasks
        const newIds = result.tasks.map((r: Task) => r.id)
        if (newIds.length > 0) {
          fetchCommentsForTasks(newIds)
            .then(map => {
              if (isMountedRef.current) {
                setCommentsByTask(prev => ({ ...prev, ...map }))
              }
            })
            .catch(error => {
              if (isDev()) {
                console.error('Error fetching comments for on-demand tasks:', error)
              }
            })
        }
        
        // If we got fewer than PAGE_SIZE, there are no more
        if (result.tasks.length < PAGE_SIZE) {
          setHasMore(false)
        } else {
          // Only prefetch next batch if user is very close to end (< 5 rows)
          // Prefetch should ONLY happen from loadMore when user scrolls near end
          prefetchNext(nextOffset)
        }
      }
    } catch (error) {
      if (isDev()) {
        console.error('Failed to load more tasks:', error)
      }
      // Only update hasMore if component is still mounted
      if (isMountedRef.current) {
        setHasMore(false) // Stop trying if we get an error
      }
    } finally {
      isLoadingMore.current = false
    }
  }, [connectionId, hasMore, currentOffset, prefetchedTasks, prefetchedOffset, prefetchNext, debouncedSearchQuery, assignedToMe, context.user?.id, context.variant, clientTeamMemberIds, mergeUniqueTasks, fetchOnce])

  // Toggle handler for Assigned to me (client-side filtering only)
  const handleToggleAssignedToMe = useCallback(() => {
    setAssignedToMe(prev => !prev)
  }, [])

  // REMOVED: Automatic prefetch effect
  // Prefetch should ONLY happen from loadMore() when user scrolls near end
  // This prevents ~80% of request spam

  // Load more handler for virtual scroll
  const handleLoadMore = useCallback((_virtualRows: Array<{ index: number; start: number; end: number; size: number }>) => {
    // Virtual scroll triggers loadMore in TasksTable based on scroll position
    // This handler is called when user scrolls near the end
            loadMore()
  }, [loadMore])

  // Local state for modal (like ProfileCard pattern) - must be declared before useEffect
  const [selectedTask, setSelectedTask] = useState<{
    taskId: string
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
    status?: 'to_do' | 'in_progress' | 'on_hold' | 'done'
  dueDate?: string | null
  dueDateRaw?: string | null
    createdAt?: string
    createdByOrgId?: string
    createdByOrgType?: 'agency' | 'client'
    clientVisible?: boolean
    clientVisibilityLocked?: boolean
  sourceRequestId?: string | null
  linkedRequest?: {
    id: string
    title: string
    createdAt: string
    createdByUserId?: string
    createdByName?: string
  } | null
  } | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isNewModalOpen, setIsNewModalOpen] = useState(false)
  const [selectedTaskComments, setSelectedTaskComments] = useState<Array<{
    id: string
    userId: string
    userName: string
    userAvatar?: string
    createdAt: Date
    text: string
  }>>([])

  // Track if modal is closing to prevent reopening during close animation
  const isClosingModalRef = useRef(false)

  function getTaskById(taskId: string) {
    return allTasks.find(r => r.id === taskId)
  }

  function handleTaskUpdate(taskId: string, updates: { title?: string; description?: string; status?: 'to_do' | 'in_progress' | 'on_hold' | 'done'; assignee?: Task['assignee']; project?: { id: string; name: string } | null; dueDate?: string | null; dueDateRaw?: string | null; createdAtRaw?: string | null; clientVisible?: boolean; clientVisibilityLocked?: boolean }) {
    // Get the original task to compare status changes
    const originalTask = allTasks.find(r => r.id === taskId)

    const sanitizedUpdates = Object.fromEntries(
      Object.entries(updates).filter(([, value]) => value !== undefined)
    ) as typeof updates
    
    // Update unfiltered tasks list optimistically
    setAllTasks(prevTasks =>
      sortTasksWithMode(
      prevTasks.map(task =>
        task.id === taskId
          ? { ...task, ...sanitizedUpdates }
          : task
        )
      )
    )

    // Also update selectedTask if it's the current one
    setSelectedTask(prev => 
      prev && prev.taskId === taskId
        ? { ...prev, ...sanitizedUpdates }
        : prev
    )
    
    // Optimistically update status counts when status changes
    if (updates.status && originalTask && originalTask.status !== updates.status) {
      setStatusCounts(prev => {
        const next = { ...prev }
        // Decrement old status count
        const oldStatus = originalTask.status
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
    // TODO: Add newTasksCount support to ConnectionContext when needed
    // if (context.variant === 'agency' && updates.status && originalTask) {
    //   const wasNew = originalTask.status === 'new'
    //   const isNowNew = updates.status === 'new'
    //   
    //   // Increment count if status changed TO 'new'
    //   if (!wasNew && isNowNew) {
    //     setNewTasksCount(prev => (prev || 0) + 1)
    //   }
    //   // Decrement count if status changed FROM 'new'
    //   else if (wasNew && !isNowNew) {
    //     setNewTasksCount(prev => Math.max(0, (prev || 0) - 1))
    //   }
    // }
  }

  function handleRowClick(taskId: string) {
    // Prevent opening modal if we're currently closing it (prevents double flicker)
    if (isClosingModalRef.current) {
      return
    }
    
    const task = getTaskById(taskId)
    if (task) {
      // Get comments from pre-fetched map (instant, no fetch)
      // Comments are always prefetched server-side for initial tasks
      // and client-side for search/pagination results
      const comments = commentsByTask[taskId] ?? []
      
      // Open modal immediately with task data and comments
      setSelectedTask({
        taskId: task.id,
        title: task.title,
        description: task.description,
        client: task.client,
        agency: task.agency,
        submittedBy: task.submittedBy,
        assignee: task.assignee,
        project: task.project,
        status: task.status,
        dueDate: task.dueDate ?? undefined,
        createdAt: task.createdAt,
        createdByOrgId: task.createdByOrgId,
        clientVisible: task.clientVisible,
        clientVisibilityLocked: task.clientVisibilityLocked,
      createdByOrgType: task.createdByOrgType,
      sourceRequestId: task.sourceRequestId ?? null,
      linkedRequest: task.linkedRequest ?? null,
      })
      setSelectedTaskComments(comments)
      setIsModalOpen(true)
    }
  }

  function handleTableTaskDeleted(taskId: string) {
    // Get the deleted task to check if it was 'new' status
    const deletedTask = allTasks.find(r => r.id === taskId)
    
    // Optimistically remove task from unfiltered table
    setAllTasks(prev => prev.filter(r => r.id !== taskId))
    
    // Optimistically update status counts
    if (deletedTask?.status) {
      setStatusCounts(prev => {
        const next = { ...prev }
        if (next[deletedTask.status] !== undefined) {
          next[deletedTask.status] = Math.max(0, (next[deletedTask.status] || 0) - 1)
        }
        return next
      })
    }
    
    // Update badge count if deleted task was 'new' status in agency view
    // TODO: Add newTasksCount support to ConnectionContext when needed
    // if (context.variant === 'agency' && deletedTask?.status === 'new') {
    //   setNewTasksCount(prev => Math.max(0, (prev || 0) - 1))
    // }
    
    // Decrement total count
    setUnfilteredTotalCount(c => Math.max(0, c - 1))
    // Filtered count will be computed from filteredTasks useMemo
  }

  function handleModalClose() {
    // Set closing flag to prevent reopening during close animation
    isClosingModalRef.current = true
    // Close modal first, then clear data after animation completes
    setIsModalOpen(false)
    // Small delay to let animation finish, then clear closing flag
    setTimeout(() => {
      setSelectedTask(null)
      setSelectedTaskComments([])
      isClosingModalRef.current = false
    }, 300)
  }

  function handleNewTask() {
    setIsNewModalOpen(true)
  }
  
  function handleNewModalClose() {
    setIsNewModalOpen(false)
  }

  function handleExpand() {
    // Navigate to full page
    if (selectedTask && selectedTask.taskId !== 'new') {
      const url = `/${baseRoute}/${connectionId}/tasks/${selectedTask.taskId}`
      window.location.href = url
    }
  }

  // Optimistic add: show a temporary row immediately
  const handleTaskOptimistic = useCallback((payload: {
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

    let optimisticAssigneeOrgId: string | undefined
    let optimisticAssigneeOrgType: 'agency' | 'client' | undefined

    const optimisticAssignee = payload.assigneeUserId
      ? (() => {
          const member = sortedMembers.find(m => m.id === payload.assigneeUserId)
          if (!member) return null
          const name = `${member.firstName} ${member.lastName}`.trim() || member.email
          optimisticAssigneeOrgId = member.orgId
          optimisticAssigneeOrgType = member.orgType
          return {
            id: member.id,
            name,
            email: member.email,
            avatarUrl: member.avatarUrl,
            organizationId: member.orgId,
          }
        })()
      : null

    const isClientAssignee = Boolean(
      optimisticAssignee &&
        (optimisticAssigneeOrgId === snapshot.partner.id || optimisticAssigneeOrgType === 'client')
    )

    const optimisticRow: Task = {
      id: payload.tempId,
      connectionId,
      title: payload.title,
      description: payload.description || '',
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
      assignee: optimisticAssignee,
      client: {
        id: snapshot.partner.id,
        name: snapshot.partner.name,
        logoUrl: snapshot.partner.logo,
      },
      createdAt: today,
      createdAtRaw: now.toISOString(),
      isPinned: true,
      createdByUserId: context.user?.id || '',
      createdByOrgId: context.organization.id,
      clientVisible: isClientAssignee,
      clientVisibilityLocked: isClientAssignee,
    }

    setAllTasks(prev => sortTasksWithMode([optimisticRow, ...prev]))
    setUnfilteredTotalCount(c => c + 1)
    // Filtered count will be computed from filteredTasks useMemo
    
    // Optimistically update status counts (new task always has 'to_do' status)
    setStatusCounts(prev => {
      const next = { ...prev }
      next['to_do'] = (next['to_do'] || 0) + 1
      return next
    })
    
    // Optimistically update badge count for agency view
    // TODO: Add newTasksCount support to ConnectionContext when needed
    // if (context.variant === 'agency') {
    //   setNewTasksCount(prev => (prev || 0) + 1)
    // }
    registerPinnedTask(payload.tempId)
  }, [connectionId, context.user, context.organization, snapshot.partner, sortTasksWithMode, sortedMembers, registerPinnedTask])

  async function handleTaskCreated({ taskId, tempId, connectionId: providedConnectionId }: { taskId: string; tempId?: string; connectionId: string }) {
    // Use provided connectionId (captured before modal closed) to avoid race condition
    // Fallback to connectionId from props if not provided (backward compatibility)
    const targetConnectionId = providedConnectionId || connectionId
    
    try {
      const task = await fetchTaskById(targetConnectionId, taskId)
      if (!task) return
      // Replace temp row if present; otherwise prepend and increment count
      setAllTasks(prev => {
        const _hadTemp = tempId ? prev.some(r => r.id === tempId) : false
        const without = prev.filter(r => r.id !== tempId && r.id !== task.id)
        const pinnedSource = tempId ? pinnedTaskIdsRef.current.has(tempId) : pinnedTaskIdsRef.current.has(task.id)
        if (tempId) {
          pinnedTaskIdsRef.current.delete(tempId)
        }
        const nextTask = pinnedSource ? { ...task, isPinned: true } : task
        if (pinnedSource) {
          pinnedTaskIdsRef.current.add(task.id)
        }
        const next = sortTasksWithMode([nextTask, ...without])
        return next
      })
      // If no temp was present, bump the count; if temp existed, count already included
      if (!tempId) {
        setUnfilteredTotalCount(c => c + 1)
      }
      // Filtered count will be computed from filteredTasks useMemo
      
      // Update badge count if task is new and we're in agency view (only if no temp was present)
      // TODO: Add newTasksCount support to ConnectionContext when needed
      // if (!tempId && context.variant === 'agency' && task.status === 'new') {
      //   setNewTasksCount(prev => (prev || 0) + 1)
      // }
      
      // Show success toast after server confirms and task is successfully fetched
      toast.success('Task created successfully')
    } catch (error) {
      if (isDev()) {
        console.error('Failed to insert newly created task into table:', error)
      }
      toast.error('Failed to create task')
    }
  }

  // No optimistic display merge; show server-backed list only

  return (
    <>
      {/* Tasks Table */}
      <div ref={parentRef}>
      <TasksTable
        userAvatar={userAvatar}
        userInitials={userInitials}
        onTaskClick={handleRowClick}
        onNewTask={handleNewTask}
        tasks={filteredTasks}
        agencyMembers={sortedMembers}
        onTaskUpdate={handleTaskUpdate}
        currentOrgId={currentOrgId}
          onLoadMore={handleLoadMore}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        totalCount={filteredTasks.length}
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
        onTaskDeleted={handleTableTaskDeleted}
        statusCounts={statusCounts}
      />
      </div>

      {/* Task Detail Modal - For existing tasks */}
      <TaskDetailModal
        taskData={selectedTask}
        agencyMembers={sortedMembers}
        projects={projects}
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onExpand={handleExpand}
        onTaskUpdate={handleTaskUpdate}
        onCommentsUpdate={(comments) => {
          // Update comments cache when comments are created/deleted in modal
          if (selectedTask?.taskId) {
            setCommentsByTask(prev => ({
              ...prev,
              [selectedTask.taskId]: comments
            }))
            // Also update selectedTaskComments so modal shows updated comments immediately
            setSelectedTaskComments(comments)
          }
        }}
        onTaskDeleted={(taskId) => {
          // Get the deleted task to check if it was 'new' status
          const _deletedTask = allTasks.find(r => r.id === taskId)
          
          // Optimistically remove task from unfiltered table
          setAllTasks(prev => prev.filter(r => r.id !== taskId))
          
          // Update badge count if deleted task was 'new' status in agency view
          // TODO: Add newTasksCount support to ConnectionContext when needed
          // if (context.variant === 'agency' && deletedTask?.status === 'new') {
          //   setNewTasksCount(prev => Math.max(0, (prev || 0) - 1))
          // }
          
          // Decrement counts
          setUnfilteredTotalCount(c => Math.max(0, c - 1))
          // Filtered count will be computed from filteredTasks useMemo
          
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
        initialComments={selectedTaskComments}
      />
      
      {/* New Task Modal - For creating new tasks */}
      <NewTaskModal
        client={{
          id: snapshot.partner.id,
          name: snapshot.partner.name,
          logoUrl: snapshot.partner.logo
        }}
        agencyMembers={sortedMembers}
        projects={projects}
        isOpen={isNewModalOpen}
        onClose={handleNewModalClose}
        onTaskOptimistic={handleTaskOptimistic}
        onTaskCreated={handleTaskCreated}
        connectionId={connectionId}
        currentOrgId={currentOrgId}
        variant={context.variant}
      />
    </>
  );
}


