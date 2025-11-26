'use client'

import { useState, useEffect, useRef, useCallback, useTransition } from 'react'
import { createClient as createSupabaseBrowserClient } from '@/lib/supabase/client'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useConnection } from '../ConnectionContext';
import ProjectsTable from '../projects/ProjectsTable';
import { ProjectDetailModal } from '../projects/ProjectDetailModal'
import { NewProjectModal } from '../projects/NewProjectModal'
import type { Project, Comment } from '../server';
import { fetchProjectsForConnection, fetchProjectById, fetchCommentsForProject, fetchCommentsForProjects } from '../projects/actions';
import { PAGE_SIZE, PREFETCH_TIMEOUT_MS, isDev } from '../constants';
import type { VirtualItem } from '@tanstack/react-virtual';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

interface ProjectsPageClientProps {
  connectionId: string
  initialProjects: Project[]
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
export default function ProjectsPageClient({ connectionId, initialProjects, initialTotalCount, agencyMembers }: ProjectsPageClientProps) {
  const { snapshot, context, setIsEmpty } = useConnection();
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const baseRoute = pathname.includes('/clients/') ? 'clients' : 'agencies'
  
  // MVP: read sort and search filters synchronously from URL before first fetch
  const initialSort = (() => {
    try { 
      const sortParam = searchParams.get('sort')
      // Validate sort value against allowed values
      const validSorts = ['newest_first', 'project_asc', 'project_desc', 'end_date_asc']
      return sortParam && validSorts.includes(sortParam) ? sortParam : 'newest_first'
    } catch { return 'newest_first' }
  })()
  
  const initialSearch = (() => {
    try {
      return searchParams.get('search') || ''
    } catch { return '' }
  })()
  
  // Get user avatar and organization from context
  const userAvatar = context.user?.avatarUrl || '';
  const userInitials = context.user?.firstName?.[0] + context.user?.lastName?.[0] || 'U';
  const currentOrgId = context.organization.id;

  // Local state for projects (for optimistic updates)
  const [projects, setProjects] = useState<Project[]>(initialProjects)
  // Optimistic new projects disabled (relying on real-time updates)
  
  // Total count state (filtered)
  const [totalCount, setTotalCount] = useState<number>(initialTotalCount)
  
  // Unfiltered total count state (total projects for connection regardless of filters)
  const [unfilteredTotalCount, setUnfilteredTotalCount] = useState<number>(initialTotalCount)
  
  // Search state
  const [searchQuery, setSearchQuery] = useState(initialSearch)
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(initialSearch)
  // Sort state
  const [sort, setSort] = useState<string>(initialSort)
  
  // Pagination state
  const [hasMore, setHasMore] = useState(initialProjects.length === PAGE_SIZE)
  const [currentOffset, setCurrentOffset] = useState(PAGE_SIZE)
  const parentRef = useRef<HTMLDivElement>(null)
  // Buffer initial empty render
  const isBootstrapping = false
  
  // useTransition for non-urgent state updates (improves UI responsiveness)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_isPending, startTransition] = useTransition()
  
  // Loading state lock to prevent concurrent loadMore calls
  const isLoadingMore = useRef(false)
  
  // Prefetching state
  const [prefetchedProjects, setPrefetchedProjects] = useState<Project[]>([])
  const [prefetchedOffset, setPrefetchedOffset] = useState<number | null>(null)
  const [isPrefetching, setIsPrefetching] = useState(false)
  
  // Track in-flight projects to prevent duplicates and enable cancellation
  const inFlightProjects = useRef<Set<number>>(new Set())
  
  // Track prefetch timeouts for cleanup
  const prefetchTimeouts = useRef<Map<number, NodeJS.Timeout>>(new Map())
  
  // Track if component is mounted to prevent state updates after unmount
  const isMountedRef = useRef(true)
  // no optimistic reconcile attempts (disabled)
  
  // Comments map keyed by projectId for instant lookup
  const [commentsByProject, setCommentsByProject] = useState<Record<string, Comment[]>>({})
  
  // Update isEmpty in context when unfilteredTotalCount changes
  // Note: unfilteredTotalCount is initialized from initialTotalCount (server-side), no need to refetch on mount
  useEffect(() => {
    setIsEmpty(unfilteredTotalCount === 0 && !isBootstrapping)
  }, [unfilteredTotalCount, isBootstrapping, setIsEmpty])
  
  // DRY: refresh first page (used by realtime fallback and deletes under search)
  const refreshFirstPage = useCallback(async () => {
    try {
      const result = await fetchProjectsForConnection(connectionId, {
        limit: PAGE_SIZE,
        offset: 0,
        searchQuery: debouncedSearchQuery || undefined,
        sort: sort
      })
      if (!isMountedRef.current) return
      // Large state update - use transition for non-urgent render
      startTransition(() => {
        setProjects(result.projects)
        setTotalCount(result.totalCount)
        setHasMore(result.projects.length === PAGE_SIZE)
        setCurrentOffset(PAGE_SIZE)
        setPrefetchedProjects([])
        setPrefetchedOffset(null)
      })
    } catch (_) {
      // ignore
    }
  }, [connectionId, debouncedSearchQuery, sort, startTransition])


  // DRY: prepend unique project by id
  const prependUnique = useCallback((project: Project) => {
    setProjects(prev => {
      if (prev.some(r => r.id === project.id)) return prev
      return [project, ...prev]
    })
  }, [])

  // DRY: remove by id, return whether something was removed
  const removeById = useCallback((id: string) => {
    let removed = false
    setProjects(prev => {
      const exists = prev.some(r => r.id === id)
      if (!exists) return prev
      removed = true
      return prev.filter(r => r.id !== id)
    })
    return removed
  }, [])

  // Cleanup on unmount - cancel in-flight projects and timeouts
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      inFlightProjects.current.clear()
      isLoadingMore.current = false
      // Clear all prefetch timeouts
      prefetchTimeouts.current.forEach(timeout => clearTimeout(timeout))
      prefetchTimeouts.current.clear()
    }
  }, [])

  // Fetch comments for initial projects on mount
  useEffect(() => {
    const initialIds = initialProjects.map(r => r.id)
    if (initialIds.length > 0) {
      fetchCommentsForProjects(initialIds)
        .then(map => {
          if (isMountedRef.current) {
            setCommentsByProject(map)
          }
        })
        .catch(error => {
          if (isDev()) {
            console.error('Error fetching initial comments:', error)
          }
        })
    }
  }, [initialProjects, fetchCommentsForProjects])

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

  // Track if this is the initial mount
  const isInitialMount = useRef(true)

  // Reset pagination and fetch new results when debounced search query or sort changes
  useEffect(() => {
    // Skip on initial mount if there's no search query and sort is default (we already have initialProjects)
    if (isInitialMount.current && !debouncedSearchQuery && sort === initialSort) {
      isInitialMount.current = false
      return
    }
    isInitialMount.current = false

    // Cancel all in-flight projects
    inFlightProjects.current.clear()
    isLoadingMore.current = false
    // Clear all prefetch timeouts
    prefetchTimeouts.current.forEach(timeout => clearTimeout(timeout))
    prefetchTimeouts.current.clear()

    // Fetch new results with search query
    const fetchSearchResults = async () => {
      try {
        const result = await fetchProjectsForConnection(connectionId, {
          limit: PAGE_SIZE,
          offset: 0,
          searchQuery: debouncedSearchQuery || undefined,
          sort: sort
        })

        if (isMountedRef.current) {
          // Large state update - use transition for non-urgent render
          startTransition(() => {
            setProjects(result.projects)
            setTotalCount(result.totalCount)
            const newHasMore = result.projects.length === PAGE_SIZE
            setHasMore(newHasMore)
            setCurrentOffset(PAGE_SIZE)
            setPrefetchedProjects([])
            setPrefetchedOffset(null)
          })
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
  }, [debouncedSearchQuery, connectionId, sort, initialSort, startTransition])
  
  // Prefetch next batch of projects with timeout protection
  const prefetchNext = useCallback(async (offset: number) => {
    // Prevent duplicate projects
    if (inFlightProjects.current.has(offset)) {
      if (isDev()) {
        console.log('[Prefetch] Project already in flight for offset:', offset)
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
    inFlightProjects.current.add(offset)
    
    if (isDev()) {
      console.log('[Prefetch] Starting prefetch for offset:', offset)
    }
    
    // Timeout to prevent stale prefetches
    const timeoutId = setTimeout(() => {
      // Double-check we still own this project and component is mounted
      if (isMountedRef.current && inFlightProjects.current.has(offset)) {
        if (isDev()) {
          console.log('[Prefetch] Prefetch timeout for offset:', offset)
        }
        inFlightProjects.current.delete(offset)
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
      const result = await fetchProjectsForConnection(connectionId, { 
        limit: PAGE_SIZE, 
        offset,
        searchQuery: debouncedSearchQuery || undefined,
        sort: sort
      })
      
      // Clear timeout - only if we still own this project
      if (inFlightProjects.current.has(offset)) {
        const existingTimeout = prefetchTimeouts.current.get(offset)
        if (existingTimeout) {
          clearTimeout(existingTimeout)
          prefetchTimeouts.current.delete(offset)
        }
        
        if (isDev()) {
          console.log('[Prefetch] Prefetch completed', { count: result.projects.length, offset })
        }
        
        // Only update state if component is still mounted and this project is still relevant
        if (isMountedRef.current && inFlightProjects.current.has(offset)) {
          // Store prefetched data - don't set hasMore here, let loadMore decide
          if (result.projects.length > 0) {
            setPrefetchedProjects(result.projects)
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
        console.error('Failed to prefetch projects:', error)
      }
      // Silently fail - don't affect hasMore, let on-demand fetch handle it
    } finally {
      // Only update state if component is still mounted
      if (isMountedRef.current) {
        setIsPrefetching(false)
      }
      inFlightProjects.current.delete(offset)
    }
  }, [connectionId, hasMore, isPrefetching, debouncedSearchQuery, sort])

  // Real-time: listen for inserts and updates (including soft-deletes)
  useEffect(() => {
    const supabase = createSupabaseBrowserClient()
    const channel = supabase
      .channel(`projects-insert-${connectionId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'projects', filter: `connection_id=eq.${connectionId}` },
        async (payload: RealtimePostgresChangesPayload<{ id: string; connection_id: string; title: string | null; status: string; created_at: string | null }>) => {
          const newId = (payload?.new as { id: string } | undefined)?.id
          if (!newId) return
          try {
            const proj = await fetchProjectById(connectionId, newId)
            if (!proj) return
            
            // If search is active, refresh first page to get filtered results
            if (debouncedSearchQuery) {
              await refreshFirstPage()
              setUnfilteredTotalCount(c => c + 1)
              return
            }
            
            prependUnique(proj)
            setTotalCount(c => c + 1)
            setUnfilteredTotalCount(c => c + 1)
          } catch (_) {
            // fallback to full refresh if single-row fetch fails
            await refreshFirstPage()
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'projects', filter: `connection_id=eq.${connectionId}` },
        async (payload: RealtimePostgresChangesPayload<{ id: string; connection_id: string; title: string | null; status: string; created_at: string | null; deleted_at: string | null }>) => {
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
          
          // For non-delete updates, refresh first page if search is active, otherwise update normally
          try {
            if (debouncedSearchQuery) {
              // Search is active - refresh to get filtered results
              await refreshFirstPage()
            } else {
              // No search active - update normally
              const proj = await fetchProjectById(connectionId, updated.id)
              if (!proj) return
              setProjects(prev => prev.map(p => (p.id === proj.id ? proj : p)))
            }
          } catch (_) {
            await refreshFirstPage()
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [connectionId, debouncedSearchQuery, refreshFirstPage, prependUnique, removeById])

  // Load more projects function (uses prefetched data if available)
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
        hasPrefetched: prefetchedProjects.length > 0, 
        prefetchedCount: prefetchedProjects.length,
        currentOffset 
      })
    }
    
    // If we have prefetched data, use it immediately (even if hasMore is false)
    if (prefetchedProjects.length > 0 && prefetchedOffset !== null) {
      isLoadingMore.current = true
      
      if (isDev()) {
        console.log('[LoadMore] Using prefetched data', prefetchedProjects.length, 'projects')
      }
      
      const prefetchedCount = prefetchedProjects.length
      const nextOffset = prefetchedOffset + PAGE_SIZE
      
      if (isMountedRef.current) {
        setProjects(prev => mergeUniqueById(prev, prefetchedProjects))
        setCurrentOffset(nextOffset)
      }
      
      // Fetch comments for the new projects
      const newIds = prefetchedProjects.map(r => r.id)
      if (newIds.length > 0) {
        fetchCommentsForProjects(newIds)
          .then(map => {
            if (isMountedRef.current) {
              setCommentsByProject(prev => ({ ...prev, ...map }))
            }
          })
          .catch(error => {
            if (isDev()) {
              console.error('Error fetching comments for prefetched projects:', error)
            }
          })
      }
      
      // Clear prefetched data
      setPrefetchedProjects([])
      setPrefetchedOffset(null)
      inFlightProjects.current.delete(prefetchedOffset)
      
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
    if (inFlightProjects.current.has(currentOffset)) {
      if (isDev()) {
        console.log('[LoadMore] Project for offset already in flight:', currentOffset)
      }
      return
    }
    
    isLoadingMore.current = true
    inFlightProjects.current.add(currentOffset)
    
    // Fallback: fetch on-demand if prefetch didn't complete in time
    if (isDev()) {
      console.log('[LoadMore] Fetching on-demand for offset:', currentOffset)
    }
    
    try {
      const result = await fetchProjectsForConnection(connectionId, { 
        limit: PAGE_SIZE, 
        offset: currentOffset,
        searchQuery: debouncedSearchQuery || undefined,
        sort
      })
      
      // Only update state if component is still mounted
      if (!isMountedRef.current) return
      
      if (result.projects.length === 0) {
        if (isMountedRef.current) {
          setHasMore(false)
        }
      } else {
        if (isMountedRef.current) {
          setProjects(prev => mergeUniqueById(prev, result.projects))
          setTotalCount(result.totalCount)
          const nextOffset = currentOffset + PAGE_SIZE
          setCurrentOffset(nextOffset)
          
          // Fetch comments for the new projects
          const newIds = result.projects.map(r => r.id)
          if (newIds.length > 0) {
            fetchCommentsForProjects(newIds)
              .then(map => {
                if (isMountedRef.current) {
                  setCommentsByProject(prev => ({ ...prev, ...map }))
                }
              })
              .catch(error => {
                if (isDev()) {
                  console.error('Error fetching comments for on-demand projects:', error)
                }
              })
          }
          
          // If we got fewer than PAGE_SIZE, there are no more
          if (result.projects.length < PAGE_SIZE) {
            setHasMore(false)
          } else {
            // Prefetch next batch
            prefetchNext(nextOffset)
          }
        }
      }
    } catch (error) {
      if (isDev()) {
        console.error('Failed to load more projects:', error)
      }
      // Only update hasMore if component is still mounted
      if (isMountedRef.current) {
        setHasMore(false) // Stop trying if we get an error
      }
    } finally {
      isLoadingMore.current = false
      inFlightProjects.current.delete(currentOffset)
    }
  }, [connectionId, hasMore, currentOffset, prefetchedProjects, prefetchedOffset, prefetchNext, debouncedSearchQuery, sort])

  // Sort change handler and URL sync
  const handleSortChange = useCallback((newSort: string) => {
    setSort(newSort)
    // Update URL - the fetch useEffect will handle the actual fetch when sort state changes
    const newSearchParams = new URLSearchParams(searchParams.toString())
    if (newSort !== 'newest_first') {
      newSearchParams.set('sort', newSort)
    } else {
      newSearchParams.delete('sort')
    }
    const newUrl = `${pathname}${newSearchParams.toString() ? `?${newSearchParams.toString()}` : ''}`
    router.replace(newUrl, { scroll: false })
  }, [searchParams, pathname, router])

  // Prefetch next batch when initial projects load or after consuming prefetched data
  useEffect(() => {
    // Only prefetch if we have more data, aren't already prefetching, and don't already have prefetched data
    if (hasMore && !isPrefetching && prefetchedProjects.length === 0 && projects.length > 0) {
      const offsetToPrefetch = currentOffset
      if (isDev()) {
        console.log('[Prefetch] Triggering prefetch for offset:', offsetToPrefetch)
      }
      prefetchNext(offsetToPrefetch)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMore, isPrefetching, prefetchedProjects.length, currentOffset, projects.length])

  // Load more handler for virtual scroll
  const handleLoadMore = useCallback((virtualRows: VirtualItem[]) => {
    // Virtual scroll triggers loadMore in ProjectsTable based on scroll position
    // This handler is called when user scrolls near the end
            loadMore()
  }, [loadMore])

  // Handle optimistic deletion from query params (when navigating from detail page)
  useEffect(() => {
    const deletedProjectId = searchParams.get('deleted')
    if (deletedProjectId) {
      // Optimistically remove the deleted project
      setProjects(prev => prev.filter(r => r.id !== deletedProjectId))
      
      // Clean up the query param
      const newSearchParams = new URLSearchParams(searchParams.toString())
      newSearchParams.delete('deleted')
      const newUrl = `${pathname}${newSearchParams.toString() ? `?${newSearchParams.toString()}` : ''}`
      router.replace(newUrl, { scroll: false })
    }
  }, [searchParams, pathname, router])

  // Local state for modal (like ProfileCard pattern)
  const [selectedProject, setSelectedProject] = useState<{
    projectId: string
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
    type?: string | null
    status?: 'planned' | 'active' | 'on_hold' | 'completed' | 'canceled'
    startDate?: string
    endDate?: string
    createdAt?: string
    requestsCount?: number
    tasksCount?: number
    createdByOrgId?: string
    createdByOrgType?: 'agency' | 'client'
  } | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isNewModalOpen, setIsNewModalOpen] = useState(false)
  const [selectedProjectComments, setSelectedProjectComments] = useState<Array<{
    id: string
    userId: string
    userName: string
    userAvatar?: string
    createdAt: Date
    text: string
  }>>([])

  function getProjectById(projectId: string) {
    return projects.find(p => p.id === projectId)
  }

  function handleProjectUpdate(projectId: string, updates: { title?: string; description?: string; status?: 'planned' | 'active' | 'on_hold' | 'completed' | 'canceled' }) {
    // Get the original project to compare status changes
    const originalProject = projects.find(p => p.id === projectId)
    
    // Update projects list optimistically
    setProjects(prevProjects =>
        prevProjects.map(proj =>
          proj.id === projectId
          ? { ...proj, ...updates }
          : proj
      )
    )

    // Also update selectedProject if it's the current one
    setSelectedProject(prev => 
      prev && prev.projectId === projectId
        ? { ...prev, ...updates }
        : prev
    )
    
    // Projects don't track "new" status like requests do - badge count logic removed
  }

  function handleRowClick(projectId: string) {
    const project = getProjectById(projectId)
    if (project) {
      // Get comments from pre-fetched map (instant, no fetch)
      const comments = commentsByProject[projectId] ?? []
      
      // Optional fallback: if comments not found in cache (edge case), lazy-load that one project
      if (!(projectId in commentsByProject)) {
        // Comments not in cache yet (edge case), fetch just this one
        fetchCommentsForProject(projectId)
          .then(fetchedComments => {
            if (isMountedRef.current) {
              setCommentsByProject(prev => ({ ...prev, [projectId]: fetchedComments }))
              setSelectedProjectComments(fetchedComments)
            }
          })
          .catch(() => {
            // Keep empty array on error
            if (isMountedRef.current) {
              setSelectedProjectComments([])
            }
          })
      }
      
      // Open modal immediately with project data and comments
      setSelectedProject({
        projectId: project.id,
        title: project.title,
        description: project.description,
        client: project.client,
        agency: project.agency,
        submittedBy: project.submittedBy,
        assignee: project.assignee,
        type: project.type,
        status: project.status,
        startDate: project.startDate,
        endDate: project.endDate,
        createdAt: project.createdAt,
        requestsCount: project.requestsCount,
        tasksCount: project.tasksCount,
        createdByOrgId: project.createdByOrgId,
        createdByOrgType: project.createdByOrgType
      })
      setSelectedProjectComments(comments)
      setIsModalOpen(true)
    }
  }

  function handleTableProjectDeleted(projectId: string) {
    // Get the deleted project to check if it was 'new' status
    const deletedProject = projects.find(p => p.id === projectId)
    
    // Optimistically remove project from table
    setProjects(prev => prev.filter(p => p.id !== projectId))
    
    // Projects don't track "new" status - badge count logic removed
    
    // Decrement total count
    setTotalCount(c => Math.max(0, c - 1))
    setUnfilteredTotalCount(c => Math.max(0, c - 1))
  }

  function handleModalClose() {
    // Close modal first, then clear data after animation completes
    setIsModalOpen(false)
    // Small delay to let animation finish
    setTimeout(() => {
      setSelectedProject(null)
      setSelectedProjectComments([])
    }, 300)
  }

  function handleNewProject() {
    setIsNewModalOpen(true)
  }
  
  function handleNewModalClose() {
    setIsNewModalOpen(false)
  }

  function handleExpand() {
    // Navigate to full page
    if (selectedProject && selectedProject.projectId !== 'new') {
      const url = `/${baseRoute}/${connectionId}/projects/${selectedProject.projectId}`
      window.location.href = url
    }
  }

  // Optimistic add: show a temporary row immediately
  const handleProjectOptimistic = useCallback((payload: {
    tempId: string
    title: string
    description: string
    type: string | null
    assigneeUserId: string | null
    startDate: string
    endDate: string
  }) => {
    const today = (() => {
      const d = new Date()
      const day = d.getDate()
      const month = d.toLocaleDateString('en-US', { month: 'short' })
      const year = d.getFullYear()
      return `${day} ${month} ${year}`
    })()

    const optimisticRow: Project = {
      id: payload.tempId,
      connectionId,
      title: payload.title,
      description: payload.description || '',
      status: 'planned',
      type: payload.type,
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
      startDate: payload.startDate || '',
      endDate: payload.endDate || '',
      createdAt: today,
      requestsCount: 0,
      tasksCount: 0,
      createdByOrgId: context.organization.id,
    }

    setProjects(prev => [optimisticRow, ...prev])
    setTotalCount(c => c + 1)
    setUnfilteredTotalCount(c => c + 1)
    
    // Projects don't track "new" status - badge count logic removed
  }, [connectionId, context.user, context.organization, snapshot.partner, context.variant])

  async function handleProjectCreated({ projectId, tempId }: { projectId: string; tempId?: string }) {
    try {
      const proj = await fetchProjectById(connectionId, projectId)
      if (!proj) return
      // Replace temp row if present; otherwise prepend and increment count
      setProjects(prev => {
        const hadTemp = tempId ? prev.some(p => p.id === tempId) : false
        const without = prev.filter(p => p.id !== tempId && p.id !== proj.id)
        const next = [proj, ...without]
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
      
      // Projects don't track "new" status - badge count logic removed
    } catch (error) {
      if (isDev()) {
        console.error('Failed to insert newly created project into table:', error)
      }
    }
  }

  // No optimistic display merge; show server-backed list only

  return (
    <>
      {/* Projects Table */}
      <div ref={parentRef}>
      <ProjectsTable
        userAvatar={userAvatar}
        userInitials={userInitials}
        onProjectClick={handleRowClick}
        onNewProject={handleNewProject}
        projects={projects}
        agencyMembers={agencyMembers}
        onProjectUpdate={handleProjectUpdate}
        currentOrgId={currentOrgId}
        onLoadMore={handleLoadMore}
        onSearchChange={setSearchQuery}
        totalCount={totalCount}
        unfilteredTotalCount={unfilteredTotalCount}
        parentRef={parentRef}
        isBootstrapping={isBootstrapping}
        isSearching={searchQuery.trim() !== debouncedSearchQuery.trim()}
        isAgency={context.variant === 'agency'}
        agencyOrganization={context.variant === 'client' ? {
          id: snapshot.agency.id,
          name: snapshot.agency.name,
          logoUrl: snapshot.agency.logo || undefined
        } : undefined}
        onProjectDeleted={handleTableProjectDeleted}
        initialSortValue={sort}
        onSortChange={handleSortChange}
      />
      </div>

      {/* Project Detail Modal - For existing projects */}
      <ProjectDetailModal
        projectData={selectedProject}
        agencyMembers={agencyMembers}
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onExpand={handleExpand}
        onProjectUpdate={handleProjectUpdate}
        onCommentsUpdate={(comments) => {
          // Update comments cache when comments are created/deleted in modal
          if (selectedProject?.projectId) {
            setCommentsByProject(prev => ({
              ...prev,
              [selectedProject.projectId]: comments
            }))
            // Also update selectedProjectComments so modal shows updated comments immediately
            setSelectedProjectComments(comments)
          }
        }}
        onProjectDeleted={(projectId) => {
          // Get the deleted project to check if it was 'new' status
          const deletedProject = projects.find(p => p.id === projectId)
          
          // Optimistically remove project from table
          setProjects(prev => prev.filter(p => p.id !== projectId))
          
          // Projects don't track "new" status - badge count logic removed
          
          // Decrement counts
          setTotalCount(c => Math.max(0, c - 1))
          setUnfilteredTotalCount(c => Math.max(0, c - 1))
          
          // Safety: reconcile with DB shortly after in case delete fails or is delayed
          setTimeout(async () => {
            try {
              const result = await fetchProjectsForConnection(connectionId, {
                limit: PAGE_SIZE,
                offset: 0,
                searchQuery: debouncedSearchQuery || undefined,
                sort: sort
              })
              if (!isMountedRef.current) return
              setProjects(result.projects)
              setTotalCount(result.totalCount)
              setHasMore(result.projects.length === PAGE_SIZE)
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
        initialComments={selectedProjectComments}
      />
      
      {/* New Project Modal - For creating new projects */}
      <NewProjectModal
        client={{
          id: snapshot.partner.id,
          name: snapshot.partner.name,
          logoUrl: snapshot.partner.logo
        }}
        agencyMembers={agencyMembers}
        isOpen={isNewModalOpen}
        onClose={handleNewModalClose}
        onProjectOptimistic={handleProjectOptimistic}
        onProjectCreated={handleProjectCreated}
        connectionId={connectionId}
        currentOrgId={currentOrgId}
        variant={context.variant}
      />
    </>
  );
}

