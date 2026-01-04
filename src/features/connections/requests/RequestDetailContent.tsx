'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { InlineEdit } from '@/components/ui/inline-edit'
import { RequestBadge, type RequestVariant } from '@/components/ui/request-badge'
import type { Request } from '../server'
import { StatusButton } from '@/components/ui/status-button'
import { ListRow } from '@/components/ui/list-row'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from '@/components/ui/command'
import { Check, CaretDown, DotsThree, FlowArrow, LinkSimple, Trash, LockSimple, ArrowSquareOut } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbSeparator } from '@/components/ui/breadcrumb'
import { CommentInput } from '@/components/ui/comment-input'
import { CommentItem } from '@/components/ui/comment-item'
import { ProfileCard } from '@/components/ui/profile-card'
import Link from 'next/link'
import { deleteRequest, createComment, deleteComment, fetchCommentsForRequest, fetchProjectsForConnection, updateRequest } from './actions'
import { isOptimisticId, updateRequestLatestDraft, scheduleRequestFlush } from '../utils/optimisticTracker'
import { ConvertToTaskModal, type ConvertToTaskModalProps, type ConvertToTaskModalValues } from '../tasks/ConvertToTaskModal'
import { convertRequestToTask } from '../tasks/actions'
import { toast } from 'sonner'
import { formatRequestDateFullMonth } from '../formatters'

interface Comment {
  id: string
  userId: string
  userName: string
  userAvatar?: string
  createdAt: Date
  text: string
}

interface RequestDetailContentProps {
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
  agencyMembers?: Array<{
    id: string
    firstName: string
    lastName: string
    email: string
    avatarUrl?: string
    jobTitle?: string
  }>
  projects?: Array<{
    id: string
    name: string
  }>
  project?: {
    id: string
    name: string
  } | null
  status?: 'new' | 'in_review' | 'accepted' | 'canceled' | 'closed'
  createdAt?: string
  mode?: 'modal' | 'page'
  onRequestUpdate?: (requestId: string, updates: { title?: string; description?: string; status?: 'new' | 'in_review' | 'accepted' | 'canceled' | 'closed'; assignee?: Request['assignee']; project?: { id: string; name: string } | null }) => void
  createdByOrgId?: string
  createdByOrgType?: 'agency' | 'client'
  currentOrgId: string
  connectionId?: string
  onRequestDeleted?: (requestId: string) => void
  partnerName?: string // Name of the connected organization (for breadcrumbs)
  variant?: 'agency' | 'client'
  activeUser?: {
    id: string
    firstName: string
    lastName: string
    avatarUrl?: string
  }
  initialComments?: Comment[]
  onCommentsUpdate?: (comments: Comment[]) => void
  onConvertToTask?: (request: {
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
  }) => void
  isGlobalView?: boolean
  isDisconnected?: boolean
}

type ConvertRequest = NonNullable<ConvertToTaskModalProps['request']>

export function RequestDetailContent({ requestId, title, description, client, agency, submittedBy, assignee, agencyMembers = [], projects: initialProjects = [], project, status = 'new', createdAt, mode = 'modal', onRequestUpdate, createdByOrgId, createdByOrgType, currentOrgId: _currentOrgId, connectionId, onRequestDeleted, partnerName, variant = 'agency', activeUser, initialComments = [], onCommentsUpdate, onConvertToTask, isGlobalView: propIsGlobalView, isDisconnected = false }: RequestDetailContentProps) {
  const router = useRouter()
  const pathname = usePathname()
  
  // Determine base route for navigation
  const baseRoute = pathname?.startsWith('/agencies/') ? 'agencies' : 'clients'
  
  // Determine if we're in global requests view (not connection-specific)
  // Use prop if provided, otherwise check pathname
  const isGlobalView = propIsGlobalView ?? pathname?.startsWith('/requests')
  
  // Determine if this is a client-submitted request
  const isClientSubmitted = createdByOrgType === 'client'
  
  // Client permissions for client-submitted requests
  const canClientEditTitle = variant === 'client' && isClientSubmitted && status === 'new'
  const canClientEditDescription = variant === 'client' && isClientSubmitted && status === 'new'
  const canClientEditProject = variant === 'client' && isClientSubmitted && status === 'new'
  const canClientDelete = variant === 'client' && isClientSubmitted && status === 'new'
  
  // Agency permissions for client-submitted requests
  const canAgencyEditTitle = variant === 'agency' && !isClientSubmitted && !isDisconnected
  const canAgencyEditDescription = variant === 'agency' && !isClientSubmitted && !isDisconnected
  const canAgencyEditStatus = variant === 'agency' && !isDisconnected
  const canAgencyEditProject = variant === 'agency' && !isDisconnected
  const canAgencyEditAssignee = variant === 'agency' && !isDisconnected
  const canAgencyDelete = variant === 'agency' && !isClientSubmitted && !isDisconnected
  
  // Combined permissions
  const canEditTitle = variant === 'client' ? canClientEditTitle : canAgencyEditTitle
  const canEditDescription = variant === 'client' ? canClientEditDescription : canAgencyEditDescription
  const canEditProject = variant === 'client' ? canClientEditProject : canAgencyEditProject
  const canDelete = variant === 'client' ? canClientDelete : canAgencyDelete
  
  // Show lock icon only for client view when status !== 'new' for client-submitted requests
  const showLockIcon = variant === 'client' && isClientSubmitted && status !== 'new'
  
  // State for actions dropdown
  const [isActionsDropdownOpen, setIsActionsDropdownOpen] = useState(false)
  
  // Handle delete request (optimistic)
  const handleDeleteRequest = async () => {
    // Show success toast immediately
    toast.success('Request deleted')
    
    // Navigate back to requests list with deleted request ID in state
    // This allows the requests page to optimistically remove it
    if (connectionId) {
      router.push(`/${baseRoute}/${connectionId}/requests?deleted=${requestId}`)
    } else {
      router.back()
    }
    
    // Update table optimistically (in case we're in modal mode)
    onRequestDeleted?.(requestId)
    
    // Delete in background
    deleteRequest(requestId).catch((error) => {
      console.error('Error deleting request:', error)
      toast.error('Failed to delete request')
    })
  }
  
  // Handle copy link
  const handleCopyLink = () => {
    const fullUrl = `${window.location.origin}${pathname}`
    navigator.clipboard.writeText(fullUrl).then(() => {
      toast.success('Link copied to clipboard')
    }).catch(() => {
      toast.error('Failed to copy link')
    })
  }
  
  // Determine dialog title based on organization type that created the request
  const getDialogTitle = () => {
    if (!createdByOrgType) return 'Request'
    
    if (createdByOrgType === 'agency') {
      return variant === 'client' ? 'Request — Created by your agency' : 'Request — Agency created'
    } else {
      return variant === 'client' ? 'Request — Submitted to your agency' : 'Request — Client submitted'
    }
  }
  
  // Get just the status suffix (Submitted to your agency/Client submitted or Created by your agency/Agency created)
  const _getRequestStatusText = () => {
    if (!createdByOrgType) return ''
    
    if (createdByOrgType === 'agency') {
      return variant === 'client' ? 'Created by your agency' : 'Agency created'
    } else {
      return variant === 'client' ? 'Submitted to your agency' : 'Client submitted'
    }
  }
  
  const [titleValue, setTitleValue] = useState(title)
  const [descriptionValue, setDescriptionValue] = useState(description)
  const [statusValue, setStatusValue] = useState(status)
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false)
  const [requestProject, setRequestProject] = useState<{ id: string; name: string } | null>(project || null)
  const [titleResetKey, setTitleResetKey] = useState(0)
  const [assigneeValue, setAssigneeValue] = useState(assignee)
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>(initialProjects)
  
  const [comments, setComments] = useState<Comment[]>(initialComments)
  const [isConvertModalOpen, setIsConvertModalOpen] = useState(false)
  const [convertRequest, setConvertRequest] = useState<ConvertRequest | null>(null)
  const [profileDialogOpen, setProfileDialogOpen] = useState(false)
  const [selectedSubmitter, setSelectedSubmitter] = useState<{ id: string; first_name: string; last_name: string; email: string; avatar_url?: string; organization: { id: string; name: string; logo_url?: string } } | null>(null)
  
  const openInternalConvertModal = useCallback(() => {
    if (!connectionId) {
      toast.error('Unable to convert request: missing connection context')
      return
    }

    const payload: ConvertRequest = {
      requestId,
      title: titleValue,
      description: descriptionValue,
      client,
      agency,
      submittedBy: submittedBy
        ? {
            id: submittedBy.id,
            name: submittedBy.name,
            email: submittedBy.email,
            avatarUrl: submittedBy.avatarUrl,
          }
        : undefined,
      assignee: assigneeValue
        ? {
            id: assigneeValue.id,
            name: assigneeValue.name,
            email: assigneeValue.email,
            avatarUrl: assigneeValue.avatarUrl,
          }
        : null,
      project: requestProject ? { id: requestProject.id, name: requestProject.name } : null,
      createdAt,
      createdByOrgId,
      createdByOrgType,
    }

    setConvertRequest(payload)
    setIsConvertModalOpen(true)
  }, [
    agency,
    assigneeValue,
    client,
    createdAt,
    createdByOrgId,
    createdByOrgType,
    descriptionValue,
    requestId,
    requestProject,
    submittedBy,
    titleValue,
    connectionId,
  ])

  const closeInternalConvertModal = useCallback(() => {
    setIsConvertModalOpen(false)
    setTimeout(() => setConvertRequest(null), 250)
  }, [])

  const handleInternalConvertSubmit = useCallback(async (values: ConvertToTaskModalValues) => {
    if (!connectionId) {
      toast.error('Unable to convert request: missing connection context')
      return
    }

    try {
      await convertRequestToTask(values.requestId, {
        connectionId,
        title: values.title,
        description: values.description,
        status: values.status,
        projectId: values.project?.id ?? null,
        assigneeUserId: values.assignee?.id ?? null,
        dueDateRaw: values.dueDateRaw,
        clientVisible: values.clientVisible,
      })

      toast.success('Task created from request')
      setStatusValue('accepted')
      onRequestUpdate?.(requestId, { status: 'accepted' })
      closeInternalConvertModal()
      // Real-time subscription will handle UI updates
    } catch (error) {
      console.error('Failed to convert request to task:', error)
      toast.error('Failed to convert request')
    }
  }, [closeInternalConvertModal, connectionId, onRequestUpdate, requestId])

  const handleConvertClick = useCallback(() => {
    setIsActionsDropdownOpen(false)
    if (variant !== 'agency') return

    const payload = {
      requestId,
      title: titleValue,
      description: descriptionValue,
      client,
      agency,
      submittedBy,
      assignee: assigneeValue,
      project: requestProject,
      status: statusValue,
      createdAt,
      createdByOrgId,
      createdByOrgType,
    }

    if (onConvertToTask) {
      onConvertToTask(payload)
    } else {
      openInternalConvertModal()
    }
  }, [
    agency,
    assigneeValue,
    client,
    createdAt,
    createdByOrgId,
    createdByOrgType,
    descriptionValue,
    onConvertToTask,
    openInternalConvertModal,
    requestId,
    requestProject,
    statusValue,
    submittedBy,
    titleValue,
    variant,
  ])

  // Initialize projects list with current project if available (to prevent flicker)
  // and merge with initial projects from props
  useEffect(() => {
    if (project && project.id && project.name) {
      // Update or add current project to list
      setProjects(prev => {
        const existingIndex = prev.findIndex(p => p.id === project.id)
        if (existingIndex >= 0) {
          // Update existing project name if it changed
          const existing = prev[existingIndex]
          if (existing.name === project.name) {
            return prev // No change needed
          }
          const updated = [...prev]
          updated[existingIndex] = { id: project.id, name: project.name }
          return updated
        }
        // Add new project if not present
        return [{ id: project.id, name: project.name }, ...prev]
      })
    }
  }, [project])

  // Sync project prop when project ID changes (different request selected)
  // Event listener handles real-time name updates for the same project
  useEffect(() => {
    if (project && project.id && project.name) {
      setRequestProject((prev) => {
        // Update if project ID changed (different project) or if no previous state
        // Don't update if same project ID (event listener handles name updates)
        if (!prev || prev.id !== project.id) {
          return { id: project.id, name: project.name }
        }
        return prev // Keep existing state - event listener will update name if needed
      })
    } else {
      setRequestProject(null)
    }
  }, [project]) // Depend on entire project object
  
  // Update projects list when initialProjects prop changes (e.g., when modal opens with fresh data)
  useEffect(() => {
    if (initialProjects.length > 0) {
      setProjects(prev => {
        // Merge initial projects with existing, avoiding duplicates
        const existingIds = new Set(prev.map(p => p.id))
        const newProjects = initialProjects.filter(p => !existingIds.has(p.id))
        return [...prev, ...newProjects]
      })
    }
  }, [initialProjects])
  
  // Fallback: Fetch projects on mount if connectionId is available and no initial projects provided
  // This handles edge cases where projects weren't prefetched (e.g., direct navigation to detail page)
  useEffect(() => {
    if (connectionId && initialProjects.length === 0) {
      fetchProjectsForConnection(connectionId)
        .then(fetchedProjects => {
          // Merge with existing projects, avoiding duplicates
          setProjects(prev => {
            const existingIds = new Set(prev.map(p => p.id))
            const newProjects = fetchedProjects.filter(p => !existingIds.has(p.id))
            return [...prev, ...newProjects]
          })
        })
        .catch(error => {
          console.error('Error fetching projects:', error)
        })
    }
  }, [connectionId, initialProjects.length])
  
  // Handle comment submission with optimistic update
  const handleCommentSubmit = async (text: string) => {
    if (!activeUser) {
      toast.error('Unable to post comment: user information unavailable')
      return
    }
    
    // Create optimistic comment
    const tempId = `temp-${Date.now()}`
    const optimisticComment: Comment = {
      id: tempId,
      userId: activeUser.id,
      userName: `${activeUser.firstName} ${activeUser.lastName}`.trim() || 'You',
      userAvatar: activeUser.avatarUrl,
      createdAt: new Date(),
      text: text
    }
    
    // Optimistically add to top of comments list
    setComments(prev => [optimisticComment, ...prev])
    
    try {
      // Write to database
      await createComment(requestId, text)
      
      // Fetch fresh comments from DB to get properly formatted data (with profile joins)
      // This ensures the comment cache is updated with real DB data and replaces optimistic update
      try {
        const freshComments = await fetchCommentsForRequest(requestId)
        setComments(freshComments)
        // Update parent cache if callback provided (for modal mode)
        onCommentsUpdate?.(freshComments)
      } catch (error) {
        // If fetch fails, replace temp comment with real one from createComment result
        // This is a fallback - ideally we always fetch fresh to ensure consistency
        console.error('Error fetching fresh comments:', error)
        // Remove temp comment and let it be refetched on next load
        setComments(prev => prev.filter(comment => comment.id !== tempId))
      }
    } catch (error) {
      // Revert optimistic update on error
      setComments(prev => prev.filter(comment => comment.id !== tempId))
      toast.error('Failed to post comment. Please try again.')
      console.error('Error creating comment:', error)
    }
  }
  
  // Handle comment deletion with optimistic update
  const handleCommentDelete = async (commentId: string) => {
    // Optimistically remove from list
    const commentToDelete = comments.find(c => c.id === commentId)
    setComments(prev => prev.filter(comment => comment.id !== commentId))
    
    try {
      // Soft delete from database (sets deleted_at and updated_at)
      await deleteComment(commentId)
      // Show success message
      toast.success('Comment deleted successfully')
      
      // Fetch fresh comments from DB to update the cache
      try {
        const freshComments = await fetchCommentsForRequest(requestId)
        setComments(freshComments)
        // Update parent cache if callback provided (for modal mode)
        onCommentsUpdate?.(freshComments)
      } catch (error) {
        // If fetch fails, at least we've removed it optimistically
        console.error('Error fetching fresh comments after delete:', error)
      }
    } catch (error) {
      // Revert optimistic update on error
      if (commentToDelete) {
        setComments(prev => [commentToDelete, ...prev])
      }
      toast.error('Failed to delete comment. Please try again.')
      console.error('Error deleting comment:', error)
    }
  }
  
  // Sync assignee when prop changes (for table → modal updates)
  useEffect(() => {
    setAssigneeValue(assignee)
  }, [assignee])

  // Sync initialComments when they change (e.g., when navigating to different request in page mode or when prefetched)
  useEffect(() => {
    setComments(initialComments)
  }, [initialComments, mode])

  // Listen for project creation (e.g., when a new project is created in ProjectsCard)
  useEffect(() => {
    const handleProjectCreated = (event: CustomEvent) => {
      const { projectId, connectionId: eventConnectionId, title } = event.detail;
      
      if (process.env.NODE_ENV !== 'production') {
        console.log('[RequestDetailContent] Received projectCreated event:', { projectId, eventConnectionId, connectionId, title });
      }
      
      // Only handle events for this connection
      if (eventConnectionId !== connectionId) {
        if (process.env.NODE_ENV !== 'production') {
          console.log('[RequestDetailContent] Ignoring event - connectionId mismatch:', { eventConnectionId, connectionId });
        }
        return;
      }

      // Add new project to projects list (avoid duplicates)
      setProjects((prev) => {
        // Check if project already exists
        if (prev.some(p => p.id === projectId)) {
          return prev;
        }
        // Add new project to the list
        return [{ id: projectId, name: title }, ...prev];
      });
    };

    window.addEventListener('projectCreated', handleProjectCreated as EventListener);
    return () => {
      window.removeEventListener('projectCreated', handleProjectCreated as EventListener);
    };
  }, [connectionId]);

  // Listen for project updates (e.g., when project title is updated in ProjectDetailModal)
  useEffect(() => {
    const handleProjectUpdated = (event: CustomEvent) => {
      const { projectId, connectionId: eventConnectionId, title } = event.detail;
      
      if (process.env.NODE_ENV !== 'production') {
        console.log('[RequestDetailContent] Received projectUpdated event:', { projectId, eventConnectionId, connectionId, title });
      }
      
      // Only handle events for this connection
      if (eventConnectionId !== connectionId) {
        if (process.env.NODE_ENV !== 'production') {
          console.log('[RequestDetailContent] Ignoring event - connectionId mismatch:', { eventConnectionId, connectionId });
        }
        return;
      }

      // Update project name in projects list
      setProjects((prev) =>
        prev.map((p) => (p.id === projectId ? { ...p, name: title } : p))
      );

      // Update requestProject if it matches the updated project
      setRequestProject((prev) => {
        if (prev && prev.id === projectId) {
          return { ...prev, name: title };
        }
        return prev;
      });
    };

    window.addEventListener('projectUpdated', handleProjectUpdated as EventListener);
    return () => {
      window.removeEventListener('projectUpdated', handleProjectUpdated as EventListener);
    };
  }, [connectionId])
  
  // Track previous values for undo functionality
  const titleSnapshot = useRef(title)
  const descriptionSnapshot = useRef(description)
  const titleInputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null)
  const descriptionInputRef = useRef<HTMLTextAreaElement | null>(null)
  
  // Listen for focus events on title and description inputs to enable undo
  useEffect(() => {
    const handleFocus = (e: FocusEvent) => {
      const target = e.target as HTMLElement
      
      // Check if this is our title or description input
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        const isTitle = target.closest('[data-inline-edit="title"]')
        const isDescription = target.closest('[data-inline-edit="description"]')
        
        if (isTitle) {
          titleInputRef.current = target as HTMLInputElement | HTMLTextAreaElement
        } else if (isDescription) {
          descriptionInputRef.current = target as HTMLTextAreaElement
        }
      }
    }
    
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle when an input/textarea is focused
      const target = e.target as HTMLElement
      if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') return
      
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
      const modKey = isMac ? e.metaKey : e.ctrlKey
      
      // Cmd+Z / Ctrl+Z - Restore snapshot if this is first undo after re-focusing
      if (modKey && e.key === 'z' && !e.shiftKey) {
        const isTitle = target.closest('[data-inline-edit="title"]')
        const isDescription = target.closest('[data-inline-edit="description"]')
        
        // If current value matches what's in state and we have a different snapshot, restore it
        if (isTitle && titleInputRef.current === target) {
          const currentVal = (target as HTMLInputElement).value
          if (currentVal === titleValue && titleSnapshot.current !== titleValue) {
            e.preventDefault()
            const restoredValue = titleSnapshot.current
            setTitleValue(restoredValue)
            // Update the input value immediately
            ;(target as HTMLInputElement).value = restoredValue
            // Save to database immediately
            handleTitleSave(restoredValue)
            return
          }
        } else if (isDescription && descriptionInputRef.current === target) {
          const currentVal = (target as HTMLTextAreaElement).value
          if (currentVal === descriptionValue && descriptionSnapshot.current !== descriptionValue) {
            e.preventDefault()
            const restoredValue = descriptionSnapshot.current
            setDescriptionValue(restoredValue)
            // Update the textarea value immediately
            ;(target as HTMLTextAreaElement).value = restoredValue
            // Save to database immediately
            handleDescriptionSave(restoredValue)
            return
          }
        }
        // Otherwise, let browser's native undo handle it
      }
    }
    
    document.addEventListener('focusin', handleFocus, true)
    document.addEventListener('keydown', handleKeyDown, true)
    return () => {
      document.removeEventListener('focusin', handleFocus, true)
      document.removeEventListener('keydown', handleKeyDown, true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [titleValue, descriptionValue])

  const handleTitleSave = async (value: string) => {
    // Validation: Title cannot be empty
    const trimmedValue = value.trim()
    if (!trimmedValue) {
      // Force component reset by changing key
      setTitleResetKey(prev => prev + 1)
      // Show error toast
      const { toast } = await import('sonner')
      toast.error('Title cannot be empty')
      return
    }
    
    // Store snapshot before saving (for undo functionality)
    titleSnapshot.current = titleValue
    
    // Optimistic update
    const previousTitle = titleValue
    setTitleValue(trimmedValue)
    
    // Update parent (table) optimistically
    if (onRequestUpdate) {
      onRequestUpdate(requestId, { title: trimmedValue })
    }
    
    // Handle optimistic IDs
    if (isOptimisticId(requestId)) {
      // Track draft state and schedule flush
      updateRequestLatestDraft(requestId, { title: trimmedValue })
      scheduleRequestFlush(requestId, async (realId, draft) => {
        await updateRequest(realId, draft)
      })
      return // Success - no error, no await
    }
    
    // Defensive check: ensure requestId is not a tempId (should be caught by isOptimisticId above)
    if (isOptimisticId(requestId)) {
      console.error('[RequestDetailContent] tempId leak in handleTitleSave - isOptimisticId check failed!', { requestId })
      return
    }
    
    try {
      await updateRequest(requestId, { title: trimmedValue })
      // Real-time subscription will handle UI updates
    } catch (error) {
      console.error('Failed to update title:', error)
      // Revert optimistic update on error
      setTitleValue(previousTitle)
      if (onRequestUpdate) {
        onRequestUpdate(requestId, { title: previousTitle })
      }
    }
  }

  const handleDescriptionSave = async (value: string) => {
    // Store snapshot before saving (for undo functionality)
    descriptionSnapshot.current = descriptionValue
    
    // Optimistic update
    const previousDescription = descriptionValue
    setDescriptionValue(value)
    
    // Update parent (table) optimistically
    if (onRequestUpdate) {
      onRequestUpdate(requestId, { description: value })
    }
    
    // Handle optimistic IDs
    if (isOptimisticId(requestId)) {
      // Track draft state and schedule flush
      updateRequestLatestDraft(requestId, { description: value })
      scheduleRequestFlush(requestId, async (realId, draft) => {
        await updateRequest(realId, draft)
      })
      return // Success - no error, no await
    }
    
    // Defensive check: ensure requestId is not a tempId (should be caught by isOptimisticId above)
    if (isOptimisticId(requestId)) {
      console.error('[RequestDetailContent] tempId leak in handleDescriptionSave - isOptimisticId check failed!', { requestId })
      return
    }
    
    try {
      await updateRequest(requestId, { description: value })
      // Real-time subscription will handle UI updates
    } catch (error) {
      console.error('Failed to update description:', error)
      // Revert optimistic update on error
      setDescriptionValue(previousDescription)
      if (onRequestUpdate) {
        onRequestUpdate(requestId, { description: previousDescription })
      }
    }
  }

  const handleProjectSave = async (projectId: string) => {
    // Find the selected project from the fetched projects list
    const selectedProject = projectId === 'general' ? null : projects.find(p => p.id === projectId) || null
    
    // Optimistic update
    const previousProject = requestProject
    setRequestProject(selectedProject)
    
    // Update parent (table) optimistically
    if (onRequestUpdate) {
      onRequestUpdate(requestId, { project: selectedProject })
    }
    
    // Handle optimistic IDs
    if (isOptimisticId(requestId)) {
      // Track draft state and schedule flush
      updateRequestLatestDraft(requestId, { project_id: projectId === 'general' ? null : projectId })
      scheduleRequestFlush(requestId, async (realId, draft) => {
        await updateRequest(realId, draft)
      })
      return // Success - no error, no await
    }
    
    // Defensive check: ensure requestId is not a tempId (should be caught by isOptimisticId above)
    if (isOptimisticId(requestId)) {
      console.error('[RequestDetailContent] tempId leak in handleProjectSave - isOptimisticId check failed!', { requestId })
      return
    }
    
    try {
      await updateRequest(requestId, { project_id: projectId === 'general' ? null : projectId })
      // Real-time subscription will handle UI updates
    } catch (error) {
      console.error('Failed to update request project:', error)
      toast.error('Failed to update request project')
      // Revert optimistic update on error
      setRequestProject(previousProject)
      if (onRequestUpdate) {
        onRequestUpdate(requestId, { project: previousProject })
      }
    }
  }

  const handleStatusChange = async (newStatus: string) => {
    const validStatus = ['new', 'in_review', 'accepted', 'canceled', 'closed'].includes(newStatus) 
      ? newStatus as 'new' | 'in_review' | 'accepted' | 'canceled' | 'closed'
      : 'new'
    
    // Optimistic update
    const previousStatus = statusValue
    setStatusValue(validStatus)
    setIsStatusDropdownOpen(false)
    
    // Update parent (table) optimistically
    if (onRequestUpdate) {
      onRequestUpdate(requestId, { status: validStatus })
    }
    
    // Handle optimistic IDs
    if (isOptimisticId(requestId)) {
      // Track draft state and schedule flush
      updateRequestLatestDraft(requestId, { status: validStatus })
      scheduleRequestFlush(requestId, async (realId, draft) => {
        await updateRequest(realId, draft)
      })
      return // Success - no error, no await
    }
    
    // Defensive check: ensure requestId is not a tempId (should be caught by isOptimisticId above)
    if (isOptimisticId(requestId)) {
      console.error('[RequestDetailContent] tempId leak in handleStatusChange - isOptimisticId check failed!', { requestId })
      return
    }
    
    try {
      await updateRequest(requestId, { status: validStatus })
      // Real-time subscription will handle UI updates
    } catch (error) {
      console.error('Failed to update status:', error)
      toast.error('Failed to update status')
      // Revert optimistic update on error
      setStatusValue(previousStatus)
      if (onRequestUpdate) {
        onRequestUpdate(requestId, { status: previousStatus })
      }
    }
  }

  const handleAssigneeSelect = async (memberId: string) => {
    const selectedMember = agencyMembers.find(member => member.id === memberId)
    if (selectedMember) {
      const newAssignee = {
        id: memberId,
        name: `${selectedMember.firstName} ${selectedMember.lastName}`,
        email: selectedMember.email,
        avatarUrl: selectedMember.avatarUrl
      }
      
      // Optimistic update
      const previousAssignee = assigneeValue
      setAssigneeValue(newAssignee)
      
      // Update parent (table) optimistically
      if (onRequestUpdate) {
        onRequestUpdate(requestId, { assignee: newAssignee })
      }
      
      // Handle optimistic IDs
      if (isOptimisticId(requestId)) {
        // Track draft state and schedule flush
        updateRequestLatestDraft(requestId, { assignee_user_id: memberId })
        scheduleRequestFlush(requestId, async (realId, draft) => {
          await updateRequest(realId, draft)
        })
        return // Success - no error, no await
      }
      
      // Defensive check: ensure requestId is not a tempId (should be caught by isOptimisticId above)
      if (isOptimisticId(requestId)) {
        console.error('[RequestDetailContent] tempId leak in handleAssigneeSelect - isOptimisticId check failed!', { requestId })
        return
      }
      
      try {
        await updateRequest(requestId, { assignee_user_id: memberId })
        // Real-time subscription will handle UI updates
      } catch (error) {
        console.error('Failed to update assignee:', error)
        toast.error('Failed to update assignee')
        // Revert optimistic update on error
        setAssigneeValue(previousAssignee)
        if (onRequestUpdate) {
          onRequestUpdate(requestId, { assignee: previousAssignee })
        }
      }
    }
  }

  const handleClearAssignee = async () => {
    // Optimistic update
    const previousAssignee = assigneeValue
    setAssigneeValue(null)
    
    // Update parent (table) optimistically
    if (onRequestUpdate) {
      onRequestUpdate(requestId, { assignee: null })
    }
    
    // Handle optimistic IDs
    if (isOptimisticId(requestId)) {
      // Track draft state and schedule flush
      updateRequestLatestDraft(requestId, { assignee_user_id: null })
      scheduleRequestFlush(requestId, async (realId, draft) => {
        await updateRequest(realId, draft)
      })
      return // Success - no error, no await
    }
    
    // Defensive check: ensure requestId is not a tempId (should be caught by isOptimisticId above)
    if (isOptimisticId(requestId)) {
      console.error('[RequestDetailContent] tempId leak in handleClearAssignee - isOptimisticId check failed!', { requestId })
      return
    }
    
    try {
      await updateRequest(requestId, { assignee_user_id: null })
      // Real-time subscription will handle UI updates
    } catch (error) {
      console.error('Failed to clear assignee:', error)
      toast.error('Failed to clear assignee')
      // Revert optimistic update on error
      setAssigneeValue(previousAssignee)
      if (onRequestUpdate) {
        onRequestUpdate(requestId, { assignee: previousAssignee })
      }
    }
  }

  const handleSubmitterClick = () => {
    if (!submittedBy) return

    // Parse name into first_name and last_name
    const nameParts = submittedBy.name.trim().split(/\s+/)
    const first_name = nameParts[0] || ''
    const last_name = nameParts.slice(1).join(' ') || ''

    // Determine organization based on createdByOrgType
    const organization = createdByOrgType === 'client'
      ? { id: client?.id || '', name: client?.name || 'Unknown', logo_url: client?.logoUrl }
      : createdByOrgType === 'agency'
      ? { id: agency?.id || '', name: agency?.name || 'Unknown', logo_url: agency?.logoUrl }
      : { id: _currentOrgId, name: 'Unknown', logo_url: undefined }

    // Construct member object matching ProfileCard's interface
    const memberData = {
      id: submittedBy.id,
      first_name,
      last_name,
      email: submittedBy.email,
      avatar_url: submittedBy.avatarUrl,
      organization
    }

    setSelectedSubmitter(memberData)
    setProfileDialogOpen(true)
  }

  const statusOptions: { value: 'new' | 'in_review' | 'accepted' | 'canceled' | 'closed', label: string }[] = [
    { value: 'new', label: 'New' },
    { value: 'in_review', label: 'In review' },
    { value: 'accepted', label: 'Accepted' },
    { value: 'canceled', label: 'Canceled' },
    { value: 'closed', label: 'Closed' }
  ]

  return (
    <>
      <div className="flex flex-col gap-4 flex-1 min-h-0">
      {/* Breadcrumbs and Actions - only shown in page mode */}
      {mode === 'page' && (
        <>
          <div className="flex-shrink-0 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Breadcrumb>
                <BreadcrumbList style={{ fontSize: '12px' }}>
                  {connectionId && partnerName && (
                    <>
                      <BreadcrumbItem>
                        <BreadcrumbLink asChild>
                          <Link href={`/${baseRoute}/${connectionId}/overview`}>
                            {partnerName}
                          </Link>
                        </BreadcrumbLink>
                      </BreadcrumbItem>
                      <BreadcrumbSeparator />
                    </>
                  )}
                  {connectionId && (
                    <BreadcrumbItem>
                      <BreadcrumbLink asChild>
                        <Link href={`/${baseRoute}/${connectionId}/requests`}>
                          Requests
                        </Link>
                      </BreadcrumbLink>
                    </BreadcrumbItem>
                  )}
                </BreadcrumbList>
              </Breadcrumb>
              {/* Informational text - not part of breadcrumb */}
              <div className="flex items-center gap-2">
                <span className="text-[12px] leading-[20px] font-normal tracking-[0.0025rem]" style={{ color: 'var(--color-base-text-tertiary)' }}>
                  —
                </span>
                <span className="text-[12px] leading-[20px] font-normal tracking-[0.0025rem]" style={{ color: 'var(--color-base-text-tertiary)' }}>
                  {getDialogTitle().replace('Request — ', '')}
                </span>
                {showLockIcon && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center justify-center">
                        <LockSimple 
                          size={12} 
                          weight="fill"
                          style={{ color: 'var(--color-base-text-tertiary)' }}
                        />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" align="center" sideOffset={8}>
                      <div className="text-xs text-center">
                        Request is in progress. View and comment only.
                      </div>
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
            </div>
            <DropdownMenu modal={false} open={isActionsDropdownOpen} onOpenChange={setIsActionsDropdownOpen}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={`h-10 w-10 cursor-pointer transition-colors duration-75 rounded-md ${
                  isActionsDropdownOpen
                    ? 'bg-[var(--color-interactive-surface-hover)] hover:bg-[var(--color-interactive-surface-hover)]'
                    : 'hover:bg-[var(--color-interactive-surface-hover)]'
                }`}
              >
                <DotsThree className="w-[18px] h-[18px]" />
                <span className="sr-only">More options</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[200px]">
              {!isDisconnected && variant === 'agency' && (
                <DropdownMenuItem onClick={handleConvertClick}>
                  <FlowArrow size={16} style={{ color: 'var(--color-base-text-primary)' }} />
                  Convert to task
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => {
                handleCopyLink()
                setIsActionsDropdownOpen(false)
              }}>
                <LinkSimple size={16} style={{ color: 'var(--color-base-text-primary)' }} />
                Copy link
              </DropdownMenuItem>
              {canDelete && (
                <>
                  <div className="border-t border-[var(--color-neutral-6)] my-1" />
                  <DropdownMenuItem 
                    onClick={() => {
                      handleDeleteRequest()
                      setIsActionsDropdownOpen(false)
                    }}
                    style={{ color: 'var(--color-red-11)' }}
                  >
                    <Trash size={16} style={{ color: 'var(--color-red-11)' }} />
                    Delete request
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          </div>
        </>
      )}
      
      <div className="flex gap-0 flex-1 min-h-0">
      {/* Left Column / Main Content */}
      <div className="flex-[2] flex flex-col">
        {/* Title with Badge - Sticky */}
        <div className="flex-shrink-0 pb-4 pr-8">
          <div className="flex items-start gap-3">
            <div data-inline-edit="title" className="flex-1 min-w-0">
              <InlineEdit
                key={titleResetKey}
                type="text"
                value={titleValue}
                onSave={handleTitleSave}
                placeholder="Request title"
                textClass="display-7-medium text-primary"
                multiline={true}
                maxLength={255}
                preventNewLines={true}
                className="px-0"
                nonInteractive={!canEditTitle}
              />
            </div>
            {variant === 'agency' ? (
              isDisconnected ? (
                <StatusButton 
                  variant={statusValue} 
                  className="mt-1.5 pointer-events-none"
                >
                </StatusButton>
              ) : (
                <Popover open={isStatusDropdownOpen} onOpenChange={setIsStatusDropdownOpen}>
                  <PopoverTrigger asChild>
                    <StatusButton variant={statusValue} className="mt-1.5">
                      <CaretDown size={12} weight="fill" />
                    </StatusButton>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-full min-w-48 p-0"
                    align="start"
                    style={{ width: 'var(--radix-popover-trigger-width)' }}
                  >
                    <Command>
                      <CommandList>
                        <CommandEmpty>No status found.</CommandEmpty>
                        <CommandGroup>
                          {statusOptions.map((option) => (
                            <CommandItem
                              key={option.value}
                              value={option.value}
                              onSelect={() => handleStatusChange(option.value as string)}
                              className="flex items-center justify-between cursor-pointer"
                            >
                              <RequestBadge variant={option.value as RequestVariant} size="sm" showText />
                              {option.value === statusValue && (
                                <Check size={16} weight="bold" style={{ color: 'var(--color-interactive-neutral-default)' }} />
                              )}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              )
            ) : (
              <StatusButton 
                variant={statusValue} 
                className="mt-1.5 pointer-events-none"
                customLabel={statusValue === 'new' ? 'Submitted' : undefined}
              >
              </StatusButton>
            )}
          </div>
        </div>
        
        {/* Scrollable Content */}
        <div className="flex-1 overflow-auto min-h-0 pr-8 pb-10">
          <div className="flex flex-col gap-5">
            <div data-inline-edit="description">
              {canEditDescription ? (
                <InlineEdit
                  type="text"
                  value={descriptionValue}
                  onSave={handleDescriptionSave}
                  placeholder="Add description…"
                  textClass="text-md-regular"
                  multiline={true}
                  linkifyUrls={true}
                  maxLength={10000}
                  className="px-0"
                  style={{ fontSize: '15px', lineHeight: '22px' }}
                />
              ) : (
                <div
                  className="text-md-regular px-0 whitespace-pre-wrap"
                  style={{ fontSize: '15px', lineHeight: '22px' }}
                >
                  {descriptionValue.trim().length > 0 ? (
                    descriptionValue
                  ) : (
                    <span className="text-sm-regular text-secondary">No description</span>
                  )}
                </div>
              )}
            </div>

        {/* Divider */}
        <div className="w-full h-px bg-neutral-alpha-4 mt-5"></div>

        {/* Comments Section */}
        <>
          <h4 className="text-md-medium text-primary mt-5">Comments</h4>
            
            {/* Comment Input - Hide when disconnected */}
            {!isDisconnected && (
              <CommentInput 
                activeUser={activeUser}
                onCommentSubmit={handleCommentSubmit}
              />
            )}

            {/* Comments List */}
            {comments.map((comment) => (
              <CommentItem
                key={comment.id}
                id={comment.id}
                userName={comment.userName}
                userAvatar={comment.userAvatar}
                createdAt={comment.createdAt}
                text={comment.text}
                createdByUserId={comment.userId}
                activeUserId={activeUser?.id}
                onDelete={handleCommentDelete}
                hideActions={isDisconnected}
              />
            ))}
          </>
          </div>
        </div>
      </div>

      {/* 1px Divider */}
      <div className="w-px bg-neutral-alpha-4 flex-shrink-0 mb-10"/>

      {/* Right Column */}
      <div className="flex-[1] flex flex-col gap-2 min-w-0 pl-8 mb-10">
          <h3 className="text-md-medium text-primary">
          Details
        </h3>
        
        {/* Detail rows - 32px below title */}
        <div className="flex flex-col gap-2 mt-2">
          {/* Client/Agency Row */}
          <div className="flex items-center gap-4 h-6">
            <div className="w-2/5 min-w-0">
              <p className="text-sm-regular text-secondary truncate">
                {variant === 'agency' ? 'Client' : 'Agency'}
              </p>
            </div>
            <div className="w-3/5 min-w-0 group">
              <ListRow 
                avatar={true}
                avatarUrl={variant === 'agency' ? (client?.logoUrl || null) : (agency?.logoUrl || null)}
                text={variant === 'agency' ? (client?.name || 'Unknown Client') : (agency?.name || 'Unknown Agency')}
                nonInteractive={!(
                  isGlobalView && 
                  connectionId && 
                  ((variant === 'agency') || (variant === 'client'))
                )}
                onClick={isGlobalView && connectionId ? (
                  variant === 'agency' 
                    ? () => { window.location.href = `/clients/${connectionId}/overview`; }
                    : () => { window.location.href = `/agencies/${connectionId}/overview`; }
                ) : undefined}
                iconEnd={isGlobalView && connectionId ? (
                  <ArrowSquareOut 
                    size={16} 
                    className="opacity-0 group-hover:opacity-100 transition-opacity duration-75"
                    style={{ color: 'var(--color-base-text-tertiary)' }}
                  />
                ) : undefined}
              />
            </div>
          </div>

          {/* Submitted by Row */}
          <div className="flex items-center gap-4 h-6">
              <div className="w-2/5 min-w-0">
                <p className="text-sm-regular text-secondary truncate">Submitted by</p>
              </div>
              <div className="w-3/5 min-w-0">
                <ListRow 
                  avatar={true}
                  avatarUrl={submittedBy?.avatarUrl || null}
                  text={submittedBy?.name || 'Unknown User'}
                  nonInteractive={!submittedBy}
                  onClick={submittedBy ? handleSubmitterClick : undefined}
                />
              </div>
            </div>

          {/* Project Row */}
          <div className="flex items-center gap-4 h-6">
            <div className="w-2/5 min-w-0">
              <p className="text-sm-regular text-secondary truncate">Project</p>
            </div>
            <div className="w-3/5 min-w-0 max-w-full">
                <div className="min-w-0 max-w-full">
                  <InlineEdit
                    type="badge"
                    value={requestProject ? requestProject.id : 'general'}
                    options={[
                      { value: 'general', label: 'General request' },
                      ...projects.map(p => ({ value: p.id, label: p.name }))
                    ]}
                    onSave={handleProjectSave}
                    searchPlaceholder="Search projects…"
                    clearable={false}
                    dividerIndex={0}
                    placeholder="General request"
                    popoverWidth="240px"
                    badgeBorderRadius="4px"
                    maxHeight="210px"
                    className="h-6"
                  nonInteractive={!canEditProject}
                  />
                </div>
            </div>
          </div>

          {/* Created Row */}
          <div className="flex items-center gap-4 h-6">
            <div className="w-2/5 min-w-0">
              <p className="text-sm-regular text-secondary truncate">Created</p>
            </div>
            <div className="w-3/5 min-w-0">
              <p className="text-sm-regular text-primary truncate ml-1">{createdAt ? formatRequestDateFullMonth(createdAt) : 'N/A'}</p>
            </div>
          </div>

          {/* Owner Section */}
          <div className="flex flex-col gap-2 mt-8">
            <h4 className="text-md-medium text-primary">Agency owner</h4>
            
            {/* Assignee Row */}
            <div className="flex items-center gap-4 h-6 mt-2">
              <div className="w-2/5 min-w-0">
                <p className="text-sm-regular text-secondary truncate">
                  {variant === 'agency' ? 'Assignee' : 'Assigned to'}
                </p>
              </div>
              <div className="w-3/5 min-w-0">
                <ListRow
                  avatar={true}
                  avatarUrl={assigneeValue?.avatarUrl || null}
                  text={assigneeValue ? assigneeValue.name : 'Unassigned'}
                  textColor={assigneeValue ? 'var(--color-base-text-primary)' : 'var(--color-base-text-tertiary)'}
                  comboboxSelectedValue={assigneeValue?.id ?? null}
                  comboboxOptions={isDisconnected ? undefined : (variant === 'agency' ? agencyMembers.map(member => ({
                    value: member.id,
                    label: `${member.firstName} ${member.lastName}`,
                    avatar: member.avatarUrl
                  })) : undefined)}
                  comboboxPlaceholder={isDisconnected ? undefined : (variant === 'agency' ? "Search members…" : undefined)}
                  onComboboxSelect={isDisconnected ? undefined : (variant === 'agency' ? handleAssigneeSelect : undefined)}
                  clearable={isDisconnected ? false : (variant === 'agency' ? !!assigneeValue : false)}
                  onClear={isDisconnected ? undefined : (variant === 'agency' ? handleClearAssignee : undefined)}
                  borderRadius="4px"
                  nonInteractive={isDisconnected || variant === 'client'}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
      {!onConvertToTask && connectionId && (
        <ConvertToTaskModal
          isOpen={isConvertModalOpen}
          onClose={closeInternalConvertModal}
          onSubmit={handleInternalConvertSubmit}
          connectionId={connectionId}
          variant={variant}
          request={convertRequest}
          agencyMembers={agencyMembers}
          projects={projects}
        />
      )}
      {selectedSubmitter && (
        <ProfileCard
          member={selectedSubmitter}
          isOpen={profileDialogOpen}
          onClose={() => {
            setProfileDialogOpen(false)
            setSelectedSubmitter(null)
          }}
        />
      )}
    </>
  )
}

