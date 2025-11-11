'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { InlineEdit } from '@/components/ui/inline-edit'
import { RequestBadge } from '@/components/ui/request-badge'
import { StatusButton } from '@/components/ui/status-button'
import { ListRow } from '@/components/ui/list-row'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from '@/components/ui/command'
import { Check, CaretDown, DotsThree, FlowArrow, LinkSimple, Trash, LockSimple } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb'
import { CommentInput } from '@/components/ui/comment-input'
import { CommentItem } from '@/components/ui/comment-item'
import Link from 'next/link'
import { updateRequestTitle, updateRequestDescription, updateRequestStatus, updateRequestAssignee, updateRequestProject, deleteRequest, createComment, deleteComment, fetchCommentsForRequest, fetchProjectsForConnection } from './actions'
import { ConvertToTaskModal, type ConvertToTaskModalProps, type ConvertToTaskModalValues } from '../tasks/ConvertToTaskModal'
import { convertRequestToTask } from '../tasks/actions'
import { toast } from 'sonner'

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
  status?: 'new' | 'in_review' | 'accepted' | 'canceled'
  createdAt?: string
  mode?: 'modal' | 'page'
  onRequestUpdate?: (requestId: string, updates: { title?: string; description?: string; status?: 'new' | 'in_review' | 'accepted' | 'canceled'; assignee?: any; project?: { id: string; name: string } | null }) => void
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
    status?: 'new' | 'in_review' | 'accepted' | 'canceled'
    createdAt?: string
    createdByOrgId?: string
    createdByOrgType?: 'agency' | 'client'
  }) => void
}

type ConvertRequest = NonNullable<ConvertToTaskModalProps['request']>

export function RequestDetailContent({ requestId, title, description, client, agency, submittedBy, assignee, agencyMembers = [], projects: initialProjects = [], project, status = 'new', createdAt, mode = 'modal', onRequestUpdate, createdByOrgId, createdByOrgType, currentOrgId, connectionId, onRequestDeleted, partnerName, variant = 'agency', activeUser, initialComments = [], onCommentsUpdate, onConvertToTask }: RequestDetailContentProps) {
  const router = useRouter()
  const pathname = usePathname()
  
  // Determine base route for navigation
  const baseRoute = pathname?.startsWith('/agencies/') ? 'agencies' : 'clients'
  
  // Determine if the request is locked for editing based on view context and organization type
  // Agency view: locked if created by client
  // Client view: locked if created by agency
  const isLocked = (() => {
    if (!createdByOrgType) return false
    if (variant === 'agency') {
      return createdByOrgType === 'client'
    } else {
      return createdByOrgType === 'agency'
    }
  })()
  
  // Determine if current org can edit this request (based on lock status)
  const canEdit = !isLocked
  
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
  const getRequestStatusText = () => {
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
  }, [closeInternalConvertModal, connectionId, onRequestUpdate, requestId, router])

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
      // Add current project to list immediately if not already present
      setProjects(prev => {
        const exists = prev.some(p => p.id === project.id)
        if (exists) return prev
        return [{ id: project.id, name: project.name }, ...prev]
      })
    }
  }, [project])
  
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
    
    try {
      await updateRequestTitle(requestId, trimmedValue)
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
    
    try {
      await updateRequestDescription(requestId, value)
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
    
    try {
      await updateRequestProject(requestId, projectId === 'general' ? null : projectId)
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
    const validStatus = ['new', 'in_review', 'accepted', 'canceled'].includes(newStatus) 
      ? newStatus as 'new' | 'in_review' | 'accepted' | 'canceled'
      : 'new'
    
    // Optimistic update
    const previousStatus = statusValue
    setStatusValue(validStatus)
    setIsStatusDropdownOpen(false)
    
    // Update parent (table) optimistically
    if (onRequestUpdate) {
      onRequestUpdate(requestId, { status: validStatus })
    }
    
    try {
      await updateRequestStatus(requestId, validStatus)
      const statusLabels = {
        new: 'New',
        in_review: 'In review',
        accepted: 'Accepted',
        canceled: 'Canceled'
      }
      toast.success(`Status updated to ${statusLabels[validStatus]}`)
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
      
      try {
        await updateRequestAssignee(requestId, memberId)
        toast.success(`Assigned to ${selectedMember.firstName} ${selectedMember.lastName}`)
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
    
    try {
      await updateRequestAssignee(requestId, null)
      toast.success('Assignee removed')
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

  const statusOptions: { value: 'new' | 'in_review' | 'accepted' | 'canceled', label: string }[] = [
    { value: 'new', label: 'New' },
    { value: 'in_review', label: 'In review' },
    { value: 'accepted', label: 'Accepted' },
    { value: 'canceled', label: 'Canceled' }
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
                {isLocked && (
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
                        {variant === 'client' 
                          ? 'Created on your behalf. View and comment only.'
                          : 'You can update status and assignee only'
                        }
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
              {variant === 'agency' && (
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
              {!isLocked && (
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
                nonInteractive={!canEdit}
              />
            </div>
            {variant === 'agency' ? (
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
                            <RequestBadge variant={option.value as any} size="sm" showText />
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
              {canEdit ? (
                <InlineEdit
                  type="text"
                  value={descriptionValue}
                  onSave={handleDescriptionSave}
                  placeholder="Add description…"
                  textClass="text-md-regular"
                  multiline={true}
                  linkifyUrls={true}
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
            
            {/* Comment Input */}
            <CommentInput 
              activeUser={activeUser}
              onCommentSubmit={handleCommentSubmit}
            />

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
              />
            ))}
          </>
          </div>
        </div>
      </div>

      {/* 1px Divider */}
      <div className="w-px bg-neutral-alpha-4 flex-shrink-0 mb-10"/>

      {/* Right Column */}
      <div className="flex-[1] flex flex-col gap-2 flex-shrink-0 pl-8 mb-10">
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
            <div className="w-3/5 min-w-0">
              <ListRow 
                avatar={true}
                avatarUrl={variant === 'agency' ? (client?.logoUrl || null) : (agency?.logoUrl || null)}
                text={variant === 'agency' ? (client?.name || 'Unknown Client') : (agency?.name || 'Unknown Agency')}
                nonInteractive={true}
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
                  nonInteractive={true}
                />
              </div>
            </div>

          {/* Project Row */}
          <div className="flex items-center gap-4 h-6">
            <div className="w-2/5 min-w-0">
              <p className="text-sm-regular text-secondary truncate">Project</p>
            </div>
            <div className="w-3/5 min-w-0">
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
                nonInteractive={!canEdit}
              />
            </div>
          </div>

          {/* Created Row */}
          <div className="flex items-center gap-4 h-6">
            <div className="w-2/5 min-w-0">
              <p className="text-sm-regular text-secondary truncate">Created</p>
            </div>
            <div className="w-3/5 min-w-0">
              <p className="text-sm-regular text-primary truncate ml-1">{createdAt || 'N/A'}</p>
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
                  comboboxOptions={variant === 'agency' ? agencyMembers.map(member => ({
                    value: member.id,
                    label: `${member.firstName} ${member.lastName}`,
                    avatar: member.avatarUrl
                  })) : undefined}
                  comboboxPlaceholder={variant === 'agency' ? "Search members…" : undefined}
                  onComboboxSelect={variant === 'agency' ? handleAssigneeSelect : undefined}
                  clearable={variant === 'agency' ? !!assigneeValue : false}
                  onClear={variant === 'agency' ? handleClearAssignee : undefined}
                  borderRadius="4px"
                  nonInteractive={variant === 'client'}
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
    </>
  )
}

