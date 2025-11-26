'use client'

import { useState, useEffect, useRef, useCallback, useTransition, useMemo } from 'react'
import { createClient as createSupabaseBrowserClient } from '@/lib/supabase/client'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useConnection } from '../ConnectionContext';
import TasksTable from '../tasks/TasksTable';
import { TaskDetailModal } from '../tasks/TaskDetailModal'
import { NewTaskModal } from '../tasks/NewTaskModal'
import type { Task, Comment } from '../server';
import { fetchTasksForConnection, fetchTaskById, fetchCommentsForTasks } from '../tasks/actions';
import { sortTasksWithPinnedFirst, type TaskSortMode } from '../tasks/taskSort';
import { sortMembersWithActiveFirst, type MemberSummary } from '../utils/memberSorting';
import { PAGE_SIZE, PREFETCH_TIMEOUT_MS, isDev } from '../constants';
import type { VirtualItem } from '@tanstack/react-virtual';
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
  agencyMembers: MemberSummary[]
  projects: Array<{
    id: string
    name: string
  }>
  initialCommentsByTask?: Record<string, PrefetchedComment[]>
}

// Client component wrapper that handles all client-side interactivity
export default function TasksPageClient({ connectionId, initialTasks, initialTotalCount, agencyMembers, projects, initialCommentsByTask }: TasksPageClientProps) {
  const { snapshot, context, setIsEmpty } = useConnection();
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const baseRoute = pathname.includes('/clients/') ? 'clients' : 'agencies'
  // MVP: read assigned filter synchronously from URL before first fetch
  const initiallyAssigned = (() => {
    try { return searchParams.get('assigned') === 'me' } catch { return false }
  })()
  
  // Get user avatar and organization from context
  const userAvatar = context.variant === 'agency'
    ? context.user?.avatarUrl || ''
    : context.organization.logoUrl || '';

  const userInitials = context.variant === 'agency'
    ? (`${context.user?.firstName?.[0] || ''}${context.user?.lastName?.[0] || ''}`.trim() || 'U')
    : (context.organization.name ? context.organization.name.slice(0, 2).toUpperCase() : 'TM');
  const currentOrgId = context.organization.id;

  const sortMode: TaskSortMode = 'status'

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

  const unregisterPinnedTask = useCallback((taskId: string) => {
    pinnedTaskIdsRef.current.delete(taskId)
  }, [])

  const [tasks, setTasks] = useState<Task[]>(() => (initiallyAssigned ? [] : mergePinnedTasks(sortTasksWithPinnedFirst(initialTasks, sortMode))))

  const sortTasksWithMode = useCallback((items: Task[]): Task[] => (
    mergePinnedTasks(sortTasksWithPinnedFirst(items, sortMode))
  ), [mergePinnedTasks, sortMode])
  // Optimistic new tasks disabled (relying on real-time updates)
  
  // Total count state (filtered)
  const [totalCount, setTotalCount] = useState<number>(initiallyAssigned ? 0 : initialTotalCount)
  
  // Unfiltered total count state (total tasks for connection regardless of filters)
  const [unfilteredTotalCount, setUnfilteredTotalCount] = useState<number>(initialTotalCount)
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('')
  const [assignedToMe, setAssignedToMe] = useState<boolean>(initiallyAssigned)
  
  // Pagination state
  const [hasMore, setHasMore] = useState(initiallyAssigned ? true : initialTasks.length === PAGE_SIZE)
  const [currentOffset, setCurrentOffset] = useState(PAGE_SIZE)
  const parentRef = useRef<HTMLDivElement>(null)
  // Buffer initial empty render with skeleton when assigned=me
  const [isBootstrapping, setIsBootstrapping] = useState<boolean>(initiallyAssigned)
  
  // useTransition for non-urgent state updates (improves UI responsiveness)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_isPending, startTransition] = useTransition()
  
  // Loading state lock to prevent concurrent loadMore calls
  const isLoadingMore = useRef(false)
  
  // Prefetching state
  const [prefetchedTasks, setPrefetchedTasks] = useState<Task[]>([])
  const [prefetchedOffset, setPrefetchedOffset] = useState<number | null>(null)
  const [isPrefetching, setIsPrefetching] = useState(false)
  
  // Track in-flight tasks to prevent duplicates and enable cancellation
  const inFlightTasks = useRef<Set<number>>(new Set())
  
  // Track prefetch timeouts for cleanup
  const prefetchTimeouts = useRef<Map<number, NodeJS.Timeout>>(new Map())
  
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

  useEffect(() => {
    setTasks(prev => sortTasksWithMode(prev))
  }, [sortTasksWithMode])
  
  // Update isEmpty in context when unfilteredTotalCount changes
  // Note: unfilteredTotalCount is initialized from initialTotalCount (server-side), no need to refetch on mount
  useEffect(() => {
    setIsEmpty(unfilteredTotalCount === 0 && !isBootstrapping)
  }, [unfilteredTotalCount, isBootstrapping, setIsEmpty])
  
  // DRY: refresh first page (used by realtime fallback and deletes under search)
  const refreshFirstPage = useCallback(async () => {
    try {
      const result = await fetchTasksForConnection(connectionId, {
        limit: PAGE_SIZE,
        offset: 0,
        searchQuery: debouncedSearchQuery || undefined,
          assignedToUserId: assignedToMe && context.variant === 'agency' ? context.user?.id : undefined,
          assignedToUserIds: assignedToMe && context.variant === 'client' && clientTeamMemberIds.length > 0 ? clientTeamMemberIds : undefined,
        sortMode
      })
      if (!isMountedRef.current) return
      // Large state update - use transition for non-urgent render
      startTransition(() => {
        setTasks(sortTasksWithMode(result.tasks))
        setTotalCount(result.totalCount)
        setHasMore(result.tasks.length === PAGE_SIZE)
        setCurrentOffset(PAGE_SIZE)
        setPrefetchedTasks([])
        setPrefetchedOffset(null)
      })
    } catch (_) {
      // ignore
    }
  }, [connectionId, debouncedSearchQuery, assignedToMe, context.user?.id, context.variant, startTransition, sortTasksWithMode, clientTeamMemberIds])

  // DRY: prepend unique task by id
  const prependUnique = useCallback((task: Task) => {
    setTasks(prev => {
      const existingIndex = prev.findIndex(r => r.id === task.id)
      if (existingIndex !== -1) {
        const next = [...prev]
        const existingPinned = Boolean(next[existingIndex]?.isPinned)
        next[existingIndex] = existingPinned ? { ...task, isPinned: true } : task
        return sortTasksWithMode(next)
      }
      return sortTasksWithMode([...prev, task])
    })
  }, [sortTasksWithMode])

  // DRY: remove by id, return whether something was removed
  const removeById = useCallback((id: string) => {
    let removed = false
    setTasks(prev => {
      const exists = prev.some(r => r.id === id)
      if (!exists) return prev
      removed = true
      return prev.filter(r => r.id !== id)
    })
    return removed
  }, [])

  // Cleanup on unmount - cancel in-flight tasks and timeouts
  useEffect(() => {
    isMountedRef.current = true
    const inFlightTasksRef = inFlightTasks.current
    const prefetchTimeoutsRef = prefetchTimeouts.current
    return () => {
      isMountedRef.current = false
      inFlightTasksRef.clear()
      isLoadingMore.current = false
      // Clear all prefetch timeouts
      prefetchTimeoutsRef.forEach(timeout => clearTimeout(timeout))
      prefetchTimeoutsRef.clear()
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

  // Debounce search query (150ms delay for faster responsiveness)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery)
    }, 150)

    return () => clearTimeout(timeoutId)
  }, [searchQuery])

  // Track if this is the initial mount
  const isInitialMount = useRef(true)

  // One-time: fetch filtered results immediately on mount if assigned=me
  useEffect(() => {
    if (initiallyAssigned) {
      (async () => {
        try {
          const result = await fetchTasksForConnection(connectionId, {
            limit: PAGE_SIZE,
            offset: 0,
            searchQuery: debouncedSearchQuery || undefined,
            assignedToUserId: context.variant === 'agency' ? context.user?.id : undefined,
            assignedToUserIds: context.variant === 'client' && clientTeamMemberIds.length > 0 ? clientTeamMemberIds : undefined,
            sortMode
          })
          if (!isMountedRef.current) return
          setTasks(sortTasksWithMode(result.tasks))
          setTotalCount(result.totalCount)
          setHasMore(result.tasks.length === PAGE_SIZE)
          setCurrentOffset(PAGE_SIZE)
        } finally {
          setIsBootstrapping(false)
        }
      })()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Reset pagination and fetch new results when debounced search query or assignedToMe changes
  useEffect(() => {
    // Skip on initial mount if there's no search query and not assigned to me (we already have initialTasks)
    if (isInitialMount.current && !debouncedSearchQuery && !assignedToMe) {
      isInitialMount.current = false
      return
    }
    isInitialMount.current = false

    // Cancel all in-flight tasks
    inFlightTasks.current.clear()
    isLoadingMore.current = false
    // Clear all prefetch timeouts
    prefetchTimeouts.current.forEach(timeout => clearTimeout(timeout))
    prefetchTimeouts.current.clear()

    // Fetch new results with search query
    const fetchSearchResults = async () => {
      try {
        const result = await fetchTasksForConnection(connectionId, {
          limit: PAGE_SIZE,
          offset: 0,
          searchQuery: debouncedSearchQuery || undefined,
          assignedToUserId: assignedToMe && context.variant === 'agency' ? context.user?.id : undefined,
          assignedToUserIds: assignedToMe && context.variant === 'client' && clientTeamMemberIds.length > 0 ? clientTeamMemberIds : undefined,
          sortMode
        })

        if (isMountedRef.current) {
          // Large state update - use transition for non-urgent render
          startTransition(() => {
            setTasks(sortTasksWithMode(result.tasks))
            setTotalCount(result.totalCount)
            const newHasMore = result.tasks.length === PAGE_SIZE
            setHasMore(newHasMore)
            setCurrentOffset(PAGE_SIZE)
            setPrefetchedTasks([])
            setPrefetchedOffset(null)
          })
          
          // Prefetch comments for search results
          const newIds = result.tasks.map(r => r.id)
          if (newIds.length > 0) {
            fetchCommentsForTasks(newIds)
              .then(map => {
                if (isMountedRef.current) {
                  setCommentsByTask(prev => ({ ...prev, ...map }))
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
        }
      }
    }

    fetchSearchResults()
  }, [debouncedSearchQuery, connectionId, assignedToMe, context.user?.id, context.variant, sortTasksWithMode, startTransition, clientTeamMemberIds])
  
  // Prefetch next batch of tasks with timeout protection
  const prefetchNext = useCallback(async (offset: number) => {
    // Prevent duplicate tasks
    if (inFlightTasks.current.has(offset)) {
      if (isDev()) {
        console.log('[Prefetch] Task already in flight for offset:', offset)
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
    inFlightTasks.current.add(offset)
    
    if (isDev()) {
      console.log('[Prefetch] Starting prefetch for offset:', offset)
    }
    
    // Timeout to prevent stale prefetches
    const timeoutId = setTimeout(() => {
      // Double-check we still own this task and component is mounted
      if (isMountedRef.current && inFlightTasks.current.has(offset)) {
        if (isDev()) {
          console.log('[Prefetch] Prefetch timeout for offset:', offset)
        }
        inFlightTasks.current.delete(offset)
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
      const result = await fetchTasksForConnection(connectionId, { 
        limit: PAGE_SIZE, 
        offset,
        searchQuery: debouncedSearchQuery || undefined,
        assignedToUserId: assignedToMe && context.variant === 'agency' ? context.user?.id : undefined,
        assignedToUserIds: assignedToMe && context.variant === 'client' && clientTeamMemberIds.length > 0 ? clientTeamMemberIds : undefined,
        sortMode
      })
      
      // Clear timeout - only if we still own this task
      if (inFlightTasks.current.has(offset)) {
        const existingTimeout = prefetchTimeouts.current.get(offset)
        if (existingTimeout) {
          clearTimeout(existingTimeout)
          prefetchTimeouts.current.delete(offset)
        }
        
        if (isDev()) {
          console.log('[Prefetch] Prefetch completed', { count: result.tasks.length, offset })
        }
        
        // Only update state if component is still mounted and this task is still relevant
        if (isMountedRef.current && inFlightTasks.current.has(offset)) {
          // Store prefetched data - don't set hasMore here, let loadMore decide
          if (result.tasks.length > 0) {
            setPrefetchedTasks(sortTasksWithMode(result.tasks))
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
        console.error('Failed to prefetch tasks:', error)
      }
      // Silently fail - don't affect hasMore, let on-demand fetch handle it
    } finally {
      // Only update state if component is still mounted
      if (isMountedRef.current) {
        setIsPrefetching(false)
      }
      inFlightTasks.current.delete(offset)
    }
  }, [connectionId, hasMore, isPrefetching, debouncedSearchQuery, assignedToMe, context.user?.id, context.variant, sortMode, sortTasksWithMode, clientTeamMemberIds])

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
            
            // Server-side filtering handles search/assignee filters
            // If filters are active, refresh first page to get filtered results
            if (debouncedSearchQuery || assignedToMe) {
              await refreshFirstPage()
            } else {
              // No filters - add directly
              prependUnique(task)
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
        { event: 'UPDATE', schema: 'public', table: 'tasks', filter: `connection_id=eq.${connectionId}` },
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
          
          // For non-delete updates, refresh first page to ensure server-side filtering is applied
          // This ensures the task appears/disappears based on current filters
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
            
            // Refresh first page to apply server-side filtering
            await refreshFirstPage()
          } catch (_) {
            await refreshFirstPage()
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [connectionId, debouncedSearchQuery, assignedToMe, refreshFirstPage, prependUnique, removeById])

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
        setTasks(prev => mergeUniqueTasks(prev, prefetchedTasks))
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
      inFlightTasks.current.delete(prefetchedOffset)
      
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
    if (inFlightTasks.current.has(currentOffset)) {
      if (isDev()) {
        console.log('[LoadMore] Task for offset already in flight:', currentOffset)
      }
      return
    }
    
    isLoadingMore.current = true
    inFlightTasks.current.add(currentOffset)
    
    // Fallback: fetch on-demand if prefetch didn't complete in time
    if (isDev()) {
      console.log('[LoadMore] Fetching on-demand for offset:', currentOffset)
    }
    
    try {
      const result = await fetchTasksForConnection(connectionId, { 
        limit: PAGE_SIZE, 
        offset: currentOffset,
        searchQuery: debouncedSearchQuery || undefined,
        assignedToUserId: assignedToMe && context.variant === 'agency' ? context.user?.id : undefined,
        assignedToUserIds: assignedToMe && context.variant === 'client' && clientTeamMemberIds.length > 0 ? clientTeamMemberIds : undefined,
        sortMode
      })
      
      // Only update state if component is still mounted
      if (!isMountedRef.current) return
      
      if (result.tasks.length === 0) {
        if (isMountedRef.current) {
          setHasMore(false)
        }
      } else {
        if (isMountedRef.current) {
          setTasks(prev => mergeUniqueTasks(prev, result.tasks))
          setTotalCount(result.totalCount)
          const nextOffset = currentOffset + PAGE_SIZE
          setCurrentOffset(nextOffset)
          
          // Fetch comments for the new tasks
          const newIds = result.tasks.map(r => r.id)
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
            // Prefetch next batch
            prefetchNext(nextOffset)
          }
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
      inFlightTasks.current.delete(currentOffset)
    }
  }, [connectionId, hasMore, currentOffset, prefetchedTasks, prefetchedOffset, prefetchNext, debouncedSearchQuery, assignedToMe, context.user?.id, context.variant, sortMode, clientTeamMemberIds, mergeUniqueTasks])

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

  // Prefetch next batch when initial tasks load or after consuming prefetched data
  useEffect(() => {
    // Only prefetch if we have more data, aren't already prefetching, and don't already have prefetched data
    if (hasMore && !isPrefetching && prefetchedTasks.length === 0 && tasks.length > 0) {
      const offsetToPrefetch = currentOffset
      if (isDev()) {
        console.log('[Prefetch] Triggering prefetch for offset:', offsetToPrefetch)
      }
      prefetchNext(offsetToPrefetch)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMore, isPrefetching, prefetchedTasks.length, currentOffset, tasks.length])

  // Load more handler for virtual scroll
  const handleLoadMore = useCallback((virtualRows: VirtualItem[]) => {
    // Virtual scroll triggers loadMore in TasksTable based on scroll position
    // This handler is called when user scrolls near the end
            loadMore()
  }, [loadMore])

  // Handle optimistic deletion from query params (when navigating from detail page)
  useEffect(() => {
    const deletedTaskId = searchParams.get('deleted')
    if (deletedTaskId) {
      // Optimistically remove the deleted task
      setTasks(prev => prev.filter(r => r.id !== deletedTaskId))
      
      // Clean up the query param
      const newSearchParams = new URLSearchParams(searchParams.toString())
      newSearchParams.delete('deleted')
      const newUrl = `${pathname}${newSearchParams.toString() ? `?${newSearchParams.toString()}` : ''}`
      router.replace(newUrl, { scroll: false })
    }
  }, [searchParams, pathname, router])

  // Local state for modal (like ProfileCard pattern)
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

  function getTaskById(taskId: string) {
    return tasks.find(r => r.id === taskId)
  }

  function handleTaskUpdate(taskId: string, updates: { title?: string; description?: string; status?: 'to_do' | 'in_progress' | 'on_hold' | 'done'; assignee?: Task['assignee']; project?: { id: string; name: string } | null; dueDate?: string | null; dueDateRaw?: string | null; createdAtRaw?: string | null; clientVisible?: boolean; clientVisibilityLocked?: boolean }) {
    // Get the original task to compare status changes
    const originalTask = tasks.find(r => r.id === taskId)

    const sanitizedUpdates = Object.fromEntries(
      Object.entries(updates).filter(([, value]) => value !== undefined)
    ) as typeof updates
    
    // Update tasks list optimistically
    setTasks(prevTasks =>
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
    const deletedTask = tasks.find(r => r.id === taskId)
    
    // Optimistically remove task from table
    setTasks(prev => prev.filter(r => r.id !== taskId))
    
    // Update badge count if deleted task was 'new' status in agency view
    // TODO: Add newTasksCount support to ConnectionContext when needed
    // if (context.variant === 'agency' && deletedTask?.status === 'new') {
    //   setNewTasksCount(prev => Math.max(0, (prev || 0) - 1))
    // }
    
    // Decrement total count
    setTotalCount(c => Math.max(0, c - 1))
    setUnfilteredTotalCount(c => Math.max(0, c - 1))
  }

  function handleModalClose() {
    // Close modal first, then clear data after animation completes
    setIsModalOpen(false)
    // Small delay to let animation finish
    setTimeout(() => {
      setSelectedTask(null)
      setSelectedTaskComments([])
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

    setTasks(prev => sortTasksWithMode([optimisticRow, ...prev]))
    setTotalCount(c => c + 1)
    setUnfilteredTotalCount(c => c + 1)
    
    // Optimistically update badge count for agency view
    // TODO: Add newTasksCount support to ConnectionContext when needed
    // if (context.variant === 'agency') {
    //   setNewTasksCount(prev => (prev || 0) + 1)
    // }
    registerPinnedTask(payload.tempId)
  }, [connectionId, context.user, context.organization, snapshot.partner, sortTasksWithMode, sortedMembers, registerPinnedTask])

  async function handleTaskCreated({ taskId, tempId }: { taskId: string; tempId?: string }) {
    try {
      const task = await fetchTaskById(connectionId, taskId)
      if (!task) return
      // Replace temp row if present; otherwise prepend and increment count
      setTasks(prev => {
        const hadTemp = tempId ? prev.some(r => r.id === tempId) : false
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
      if (tempId) {
        // no-op for count
      } else {
        setTotalCount(c => c + 1)
        setUnfilteredTotalCount(c => c + 1)
      }
      
      // Update badge count if task is new and we're in agency view (only if no temp was present)
      // TODO: Add newTasksCount support to ConnectionContext when needed
      // if (!tempId && context.variant === 'agency' && task.status === 'new') {
      //   setNewTasksCount(prev => (prev || 0) + 1)
      // }
    } catch (error) {
      if (isDev()) {
        console.error('Failed to insert newly created task into table:', error)
      }
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
        tasks={tasks}
        agencyMembers={sortedMembers}
        onTaskUpdate={handleTaskUpdate}
        currentOrgId={currentOrgId}
          onLoadMore={handleLoadMore}
        onSearchChange={setSearchQuery}
        totalCount={totalCount}
        unfilteredTotalCount={unfilteredTotalCount}
          parentRef={parentRef}
        assignedToMe={assignedToMe}
        onToggleAssignedToMe={handleToggleAssignedToMe}
        isBootstrapping={isBootstrapping}
        isAgency={context.variant === 'agency'}
        agencyOrganization={context.variant === 'client' ? {
          id: snapshot.agency.id,
          name: snapshot.agency.name,
          logoUrl: snapshot.agency.logo || undefined
        } : undefined}
        onTaskDeleted={handleTableTaskDeleted}
        sortMode={sortMode}
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
          const deletedTask = tasks.find(r => r.id === taskId)
          
          // Optimistically remove task from table
          setTasks(prev => prev.filter(r => r.id !== taskId))
          
          // Update badge count if deleted task was 'new' status in agency view
          // TODO: Add newTasksCount support to ConnectionContext when needed
          // if (context.variant === 'agency' && deletedTask?.status === 'new') {
          //   setNewTasksCount(prev => Math.max(0, (prev || 0) - 1))
          // }
          
          // Decrement counts
          setTotalCount(c => Math.max(0, c - 1))
          setUnfilteredTotalCount(c => Math.max(0, c - 1))
          
          // Safety: reconcile with DB shortly after in case delete fails or is delayed
          setTimeout(async () => {
            try {
              const result = await fetchTasksForConnection(connectionId, {
                limit: PAGE_SIZE,
                offset: 0,
                searchQuery: debouncedSearchQuery || undefined,
                sortMode
              })
              if (!isMountedRef.current) return
              setTasks(sortTasksWithMode(result.tasks))
              setTotalCount(result.totalCount)
              setHasMore(result.tasks.length === PAGE_SIZE)
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


