'use client'

import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { parse, format } from 'date-fns'
import { InlineEdit } from '@/components/ui/inline-edit'
import { TaskBadge } from '@/components/ui/task-badge'
import { TaskStatusButton } from '@/components/ui/task-status-button'
import { ListRow } from '@/components/ui/list-row'
import { Switch } from '@/components/ui/switch'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from '@/components/ui/command'
import { Check, CaretDown, DotsThree, LinkSimple, Trash, Eye, EyeSlash, ChatCentered, ArrowSquareOut } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbSeparator } from '@/components/ui/breadcrumb'
import { CommentInput } from '@/components/ui/comment-input'
import { CommentItem } from '@/components/ui/comment-item'
import Link from 'next/link'
import { updateTaskTitle, updateTaskDescription, updateTaskStatus, updateTaskAssignee, updateTaskProject, updateTaskDueDate, updateTaskClientVisible, deleteTask, createComment, deleteComment, fetchCommentsForTask, fetchProjectsForConnection } from './actions'
import { toast } from 'sonner'
import type { Task } from '../server'

interface Comment {
  id: string
  userId: string
  userName: string
  userAvatar?: string
  createdAt: Date
  text: string
}

interface TaskDetailContentProps {
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
  agencyMembers?: Array<{
    id: string
    firstName: string
    lastName: string
    email: string
    avatarUrl?: string
    jobTitle?: string
    orgId?: string
    orgName?: string
    orgType?: 'agency' | 'client'
  }>
  projects?: Array<{
    id: string
    name: string
  }>
  project?: {
    id: string
    name: string
  } | null
  status?: 'to_do' | 'in_progress' | 'on_hold' | 'done'
  dueDate?: string | null
  dueDateRaw?: string | null
  createdAt?: string
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
  mode?: 'modal' | 'page'
  onTaskUpdate?: (taskId: string, updates: { title?: string; description?: string; status?: 'to_do' | 'in_progress' | 'on_hold' | 'done'; assignee?: Task['assignee']; project?: { id: string; name: string } | null; dueDate?: string | null; dueDateRaw?: string | null; clientVisible?: boolean; clientVisibilityLocked?: boolean }) => void
  createdByOrgId?: string
  createdByOrgType?: 'agency' | 'client'
  currentOrgId: string
  connectionId?: string
  onTaskDeleted?: (taskId: string) => void
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
  onContactClick?: (contact: {
    id: string
    first_name: string
    last_name: string
    email: string
    avatar_url: string
    job_title?: string
    organization?: {
      id: string
      name: string
      logo_url: string
    }
  }) => void
  isGlobalView?: boolean
  isDisconnected?: boolean
}

export function TaskDetailContent({ taskId, title, description, client, agency, submittedBy, assignee, agencyMembers = [], projects: initialProjects = [], project, status = 'to_do', dueDate, dueDateRaw, createdAt, clientVisible = false, clientVisibilityLocked = false, sourceRequestId = null, linkedRequest = null, mode = 'modal', onTaskUpdate, createdByOrgId, createdByOrgType, currentOrgId, connectionId, onTaskDeleted, partnerName, variant = 'agency', activeUser, initialComments = [], onCommentsUpdate, onContactClick, isGlobalView: propIsGlobalView, isDisconnected = false }: TaskDetailContentProps) {
  const router = useRouter()
  const pathname = usePathname()
  
  // Determine base route for navigation
  const baseRoute = pathname?.startsWith('/agencies/') ? 'agencies' : 'clients'
  
  // Determine if we're in global tasks view (not connection-specific)
  // Use prop if provided, otherwise check pathname
  const isGlobalView = propIsGlobalView ?? pathname?.startsWith('/tasks')
  
  // All fields are editable (no restrictions)
  
  // State for actions dropdown
  const [isActionsDropdownOpen, setIsActionsDropdownOpen] = useState(false)
  
  // Handle delete task (optimistic)
  const handleDeleteTask = async () => {
    // Show success toast immediately
    toast.success('Task deleted')
    
    // Navigate back to tasks list with deleted task ID in state
    // This allows the tasks page to optimistically remove it
    if (connectionId) {
      router.push(`/${baseRoute}/${connectionId}/tasks?deleted=${taskId}`)
    } else {
      router.back()
    }
    
    // Update table optimistically (in case we're in modal mode)
    onTaskDeleted?.(taskId)
    
    // Delete in background
    deleteTask(taskId).catch((error) => {
      console.error('Error deleting task:', error)
      toast.error('Failed to delete task')
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
  
  
  const clientAssignee = useMemo(() =>
    assignee && agencyMembers.find(member => member.id === assignee.id && member.orgType === 'client')
  , [assignee, agencyMembers])

  const isClientVariant = variant === 'client'
  const canClientEditStatusOrAssignee = Boolean(clientAssignee)
  const isAgencyOwnedForClient = isClientVariant && !canClientEditStatusOrAssignee

  const [titleValue, setTitleValue] = useState(title)
  const [descriptionValue, setDescriptionValue] = useState(description)
  const [statusValue, setStatusValue] = useState(status)
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false)
  const [taskProject, setTaskProject] = useState<{ id: string; name: string } | null>(project || null)
  const [titleResetKey, setTitleResetKey] = useState(0)
  const [assigneeValue, setAssigneeValue] = useState(assignee)
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>(initialProjects)
  const [dueDateValue, setDueDateValue] = useState(dueDate || '')
  const [dueDateRawValue, setDueDateRawValue] = useState<string | null>(dueDateRaw ?? null)
  
  const normalizeComments = useCallback((items: Comment[]) => {
    return items.map(comment => ({
      ...comment,
      createdAt: comment.createdAt instanceof Date ? comment.createdAt : new Date(comment.createdAt)
    }))
  }, [])

  const [comments, setComments] = useState<Comment[]>(normalizeComments(initialComments))
  const optimisticCommentMetadataRef = useRef<Record<string, { text: string; createdAt: number; userId: string }>>({})
  const prevTaskIdRef = useRef<string>(taskId)
  const mergeComments = useCallback((current: Comment[], incoming: Comment[]) => {
    if (current.length === 0) {
      return incoming
    }

    const temporaryComments = current.filter(comment => comment.id.startsWith('temp-'))
    const result: Comment[] = []
    const seen = new Set<string>()

    const pushIfNew = (comment: Comment) => {
      if (seen.has(comment.id)) return
      seen.add(comment.id)
      result.push(comment)
    }

    temporaryComments.forEach(pushIfNew)
    incoming.forEach(pushIfNew)
    current.forEach(comment => {
      if (!comment.id.startsWith('temp-')) {
        pushIfNew(comment)
      }
    })

    return result
  }, [])

  const [clientVisibleValue, setClientVisibleValue] = useState(clientVisible)

  const linkedRequestMeta = useMemo(() => {
    if (!linkedRequest) return ''
    const parts: string[] = []
    if (linkedRequest.createdByName) {
      parts.push(`Submitted by ${linkedRequest.createdByName}`)
    }
    if (linkedRequest.createdAt) {
      parts.push(linkedRequest.createdAt)
    }
    return parts.join(' • ')
  }, [linkedRequest])

  const linkedRequestHref = useMemo(() => {
    if (!linkedRequest?.id || !connectionId) return null
    const base = variant === 'agency' ? 'clients' : 'agencies'
    return `/${base}/${connectionId}/requests/${linkedRequest.id}`
  }, [linkedRequest?.id, connectionId, variant])
  
  // Initialize projects list with current project if available (to prevent flicker)
  // and merge with initial projects from props
  useEffect(() => {
    if (project && project.id && project.name) {
      // Add current project to list immediately if not already present
      setProjects(prev => {
        const existingIndex = prev.findIndex(p => p.id === project.id)
        if (existingIndex >= 0) {
          const updated = [...prev]
          updated[existingIndex] = { id: project.id, name: project.name }
          return updated
        }
        return [{ id: project.id, name: project.name }, ...prev]
      })
    }
  }, [project])

  useEffect(() => {
    if (project && project.id && project.name) {
      setTaskProject({ id: project.id, name: project.name })
    } else {
      setTaskProject(null)
    }
  }, [project])
  
  // Update projects list when initialProjects prop changes (e.g., when modal opens with fresh data)
  useEffect(() => {
    if (initialProjects.length > 0) {
      setProjects(prev => {
        const projectMap = new Map(prev.map(p => [p.id, p]))
        initialProjects.forEach(p => {
          projectMap.set(p.id, { id: p.id, name: p.name })
        })
        return Array.from(projectMap.values())
      })
    }
  }, [initialProjects])
  
  const loadComments = useCallback(async (): Promise<Comment[] | null> => {
    try {
      const freshComments = await fetchCommentsForTask(taskId)
      const normalized = normalizeComments(freshComments)

      const matchedTempIds = new Set<string>()
      for (const [tempId, meta] of Object.entries(optimisticCommentMetadataRef.current)) {
        const hasMatch = normalized.some(comment => {
          if (comment.userId !== meta.userId) return false
          if (comment.text.trim() !== meta.text.trim()) return false
          return Math.abs(comment.createdAt.getTime() - meta.createdAt) < 5000
        })
        if (hasMatch) {
          matchedTempIds.add(tempId)
          delete optimisticCommentMetadataRef.current[tempId]
        }
      }

      setComments(prev => {
        const filteredPrev = matchedTempIds.size
          ? prev.filter(comment => !matchedTempIds.has(comment.id))
          : prev
        return mergeComments(filteredPrev, normalized)
      })
      onCommentsUpdate?.(normalized)
      return normalized
    } catch (error) {
      console.error('Error fetching fresh task comments:', error)
      return null
    }
  }, [mergeComments, normalizeComments, onCommentsUpdate, taskId])

  useEffect(() => {
    // Only reset comments and clear optimistic metadata when taskId actually changes
    // This prevents flicker when comments are updated for the same task
    if (prevTaskIdRef.current !== taskId) {
      prevTaskIdRef.current = taskId
      optimisticCommentMetadataRef.current = {}
      setComments(normalizeComments(initialComments))
    }
    // When taskId is the same, preserve optimistic comments - don't reset
  }, [initialComments, mode, normalizeComments, taskId])

  useEffect(() => {
    if (initialComments.length === 0) {
      void loadComments()
    }
  }, [initialComments.length, loadComments])

  // Fallback: Fetch projects on mount if connectionId is available and no initial projects provided
  // This handles edge cases where projects weren't prefetched (e.g., direct navigation to detail page)
  useEffect(() => {
    if (connectionId && initialProjects.length === 0) {
      fetchProjectsForConnection(connectionId)
        .then(fetchedProjects => {
          // Merge with existing projects, avoiding duplicates
          setProjects(prev => {
            const projectMap = new Map(prev.map(p => [p.id, p]))
            fetchedProjects.forEach(p => {
              projectMap.set(p.id, { id: p.id, name: p.name })
            })
            return Array.from(projectMap.values())
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
    optimisticCommentMetadataRef.current[tempId] = {
      text,
      createdAt: optimisticComment.createdAt.getTime(),
      userId: activeUser.id
    }
    
    try {
      await createComment(taskId, text, activeUser.id)

      const refreshed = await loadComments()
      if (!refreshed) {
        // Remove temp comment and let it be refetched on next load
        setComments(prev => prev.filter(comment => comment.id !== tempId))
        delete optimisticCommentMetadataRef.current[tempId]
      }
    } catch (error) {
      // Revert optimistic update on error
      setComments(prev => prev.filter(comment => comment.id !== tempId))
      delete optimisticCommentMetadataRef.current[tempId]
      toast.error('Failed to post comment. Please try again.')
      console.error('Error creating comment:', error)
    }
  }
  
  // Handle comment deletion with optimistic update
  const handleCommentDelete = async (commentId: string) => {
    // Optimistically remove from list
    const commentToDelete = comments.find(c => c.id === commentId)
    setComments(prev => prev.filter(comment => comment.id !== commentId))
    const optimisticMeta = optimisticCommentMetadataRef.current[commentId]

    if (commentId.startsWith('temp-')) {
      delete optimisticCommentMetadataRef.current[commentId]
      toast.success('Comment deleted successfully')
      return
    }

    delete optimisticCommentMetadataRef.current[commentId]
    
    try {
      // Soft delete from database (sets deleted_at and updated_at)
      await deleteComment(commentId)
      // Show success message
      toast.success('Comment deleted successfully')
      
      await loadComments()
    } catch (error) {
      // Revert optimistic update on error
      if (commentToDelete) {
        setComments(prev => [commentToDelete, ...prev])
        if (optimisticMeta) {
          optimisticCommentMetadataRef.current[commentId] = optimisticMeta
        }
      }
      toast.error('Failed to delete comment. Please try again.')
      console.error('Error deleting comment:', error)
    }
  }
  
  // Sync assignee when prop changes (for table → modal updates)
  useEffect(() => {
    setAssigneeValue(assignee)
  }, [assignee])

  // Sync due date when prop changes
  useEffect(() => {
    setDueDateValue(dueDate || '')
    setDueDateRawValue(dueDateRaw ?? null)
  }, [dueDate, dueDateRaw])

  useEffect(() => {
    setClientVisibleValue(clientVisible)
  }, [clientVisible])
  
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
    if (onTaskUpdate) {
      onTaskUpdate(taskId, { title: trimmedValue })
    }
    
    try {
      await updateTaskTitle(taskId, trimmedValue)
      // Real-time subscription will handle UI updates
    } catch (error) {
      console.error('Failed to update title:', error)
      // Revert optimistic update on error
      setTitleValue(previousTitle)
      if (onTaskUpdate) {
        onTaskUpdate(taskId, { title: previousTitle })
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
    if (onTaskUpdate) {
      onTaskUpdate(taskId, { description: value })
    }
    
    try {
      await updateTaskDescription(taskId, value)
      // Real-time subscription will handle UI updates
    } catch (error) {
      console.error('Failed to update description:', error)
      // Revert optimistic update on error
      setDescriptionValue(previousDescription)
      if (onTaskUpdate) {
        onTaskUpdate(taskId, { description: previousDescription })
      }
    }
  }

  const handleProjectSave = async (projectId: string) => {
    // Find the selected project from the fetched projects list
    // Empty string means cleared (no project)
    const selectedProject = !projectId || projectId === '' ? null : projects.find(p => p.id === projectId) || null
    
    // Optimistic update
    const previousProject = taskProject
    setTaskProject(selectedProject)
    
    // Update parent (table) optimistically
    if (onTaskUpdate) {
      onTaskUpdate(taskId, { project: selectedProject })
    }
    
    try {
      await updateTaskProject(taskId, !projectId || projectId === '' ? null : projectId)
      // Real-time subscription will handle UI updates
    } catch (error) {
      console.error('Failed to update task project:', error)
      toast.error('Failed to update task project')
      // Revert optimistic update on error
      setTaskProject(previousProject)
      if (onTaskUpdate) {
        onTaskUpdate(taskId, { project: previousProject })
      }
    }
  }

  const handleStatusChange = async (newStatus: string) => {
    if (isClientVariant && !canClientEditStatusOrAssignee) return

    const validStatuses = ['to_do', 'in_progress', 'on_hold', 'done'] as const
    if (!(validStatuses as readonly string[]).includes(newStatus)) {
      console.error('Invalid status:', newStatus)
      return
    }
    
    const typedStatus = newStatus as 'to_do' | 'in_progress' | 'on_hold' | 'done'
    
    // Optimistic update
    const previousStatus = statusValue
    setStatusValue(typedStatus)
    setIsStatusDropdownOpen(false)
    
    // Update parent (table) optimistically
    if (onTaskUpdate) {
      onTaskUpdate(taskId, { status: typedStatus })
    }
    
    try {
      await updateTaskStatus(taskId, typedStatus)
      // Real-time subscription will handle UI updates
    } catch (error) {
      console.error('Failed to update status:', error)
      toast.error('Failed to update status')
      // Revert optimistic update on error
      setStatusValue(previousStatus)
      if (onTaskUpdate) {
        onTaskUpdate(taskId, { status: previousStatus })
      }
    }
  }

  const handleAssigneeSelect = async (memberId: string) => {
    if (isClientVariant && !canClientEditStatusOrAssignee) return
    const selectedMember = agencyMembers.find(member => member.id === memberId)
    if (selectedMember) {
      const isClientMember = selectedMember.orgType === 'client'
      const previousClientVisible = clientVisibleValue
      const newAssignee = {
        id: memberId,
        name: `${selectedMember.firstName} ${selectedMember.lastName}`,
        email: selectedMember.email,
        avatarUrl: selectedMember.avatarUrl
      }
      
      // Get current task visibility state
      const currentVisibility = clientVisibleValue;
      
      // Optimistic update
      const previousAssignee = assigneeValue
      setAssigneeValue(newAssignee)
      
      // Only change visibility to true if assigning to client member AND visibility is currently false
      if (isClientMember && !currentVisibility) {
        setClientVisibleValue(true)
      }
      // If assigning to agency member, keep visibility as-is
      
      // Update parent (table) optimistically
      if (onTaskUpdate) {
        const updatePayload: {
          assignee: typeof newAssignee
          clientVisible?: boolean
          clientVisibilityLocked?: boolean
        } = {
          assignee: newAssignee,
        }

        if (isClientMember) {
          // Only change visibility to true if it's currently false
          if (!currentVisibility) {
            updatePayload.clientVisible = true;
          }
          updatePayload.clientVisibilityLocked = true
        } else {
          updatePayload.clientVisibilityLocked = false
        }

        onTaskUpdate(taskId, updatePayload)
      }
      
      try {
        await updateTaskAssignee(taskId, memberId)
        // Real-time subscription will handle UI updates
      } catch (error) {
        console.error('Failed to update assignee:', error)
        toast.error('Failed to update assignee')
        // Revert optimistic update on error
        setAssigneeValue(previousAssignee)
        setClientVisibleValue(previousClientVisible)
        if (onTaskUpdate) {
          onTaskUpdate(taskId, { assignee: previousAssignee })
        }
      }
    }
  }

  const handleClearAssignee = async () => {
    if (isClientVariant) return
    // Optimistic update
    const previousAssignee = assigneeValue
    setAssigneeValue(null)
    
    // Update parent (table) optimistically
    if (onTaskUpdate) {
        onTaskUpdate(taskId, { assignee: null, clientVisibilityLocked: false })
    }
    
    try {
      await updateTaskAssignee(taskId, null)
      // Real-time subscription will handle UI updates
    } catch (error) {
      console.error('Failed to clear assignee:', error)
      toast.error('Failed to clear assignee')
      // Revert optimistic update on error
      setAssigneeValue(previousAssignee)
      if (onTaskUpdate) {
        onTaskUpdate(taskId, { assignee: previousAssignee })
      }
    }
  }

  const handleDueDateSave = async (value: string) => {
    const previousDueDate = dueDateValue
    const previousDueDateRaw = dueDateRawValue

    const normalizedDisplay = value?.trim() ? value : ''
    setDueDateValue(normalizedDisplay)

    const dateStr = normalizedDisplay
      ? (() => {
        try {
            const parsed = parse(normalizedDisplay, 'd MMM yyyy', new Date())
          if (isNaN(parsed.getTime())) return null
          return format(parsed, 'yyyy-MM-dd')
        } catch {
          try {
              const parsed = new Date(normalizedDisplay)
            return isNaN(parsed.getTime()) ? null : format(parsed, 'yyyy-MM-dd')
          } catch {
            return null
          }
        }
        })()
      : null

    setDueDateRawValue(dateStr)

    if (onTaskUpdate) {
      onTaskUpdate(taskId, { dueDate: normalizedDisplay || null, dueDateRaw: dateStr })
    }

    try {
      await updateTaskDueDate(taskId, dateStr)
      // Real-time subscription will handle UI updates
    } catch (error) {
      console.error('Failed to update due date:', error)
      setDueDateValue(previousDueDate)
      setDueDateRawValue(previousDueDateRaw ?? null)
      if (onTaskUpdate) {
        onTaskUpdate(taskId, { dueDate: previousDueDate || null, dueDateRaw: previousDueDateRaw ?? null })
      }
    }
  }

  const handleClientVisibleChange = async (checked: boolean) => {
    // Check if assignee is a client member - if so, prevent changes
    const assigneeIsClientMember = assigneeValue 
      ? agencyMembers.find(member => member.id === assigneeValue.id)?.orgType === 'client'
      : false;
    
    // Don't allow changes if assigned to client member (must stay visible)
    if (assigneeIsClientMember) {
      return
    }

    const previousClientVisible = clientVisibleValue

    setClientVisibleValue(checked)

    if (onTaskUpdate) {
      onTaskUpdate(taskId, { clientVisible: checked })
    }

    try {
      await updateTaskClientVisible(taskId, checked)
      // Real-time subscription will handle UI updates
    } catch (error) {
      console.error('Failed to update client visibility:', error)
      toast.error('Failed to update client visibility')
      setClientVisibleValue(previousClientVisible)
      if (onTaskUpdate) {
        onTaskUpdate(taskId, { clientVisible: previousClientVisible })
      }
    }
  }

  const statusOptions: { value: 'to_do' | 'in_progress' | 'on_hold' | 'done', label: string }[] = [
    { value: 'to_do', label: 'To do' },
    { value: 'in_progress', label: 'In progress' },
    { value: 'on_hold', label: 'On hold' },
    { value: 'done', label: 'Done' }
  ]

  return (
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
                        <Link href={`/${baseRoute}/${connectionId}/tasks`}>
                          Tasks
                        </Link>
                      </BreadcrumbLink>
                    </BreadcrumbItem>
                  )}
                </BreadcrumbList>
              </Breadcrumb>
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
                <DropdownMenuItem onClick={() => {
                  handleCopyLink()
                  setIsActionsDropdownOpen(false)
                }}>
                  <LinkSimple size={16} style={{ color: 'var(--color-base-text-primary)' }} />
                  Copy link
                </DropdownMenuItem>
                {!isDisconnected && variant === 'agency' && (
                  <>
                    <div className="border-t border-[var(--color-neutral-6)] my-1" />
                    <DropdownMenuItem 
                      onClick={() => {
                        handleDeleteTask()
                        setIsActionsDropdownOpen(false)
                      }}
                      style={{ color: 'var(--color-red-11)' }}
                    >
                      <Trash size={16} style={{ color: 'var(--color-red-11)' }} />
                      Delete task
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
              {isClientVariant || isDisconnected ? (
                <p className="display-7-medium text-primary px-0">
                  {titleValue}
                </p>
              ) : (
                <InlineEdit
                  key={titleResetKey}
                  type="text"
                  value={titleValue}
                  onSave={handleTitleSave}
                  placeholder="Task title"
                  textClass="display-7-medium text-primary"
                  multiline={true}
                  maxLength={255}
                  preventNewLines={true}
                  className="px-0"
                />
              )}
            </div>
            <div className="flex items-center gap-4">
              {variant === 'agency' && (
                clientVisibleValue ? (
                  <Eye size={20} weight="fill" style={{ color: 'var(--color-neutral-11)' }} className="mt-1.5" />
                ) : (
                  <EyeSlash size={20} weight="fill" style={{ color: 'var(--color-neutral-11)', opacity: 0.5 }} className="mt-1.5" />
                )
              )}
              {!isDisconnected && (variant === 'agency' || (isClientVariant && canClientEditStatusOrAssignee)) ? (
                <Popover open={isStatusDropdownOpen} onOpenChange={setIsStatusDropdownOpen}>
                  <PopoverTrigger asChild>
            <TaskStatusButton variant={statusValue as 'to_do' | 'in_progress' | 'on_hold' | 'done'} className="mt-1.5">
                      <CaretDown size={12} weight="fill" />
                    </TaskStatusButton>
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
                            <TaskBadge variant={option.value as 'to_do' | 'in_progress' | 'on_hold' | 'done'} size="sm" showText />
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
                <TaskStatusButton 
                  variant={statusValue as 'to_do' | 'in_progress' | 'on_hold' | 'done'} 
                  className="mt-1.5 pointer-events-none"
                >
                </TaskStatusButton>
              )}
            </div>
          </div>
        </div>
        
        {/* Scrollable Content */}
        <div className="flex-1 overflow-auto min-h-0 pr-8 pb-10">
          <div className="flex flex-col gap-5">
            <div data-inline-edit="description">
            {isClientVariant || isDisconnected ? (
              <div className="text-md-regular px-0 whitespace-pre-wrap" style={{ fontSize: '15px', lineHeight: '22px' }}>
                {descriptionValue || <span className="text-sm-regular text-secondary">No description</span>}
              </div>
            ) : (
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
          )}
        </div>

        {linkedRequest && (
          <div className="mt-4 flex flex-col gap-3">
            <h4 className="text-sm-medium text-primary">Related request</h4>
              {linkedRequestHref ? (
              <a
                href={linkedRequestHref}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ListRow
                  iconStart={
                    <ChatCentered
                      size={16}
                      weight="regular"
                      style={{ color: 'var(--color-interactive-neutral-default)' }}
                    />
                  }
                  text={linkedRequest.title}
                  secondaryText={linkedRequestMeta}
                  className="px-3 py-2 border border-[var(--color-neutral-4)] rounded-md hover:bg-[var(--color-interactive-surface-hover)] transition-colors"
                />
              </a>
            ) : (
              <ListRow
                iconStart={
                  <ChatCentered
                    size={16}
                    weight="regular"
                    style={{ color: 'var(--color-interactive-neutral-default)' }}
                  />
                }
                text={linkedRequest.title}
                secondaryText={linkedRequestMeta}
                nonInteractive
                className="px-3 py-2 border border-[var(--color-neutral-4)] rounded-md"
              />
            )}
          </div>
        )}

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

          {/* Project Row */}
          <div className="flex items-center gap-4 h-6">
            <div className="w-2/5 min-w-0">
              <p className="text-sm-regular text-secondary truncate">Project</p>
            </div>
            <div className="w-3/5 min-w-0">
              {isDisconnected ? (
                <span className="text-sm-regular text-tertiary ml-1">
                  {taskProject ? taskProject.name : 'None (account task)'}
                </span>
              ) : variant === 'agency' ? (
                <InlineEdit
                  type="badge"
                  value={taskProject ? taskProject.id : ''}
                  options={projects.map(p => ({ value: p.id, label: p.name }))}
                  onSave={handleProjectSave}
                  searchPlaceholder="Search projects…"
                  clearable={!!taskProject}
                  placeholder="None (account task)"
                  popoverWidth="240px"
                  badgeBorderRadius="4px"
                  maxHeight="210px"
                  className="h-6"
                />
              ) : (
                <span className="text-sm-regular text-tertiary ml-1">
                  {taskProject ? taskProject.name : 'None (account task)'}
                </span>
              )}
            </div>
          </div>

          {/* Assignee Row */}
          <div className="flex items-center gap-4 h-6">
            <div className="w-2/5 min-w-0">
              <p className="text-sm-regular text-secondary truncate">
                {variant === 'agency' ? 'Assignee' : 'Assignee'}
              </p>
            </div>
            <div className="w-3/5 min-w-0">
              {isDisconnected ? (
                <ListRow
                  avatar={true}
                  avatarUrl={assigneeValue?.avatarUrl || null}
                  text={assigneeValue ? assigneeValue.name : 'Unassigned'}
                  textColor={assigneeValue ? 'var(--color-base-text-primary)' : 'var(--color-base-text-tertiary)'}
                  variant="stacked"
                  className="min-w-0"
                  nonInteractive={true}
                />
              ) : variant === 'agency' ? (
                <ListRow
                  avatar={true}
                  avatarUrl={assigneeValue?.avatarUrl || null}
                  text={assigneeValue ? assigneeValue.name : 'Unassigned'}
                  textColor={assigneeValue ? 'var(--color-base-text-primary)' : 'var(--color-base-text-tertiary)'}
                  comboboxSelectedValue={assigneeValue?.id ?? null}
                  comboboxOptions={agencyMembers.map(member => ({
                    value: member.id,
                    label: `${member.firstName} ${member.lastName}`.trim() || member.email,
                    avatar: member.avatarUrl,
                    email: member.email,
                    orgName: member.orgName,
                    orgType: member.orgType
                  }))}
                  comboboxPlaceholder="Search members…"
                  onComboboxSelect={handleAssigneeSelect}
                  clearable={!!assigneeValue}
                  onClear={handleClearAssignee}
                  borderRadius="4px"
                  comboboxWidth="280px"
                />
              ) : canClientEditStatusOrAssignee ? (
                <ListRow
                  avatar={true}
                  avatarUrl={assigneeValue?.avatarUrl || null}
                  text={assigneeValue ? assigneeValue.name : 'Unassigned'}
                  textColor={assigneeValue ? 'var(--color-base-text-primary)' : 'var(--color-base-text-tertiary)'}
                  comboboxSelectedValue={assigneeValue?.id ?? null}
                  comboboxOptions={agencyMembers
                    .filter(member => member.orgType === 'client')
                    .map(member => ({
                      value: member.id,
                      label: `${member.firstName} ${member.lastName}`.trim() || member.email,
                      avatar: member.avatarUrl,
                      email: member.email
                    }))}
                  comboboxPlaceholder="Search members…"
                  onComboboxSelect={handleAssigneeSelect}
                  clearable={false}
                  borderRadius="4px"
                  comboboxWidth="280px"
                />
              ) : (
                <ListRow
                  avatar={true}
                  avatarUrl={assigneeValue?.avatarUrl || null}
                  text={assigneeValue ? assigneeValue.name : 'Unassigned'}
                  textColor={assigneeValue ? 'var(--color-base-text-primary)' : 'var(--color-base-text-tertiary)'}
                  variant="stacked"
                  className="min-w-0"
                  nonInteractive={true}
                />
              )}
            </div>
          </div>

          {/* Due date Row */}
          <div className="flex items-center gap-4 h-6">
            <div className="w-2/5 min-w-0">
              <p className="text-sm-regular text-secondary truncate">Due date</p>
            </div>
            <div className="w-3/5 min-w-0">
              {isDisconnected || variant !== 'agency' ? (
                <span className="text-sm-regular text-tertiary ml-1">
                  {dueDateValue || "No due date"}
                </span>
              ) : (
                <InlineEdit
                  type="date"
                  value={dueDateValue}
                  placeholder="No due date"
                  dateFormat="d MMM yyyy"
                  onSave={handleDueDateSave}
                  className="h-[28px] cursor-pointer truncate"
                />
              )}
            </div>
          </div>

          {variant === 'agency' && (
            <div className="flex flex-col gap-2 mt-8">
              <h4 className="text-md-medium text-primary">Visibility</h4>
              
              <div className="flex items-center gap-4 h-6 mt-2">
                <div className="w-2/5 min-w-0">
                  <p className="text-sm-regular text-secondary truncate">Client visible</p>
                </div>
                <div className="w-3/5 min-w-0 flex items-center gap-2">
                  {(() => {
                    // Check if assignee is a client member
                    const assigneeIsClientMember = assigneeValue 
                      ? agencyMembers.find(member => member.id === assigneeValue.id)?.orgType === 'client'
                      : false;
                    
                    // Only disable if assigned to client member
                    const isToggleDisabled = assigneeIsClientMember;
                    // Force to true if disabled (assigned to client member)
                    const toggleValue = isToggleDisabled ? true : clientVisibleValue;
                    
                    return (
                      <Switch
                        checked={toggleValue}
                        disabled={isToggleDisabled || isDisconnected}
                        onCheckedChange={handleClientVisibleChange}
                        className={isToggleDisabled || isDisconnected ? '!cursor-default' : 'cursor-pointer'}
                      />
                    );
                  })()}
                  {(() => {
                    // Check if assignee is a client member
                    const assigneeIsClientMember = assigneeValue 
                      ? agencyMembers.find(member => member.id === assigneeValue.id)?.orgType === 'client'
                      : false;
                    
                    // Force to true if assigned to client member
                    const displayValue = assigneeIsClientMember ? true : clientVisibleValue;
                    const isDisabled = assigneeIsClientMember;
                    
                    return displayValue ? (
                      <>
                        <Eye
                          size={16}
                          weight="fill"
                          style={{ color: isDisabled ? 'var(--color-base-text-tertiary)' : 'var(--color-neutral-11)' }}
                        />
                        <span
                          className="text-sm-regular"
                          style={{ color: isDisabled ? 'var(--color-base-text-tertiary)' : 'var(--color-base-text-primary)' }}
                        >
                          Yes
                        </span>
                      </>
                    ) : (
                      <>
                        <EyeSlash size={16} weight="fill" style={{ color: 'var(--color-neutral-11)', opacity: 0.5 }} />
                        <span className="text-sm-regular" style={{ color: 'var(--color-base-text-tertiary)' }}>No</span>
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  )
}

