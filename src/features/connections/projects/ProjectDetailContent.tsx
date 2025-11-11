'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { InlineEdit } from '@/components/ui/inline-edit'
import { ListRow } from '@/components/ui/list-row'
import { DotsThree, LinkSimple, Trash, CaretDown, Check } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from '@/components/ui/command'
import { ProjectBadge } from '@/components/ui/project-badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import Link from 'next/link'
import { updateProjectTitle, updateProjectDescription, updateProjectStatus, updateProjectAssignee, deleteProject, updateProjectStartDate, updateProjectEndDate } from './actions'
import type { Project } from '../server'
import { toast } from 'sonner'
import { parse, format } from 'date-fns'

interface Comment {
  id: string
  userId: string
  userName: string
  userAvatar?: string
  createdAt: Date
  text: string
}

interface ProjectDetailContentProps {
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
  agencyMembers?: Array<{
    id: string
    firstName: string
    lastName: string
    email: string
    avatarUrl?: string
    jobTitle?: string
  }>
  type?: string | null
  status?: 'planned' | 'active' | 'on_hold' | 'completed' | 'canceled'
  startDate?: string
  endDate?: string
  createdAt?: string
  requestsCount?: number
  tasksCount?: number
  mode?: 'modal' | 'page'
  onProjectUpdate?: (projectId: string, updates: { title?: string; description?: string; status?: 'planned' | 'active' | 'on_hold' | 'completed' | 'canceled'; assignee?: any; startDate?: string; endDate?: string }) => void
  createdByOrgId?: string
  createdByOrgType?: 'agency' | 'client'
  currentOrgId: string
  connectionId?: string
  onProjectDeleted?: (projectId: string) => void
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
}

export function ProjectDetailContent({ projectId, title, description, client, agency, submittedBy, assignee, agencyMembers = [], type, status = 'planned', startDate, endDate, createdAt, requestsCount = 0, tasksCount = 0, mode = 'modal', onProjectUpdate, createdByOrgId, createdByOrgType, currentOrgId, connectionId, onProjectDeleted, partnerName, variant = 'agency', activeUser, initialComments = [], onCommentsUpdate }: ProjectDetailContentProps) {
  const router = useRouter()
  const pathname = usePathname()
  
  // Determine base route for navigation
  const baseRoute = pathname?.startsWith('/agencies/') ? 'agencies' : 'clients'
  
  
  // State for actions dropdown
  const [isActionsDropdownOpen, setIsActionsDropdownOpen] = useState(false)
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  
  // Handle delete project click (opens confirmation dialog)
  const handleDeleteProject = () => {
    setDeleteDialogOpen(true)
  }

  // Confirm delete project (optimistic)
  const confirmDeleteProject = async () => {
    // Close dialog immediately
    setDeleteDialogOpen(false)
    
    // Show success toast immediately
    toast.success('Project deleted')
    
    // Navigate back to projects list with deleted project ID in state
    // This allows the projects page to optimistically remove it
    if (connectionId) {
      router.push(`/${baseRoute}/${connectionId}/projects?deleted=${projectId}`)
    } else {
      router.back()
    }
    
    // Update table optimistically (in case we're in modal mode)
    onProjectDeleted?.(projectId)
    
    // Delete in background
    deleteProject(projectId).catch((error) => {
      console.error('Error deleting project:', error)
      toast.error('Failed to delete project')
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
  
  // Determine dialog title based on organization type that created the project
  const getDialogTitle = () => {
    return 'Project'
  }
  
  const [titleValue, setTitleValue] = useState(title)
  const [descriptionValue, setDescriptionValue] = useState(description)
  const [statusValue, setStatusValue] = useState(status)
  const [projectType, setProjectType] = useState(type || 'general')
  const [titleResetKey, setTitleResetKey] = useState(0)
  const [assigneeValue, setAssigneeValue] = useState(assignee)
  const [startDateValue, setStartDateValue] = useState(startDate || '')
  const [endDateValue, setEndDateValue] = useState(endDate || '')
  
  // Sync assignee when prop changes (for table → modal updates)
  useEffect(() => {
    setAssigneeValue(assignee)
  }, [assignee])

  // Sync start and end dates when props change
  useEffect(() => {
    setStartDateValue(startDate || '')
  }, [startDate])

  useEffect(() => {
    setEndDateValue(endDate || '')
  }, [endDate])
  
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
    if (onProjectUpdate) {
      onProjectUpdate(projectId, { title: trimmedValue })
    }
    
    try {
      await updateProjectTitle(projectId, trimmedValue)
      // Real-time subscription will handle UI updates
    } catch (error) {
      console.error('Failed to update title:', error)
      // Revert optimistic update on error
      setTitleValue(previousTitle)
      if (onProjectUpdate) {
        onProjectUpdate(projectId, { title: previousTitle })
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
    if (onProjectUpdate) {
      onProjectUpdate(projectId, { description: value })
    }
    
    try {
      await updateProjectDescription(projectId, value)
      // Real-time subscription will handle UI updates
    } catch (error) {
      console.error('Failed to update description:', error)
      // Revert optimistic update on error
      setDescriptionValue(previousDescription)
      if (onProjectUpdate) {
        onProjectUpdate(projectId, { description: previousDescription })
      }
    }
  }

  const handleProjectTypeSave = (value: string) => {
    setProjectType(value)
    // TODO: Save to database
    console.log('Saving project type:', value)
  }

  const handleStatusChange = async (newStatus: string | null) => {
    const validStatus = newStatus && ['planned', 'active', 'on_hold', 'completed', 'canceled'].includes(newStatus)
      ? newStatus as 'planned' | 'active' | 'on_hold' | 'completed' | 'canceled'
      : 'planned'
    
    // Optimistic update
    const previousStatus = statusValue
    setStatusValue(validStatus)
    
    // Update parent (table) optimistically
    if (onProjectUpdate) {
      onProjectUpdate(projectId, { status: validStatus })
    }
    
    try {
      await updateProjectStatus(projectId, validStatus)
      const statusLabels = {
        planned: 'Planned',
        active: 'Active',
        on_hold: 'On hold',
        completed: 'Completed',
        canceled: 'Canceled'
      }
      toast.success(`Status updated to ${statusLabels[validStatus]}`)
      // Real-time subscription will handle UI updates
    } catch (error) {
      console.error('Failed to update status:', error)
      toast.error('Failed to update status')
      // Revert optimistic update on error
      setStatusValue(previousStatus)
      if (onProjectUpdate) {
        onProjectUpdate(projectId, { status: previousStatus })
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
      if (onProjectUpdate) {
        onProjectUpdate(projectId, { assignee: newAssignee })
      }
      
      try {
        await updateProjectAssignee(projectId, memberId)
        toast.success(`Assigned to ${selectedMember.firstName} ${selectedMember.lastName}`)
        // Real-time subscription will handle UI updates
      } catch (error) {
        console.error('Failed to update assignee:', error)
        toast.error('Failed to update assignee')
        // Revert optimistic update on error
        setAssigneeValue(previousAssignee)
        if (onProjectUpdate) {
          onProjectUpdate(projectId, { assignee: previousAssignee })
        }
      }
    }
  }

  const handleClearAssignee = async () => {
    // Optimistic update
    const previousAssignee = assigneeValue
    setAssigneeValue(null)
    
    // Update parent (table) optimistically
    if (onProjectUpdate) {
      onProjectUpdate(projectId, { assignee: null })
    }
    
    try {
      await updateProjectAssignee(projectId, null)
      toast.success('Assignee removed')
      // Real-time subscription will handle UI updates
    } catch (error) {
      console.error('Failed to clear assignee:', error)
      toast.error('Failed to clear assignee')
      // Revert optimistic update on error
      setAssigneeValue(previousAssignee)
      if (onProjectUpdate) {
        onProjectUpdate(projectId, { assignee: previousAssignee })
      }
    }
  }

  const handleStartDateSave = async (value: string) => {
    // Optimistic update
    const previousStartDate = startDateValue
    setStartDateValue(value)
    
    // Update parent (table) optimistically
    if (onProjectUpdate) {
      onProjectUpdate(projectId, { startDate: value })
    }
    
    try {
      // Convert UI date format to ISO date string for database
      // value is in format "d MMM yyyy" (e.g., "23 Oct 2025") from InlineEdit
      const dateStr = value ? (() => {
        try {
          const parsed = parse(value, 'd MMM yyyy', new Date())
          if (isNaN(parsed.getTime())) return null
          return format(parsed, 'yyyy-MM-dd')
        } catch {
          try {
            const parsed = new Date(value)
            return isNaN(parsed.getTime()) ? null : format(parsed, 'yyyy-MM-dd')
          } catch {
            return null
          }
        }
      })() : null
      
      await updateProjectStartDate(projectId, dateStr)
      // Real-time subscription will handle UI updates
    } catch (error) {
      console.error('Failed to update start date:', error)
      // Revert optimistic update on error
      setStartDateValue(previousStartDate)
      if (onProjectUpdate) {
        onProjectUpdate(projectId, { startDate: previousStartDate })
      }
    }
  }

  const handleEndDateSave = async (value: string) => {
    // Optimistic update
    const previousEndDate = endDateValue
    setEndDateValue(value)
    
    // Update parent (table) optimistically
    if (onProjectUpdate) {
      onProjectUpdate(projectId, { endDate: value })
    }
    
    try {
      // Convert UI date format to ISO date string for database
      // value is in format "d MMM yyyy" (e.g., "23 Oct 2025") from InlineEdit
      const dateStr = value ? (() => {
        try {
          const parsed = parse(value, 'd MMM yyyy', new Date())
          if (isNaN(parsed.getTime())) return null
          return format(parsed, 'yyyy-MM-dd')
        } catch {
          try {
            const parsed = new Date(value)
            return isNaN(parsed.getTime()) ? null : format(parsed, 'yyyy-MM-dd')
          } catch {
            return null
          }
        }
      })() : null
      
      await updateProjectEndDate(projectId, dateStr)
      // Real-time subscription will handle UI updates
    } catch (error) {
      console.error('Failed to update end date:', error)
      // Revert optimistic update on error
      setEndDateValue(previousEndDate)
      if (onProjectUpdate) {
        onProjectUpdate(projectId, { endDate: previousEndDate })
      }
    }
  }
  
  const statusOptions: { value: 'planned' | 'active' | 'on_hold' | 'completed' | 'canceled', label: string }[] = [
    { value: 'planned', label: 'Planned' },
    { value: 'active', label: 'Active' },
    { value: 'on_hold', label: 'On hold' },
    { value: 'completed', label: 'Completed' },
    { value: 'canceled', label: 'Canceled' }
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
                        <Link href={`/${baseRoute}/${connectionId}/projects`}>
                          Projects
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
              {variant === 'agency' && (
                <>
              <div className="border-t border-[var(--color-neutral-6)] my-1" />
              <DropdownMenuItem 
                onClick={() => {
                  handleDeleteProject()
                  setIsActionsDropdownOpen(false)
                }}
                style={{ color: 'var(--color-red-11)' }}
              >
                <Trash size={16} style={{ color: 'var(--color-red-11)' }} />
                Delete project
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
                placeholder="Project name"
                textClass="display-7-medium text-primary"
                multiline={true}
                maxLength={255}
                preventNewLines={true}
                className="px-0"
                nonInteractive={variant === 'client'}
              />
            </div>
            {variant === 'agency' ? (
              <Popover open={isStatusDropdownOpen} onOpenChange={setIsStatusDropdownOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="mt-1.5 cursor-pointer"
                    style={{ padding: 0, background: 'none', border: 'none' }}
                  >
                    <ProjectBadge variant={statusValue} size="lg" showText={true} showIconRight={true} />
                  </button>
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
                            onSelect={() => {
                              handleStatusChange(option.value as string)
                              setIsStatusDropdownOpen(false)
                            }}
                            className="flex items-center justify-between cursor-pointer"
                          >
                            <ProjectBadge variant={option.value} size="sm" showText />
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
              <div className="mt-1.5">
                <ProjectBadge variant={statusValue} size="lg" showText={true} />
              </div>
            )}
          </div>
        </div>
        
        {/* Scrollable Content */}
        <div className="flex-1 overflow-auto min-h-0 pr-8 pb-10">
          <div className="flex flex-col gap-5">
            <div data-inline-edit="description">
              {variant === 'client' ? (
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
              ) : (
                <InlineEdit
                  type="text"
                  value={descriptionValue}
                  onSave={handleDescriptionSave}
                  placeholder="Add a short summary…"
                  textClass="text-md-regular"
                  multiline={true}
                  linkifyUrls={true}
                  className="px-0"
                  style={{ fontSize: '15px', lineHeight: '22px' }}
                />
              )}
            </div>
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

          {/* Start date Row */}
          <div className="flex items-center gap-4 h-6">
            <div className="w-2/5 min-w-0">
              <p className="text-sm-regular text-secondary truncate">Start date</p>
            </div>
            <div className="w-3/5 min-w-0">
              {variant === 'agency' ? (
              <InlineEdit
                type="date"
                value={startDateValue}
                placeholder="Add date"
                dateFormat="d MMM yyyy"
                onSave={handleStartDateSave}
                className="h-[28px] cursor-pointer truncate"
              />
              ) : (
                <span className="text-sm-regular text-primary ml-1">
                  {startDateValue || "No date"}
                </span>
              )}
            </div>
          </div>

          {/* End date Row */}
          <div className="flex items-center gap-4 h-6">
            <div className="w-2/5 min-w-0">
              <p className="text-sm-regular text-secondary truncate">End date</p>
            </div>
            <div className="w-3/5 min-w-0">
              {variant === 'agency' ? (
              <InlineEdit
                type="date"
                value={endDateValue}
                placeholder="Add date"
                dateFormat="d MMM yyyy"
                onSave={handleEndDateSave}
                className="h-[28px] cursor-pointer truncate"
              />
              ) : (
                <span className="text-sm-regular text-primary ml-1">
                  {endDateValue || "No date"}
                </span>
              )}
            </div>
          </div>

          {/* Requests Row */}
          <div className="flex items-center gap-4 h-6">
            <div className="w-2/5 min-w-0">
              <p className="text-sm-regular text-secondary truncate">Requests</p>
            </div>
            <div className="w-3/5 min-w-0">
              <span className="text-sm-regular text-primary ml-1">{requestsCount}</span>
            </div>
          </div>

          {/* Tasks Row */}
          <div className="flex items-center gap-4 h-6">
            <div className="w-2/5 min-w-0">
              <p className="text-sm-regular text-secondary truncate">Tasks</p>
            </div>
            <div className="w-3/5 min-w-0">
              <span className="text-sm-regular text-primary ml-1">{tasksCount}</span>
            </div>
          </div>

        </div>
      </div>
      </div>

      {/* Delete Project Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent style={{ padding: '24px', width: '460px', gap: '0.75rem' }} className="[&>button]:hidden h-auto">
          <DialogHeader className="space-y-0">
            <DialogTitle className="display-5-medium mb-0">
              Delete project &quot;{title}&quot;?
            </DialogTitle>
          </DialogHeader>
          <DialogDescription 
            className="text-sm-regular mb-0"
          >
            Deleting this project will unlink all related tasks and requests. This action cannot be undone.
          </DialogDescription>
          <div className="flex justify-end" style={{ marginTop: '12px', gap: '12px' }}>
            <Button 
              variant="ghost" 
              onClick={() => setDeleteDialogOpen(false)}
              style={{ height: '40px' }}
              className="cursor-pointer"
            >
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={confirmDeleteProject}
              style={{ height: '40px' }}
              className="cursor-pointer"
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

