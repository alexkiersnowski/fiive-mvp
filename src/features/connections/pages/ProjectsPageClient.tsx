'use client'

import { useState, useEffect, useRef, useCallback, useTransition, useMemo } from 'react'
import { createClient as createSupabaseBrowserClient } from '@/lib/supabase/client'
import { useRouter, usePathname } from 'next/navigation'
import { useConnection } from '../ConnectionContext';
import ProjectsTable from '../projects/ProjectsTable';
import { ProjectDetailModal } from '../projects/ProjectDetailModal'
import { NewProjectModal } from '../projects/NewProjectModal'
import type { Project, Comment } from '../server';
import { fetchProjectsForConnection, fetchProjectById, fetchCommentsForProject, fetchCommentsForProjects } from '../projects/actions';
import { isDev } from '../constants';
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
  const _router = useRouter()
  const pathname = usePathname()
  const baseRoute = pathname.includes('/clients/') ? 'clients' : 'agencies'
  
  // Get user avatar and organization from context
  const userAvatar = context.user?.avatarUrl || '';
  const userInitials = context.user?.firstName?.[0] + context.user?.lastName?.[0] || 'U';
  const currentOrgId = context.organization.id;

  // Store unfiltered data (all projects fetched upfront)
  const [allProjects, setAllProjects] = useState<Project[]>(initialProjects)
  
  // Unfiltered total count state (total projects for connection regardless of filters)
  const [unfilteredTotalCount, setUnfilteredTotalCount] = useState<number>(initialTotalCount)
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('')
  // Sort state
  const [sort, setSort] = useState<string>('project_asc')
  
  const parentRef = useRef<HTMLDivElement>(null)
  const [_isBootstrapping, _setIsBootstrapping] = useState<boolean>(false)
  
  // useTransition for non-urgent state updates (improves UI responsiveness)
  const [_isPending, startTransition] = useTransition()
  
  // Track if component is mounted to prevent state updates after unmount
  const isMountedRef = useRef(true)
  
  // Comments map keyed by projectId for instant lookup
  const [commentsByProject, setCommentsByProject] = useState<Record<string, Comment[]>>({})
  
  // Client-side filtering and sorting: filter allProjects based on searchQuery and sort
  const filteredAndSortedProjects = useMemo(() => {
    let result = allProjects
    
    // Filter by search query (name contains, case-insensitive)
    if (debouncedSearchQuery.trim().length > 0) {
      const query = debouncedSearchQuery.trim().toLowerCase()
      result = result.filter(project => 
        project.title.toLowerCase().includes(query)
      )
    }
    
    // Sort projects
    if (sort === 'project_asc') {
      // Sort A-Z by title
      result = [...result].sort((a, b) => 
        a.title.localeCompare(b.title)
      )
    } else if (sort === 'end_date_asc') {
      // Sort by end date (nulls last)
      result = [...result].sort((a, b) => {
        if (!a.endDate && !b.endDate) return 0
        if (!a.endDate) return 1
        if (!b.endDate) return -1
        return new Date(a.endDate).getTime() - new Date(b.endDate).getTime()
      })
    }
    
    return result
  }, [allProjects, debouncedSearchQuery, sort])
  
  // Update isEmpty in context when unfilteredTotalCount changes
  useEffect(() => {
    setIsEmpty(unfilteredTotalCount === 0 && !isBootstrapping)
  }, [unfilteredTotalCount, setIsEmpty])
  
  // DRY: refresh all projects (used by realtime fallback only - no filters)
  // Fetch ALL projects upfront for connection tables (no pagination, no filters)
  const refreshFirstPage = useCallback(async () => {
    try {
      const result = await fetchProjectsForConnection(connectionId, {
        limit: 10000, // High safety limit (10k max, way more than any connection needs)
        offset: 0
        // No filters - fetch all projects
      })
      if (!isMountedRef.current) return
      // Large state update - use transition for non-urgent render
      startTransition(() => {
        setAllProjects(result.projects)
        setUnfilteredTotalCount(result.totalCount)
      })
    } catch (_) {
      // ignore
    }
  }, [connectionId, startTransition])

  // DRY: prepend unique project by id (updates unfiltered data)
  const prependUnique = useCallback((project: Project) => {
    setAllProjects(prev => {
      if (prev.some(r => r.id === project.id)) return prev
      return [project, ...prev]
    })
    setUnfilteredTotalCount(c => c + 1)
  }, [])

  // DRY: remove by id, return whether something was removed (updates unfiltered data)
  const removeById = useCallback((id: string) => {
    let removed = false
    setAllProjects(prev => {
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
    }
  }, [])

  // Fetch comments for all projects on mount (all projects fetched upfront)
  useEffect(() => {
    const projectIds = allProjects.map(r => r.id)
    if (projectIds.length > 0) {
      fetchCommentsForProjects(projectIds)
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
  }, [allProjects]) // Include allProjects in dependencies

  // Debounce search query (150ms delay - industry standard for real-time client-side search)
  // Apply debounce only to the input value, not to filtering/rendering logic
  useEffect(() => {
    // If searchQuery hasn't changed from current debouncedSearchQuery, don't update
    if (searchQuery === debouncedSearchQuery) return
    
    const timeoutId = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery)
    }, 150)

    return () => clearTimeout(timeoutId)
  }, [searchQuery, debouncedSearchQuery]) // Include debouncedSearchQuery in dependencies

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
            
            // Add directly to unfiltered data - filtered view will update automatically
            prependUnique(proj)
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
          
          // Handle soft delete locally (updates unfiltered data)
          if (updated.deleted_at) {
            removeById(updated.id)
            return
          }
          
          // For non-delete updates, use targeted update (updates unfiltered data)
          try {
            const proj = await fetchProjectById(connectionId, updated.id)
            if (!proj) return
            
            // Update project in unfiltered data - filtered view will update automatically
            setAllProjects(prev => {
              const existingIndex = prev.findIndex((p: Project) => p.id === proj.id)
              if (existingIndex !== -1) {
                // Project exists - update it
                const next = [...prev]
                next[existingIndex] = proj
                return next
              } else {
                // Project not in list - add it
                return [...prev, proj]
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

  // Sort change handler (client-side filtering only)
  const handleSortChange = useCallback((newSort: string) => {
    setSort(newSort)
  }, [])

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
    return allProjects.find(p => p.id === projectId)
  }

  function handleProjectUpdate(projectId: string, updates: { title?: string; description?: string; status?: 'planned' | 'active' | 'on_hold' | 'completed' | 'canceled' }) {
    // Update unfiltered projects list optimistically
    setAllProjects(prevProjects =>
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
    // Optimistically remove project from unfiltered table
    setAllProjects(prev => prev.filter(p => p.id !== projectId))
    
    // Decrement total count
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

    setAllProjects(prev => [optimisticRow, ...prev])
    setUnfilteredTotalCount(c => c + 1)
  }, [connectionId, context.user, context.organization, snapshot.partner])

  async function handleProjectCreated({ projectId, tempId }: { projectId: string; tempId?: string }) {
    try {
      const proj = await fetchProjectById(connectionId, projectId)
      if (!proj) return
      // Replace temp row if present; otherwise prepend and increment count
      setAllProjects(prev => {
        const without = prev.filter(p => p.id !== tempId && p.id !== proj.id)
        return [proj, ...without]
      })
      // If no temp was present, bump the count; if temp existed, count already included
      if (!tempId) {
        setUnfilteredTotalCount(c => c + 1)
      }
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
        projects={filteredAndSortedProjects}
        agencyMembers={agencyMembers}
        onProjectUpdate={handleProjectUpdate}
        currentOrgId={currentOrgId}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        totalCount={filteredAndSortedProjects.length}
        unfilteredTotalCount={unfilteredTotalCount}
        parentRef={parentRef}
        isBootstrapping={false}
        isAgency={context.variant === 'agency'}
        agencyOrganization={context.variant === 'client' ? {
          id: snapshot.agency.id,
          name: snapshot.agency.name,
          logoUrl: snapshot.agency.logo || undefined
        } : undefined}
        onProjectDeleted={handleTableProjectDeleted}
        sortValue={sort}
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
          // Optimistically remove project from unfiltered table
          setAllProjects(prev => prev.filter(p => p.id !== projectId))
          
          // Decrement total count
          setUnfilteredTotalCount(c => Math.max(0, c - 1))
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

