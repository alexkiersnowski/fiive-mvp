'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { InlineEdit } from '@/components/ui/inline-edit'
import { RequestBadge } from '@/components/ui/request-badge'
import { StatusButton } from '@/components/ui/status-button'
import { ListRow } from '@/components/ui/list-row'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from '@/components/ui/command'
import { Check, CaretDown, ArrowRight } from '@phosphor-icons/react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { updateRequestTitle, updateRequestDescription, updateRequestStatus, updateRequestAssignee } from './actions'

interface RequestDetailContentProps {
  requestId: string
  title: string
  description: string
  client?: {
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
  status?: 'new' | 'in_review' | 'accepted' | 'canceled'
  createdAt?: string
  mode?: 'modal' | 'page'
  onRequestUpdate?: (requestId: string, updates: { title?: string; description?: string; status?: 'new' | 'in_review' | 'accepted' | 'canceled'; assignee?: any }) => void
  createdByOrgId?: string
  currentOrgId: string
}

export function RequestDetailContent({ requestId, title, description, client, submittedBy, assignee, agencyMembers = [], type, status = 'new', createdAt, mode = 'modal', onRequestUpdate, createdByOrgId, currentOrgId }: RequestDetailContentProps) {
  const router = useRouter()
  
  // Determine if current org can edit this request
  const canEdit = createdByOrgId === currentOrgId
  
  const [titleValue, setTitleValue] = useState(title)
  const [descriptionValue, setDescriptionValue] = useState(description)
  const [statusValue, setStatusValue] = useState(status)
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false)
  const [requestType, setRequestType] = useState(type || 'general')
  const [commentValue, setCommentValue] = useState('')
  const [titleResetKey, setTitleResetKey] = useState(0)
  const [assigneeValue, setAssigneeValue] = useState(assignee)
  
  // Sync assignee when prop changes (for table → modal updates)
  useEffect(() => {
    setAssigneeValue(assignee)
  }, [assignee])
  
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
      router.refresh() // Refresh to get updated data from server
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
      router.refresh() // Refresh to get updated data from server
    } catch (error) {
      console.error('Failed to update description:', error)
      // Revert optimistic update on error
      setDescriptionValue(previousDescription)
      if (onRequestUpdate) {
        onRequestUpdate(requestId, { description: previousDescription })
      }
    }
  }

  const handleRequestTypeSave = (value: string) => {
    setRequestType(value)
    // TODO: Save to database
    console.log('Saving request type:', value)
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
      router.refresh() // Refresh to get updated data from server
    } catch (error) {
      console.error('Failed to update status:', error)
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
        router.refresh() // Refresh to get updated data from server
      } catch (error) {
        console.error('Failed to update assignee:', error)
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
      router.refresh() // Refresh to get updated data from server
    } catch (error) {
      console.error('Failed to clear assignee:', error)
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
    <div className={`grid grid-cols-[2fr_auto_1fr] gap-8 h-full ${mode === 'page' ? 'p-10' : ''}`}>
      {/* Left Column / Main Content */}
      <div className="flex flex-col gap-5">
        {/* Title with Badge */}
        <div className="flex items-start gap-3">
          <div data-inline-edit="title" className="flex-1">
            <InlineEdit
              key={titleResetKey}
              type="text"
              value={titleValue}
              onSave={handleTitleSave}
              placeholder="Add a title..."
              textClass="display-7-medium text-primary"
              multiline={true}
              maxLength={255}
              preventNewLines={true}
              className="px-0"
              nonInteractive={!canEdit}
            />
          </div>
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
        </div>
        <div data-inline-edit="description">
          <InlineEdit
            type="text"
            value={descriptionValue}
            onSave={handleDescriptionSave}
            placeholder="Add a description..."
            textClass="text-md-regular"
            multiline={true}
            className="px-0"
            style={{ fontSize: '15px', lineHeight: '22px' }}
            nonInteractive={!canEdit}
          />
        </div>

        {/* Divider */}
        <div className="w-full h-px bg-neutral-alpha-4 mt-5"></div>

        {/* Comments Section */}
        <>
          <h4 className="text-md-medium text-primary mt-5">Comments</h4>
            
            {/* Comment Input */}
            <div className="flex items-start gap-3">
              <Avatar className="w-5 h-5 flex-shrink-0">
                <AvatarImage src={submittedBy?.avatarUrl} />
                <AvatarFallback className="text-xs font-medium text-white" style={{ background: 'var(--color-neutral-9, #8B8D98)' }}>
                  {submittedBy?.name?.[0] || '?'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 flex flex-col border border-neutral-4 rounded-md overflow-hidden">
                <Textarea
                  placeholder="Leave a comment..."
                  value={commentValue}
                  onChange={(e) => setCommentValue(e.target.value)}
                  className="flex-1 resize-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0 rounded-none !border-0 focus-visible:!border-0 !min-h-0 break-all overflow-wrap-anywhere"
                />
                <div className="p-3 flex justify-end">
                  <Button size="sm" variant="default" className="h-6 cursor-pointer" disabled={!commentValue.trim()}>
                    Submit
                  </Button>
                </div>
              </div>
            </div>
          </>
      </div>

      {/* 1px Divider */}
      <div className="w-px bg-neutral-alpha-4" />

      {/* Right Column */}
      <div className="flex flex-col gap-2">
          <h3 className="text-md-medium text-primary">
          Details
        </h3>
        
        {/* Detail rows - 32px below title */}
        <div className="flex flex-col gap-2 mt-2">
          {/* Client Row */}
          <div className="flex items-center gap-4 h-6">
            <div className="w-2/5 min-w-0">
              <p className="text-sm-regular text-secondary truncate">Client</p>
            </div>
            <div className="w-3/5 min-w-0">
              <ListRow 
                avatar={true}
                avatarUrl={client?.logoUrl || null}
                text={client?.name || 'Unknown Client'}
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
                value={requestType}
                options={[
                  { value: 'general', label: 'General request' }
                  // TODO: Fetch real projects from database
                ]}
                onSave={handleRequestTypeSave}
                searchPlaceholder="Search projects…"
                clearable={false}
                dividerIndex={0}
                placeholder="Add project"
                popoverWidth="3/5"
                className="h-6 truncate"
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
            <h4 className="text-md-medium text-primary">Owner</h4>
            
            {/* Assignee Row */}
            <div className="flex items-center gap-4 h-6 mt-2">
              <div className="w-2/5 min-w-0">
                <p className="text-sm-regular text-secondary truncate">Assignee</p>
              </div>
              <div className="w-3/5 min-w-0">
                <ListRow
                  avatar={true}
                  avatarUrl={assigneeValue?.avatarUrl || null}
                  text={assigneeValue ? assigneeValue.name : 'Unassigned'}
                  textColor={assigneeValue ? 'var(--color-base-text-primary)' : 'var(--color-base-text-tertiary)'}
                  comboboxOptions={agencyMembers.map(member => ({
                    value: member.id,
                    label: `${member.firstName} ${member.lastName}`,
                    avatar: member.avatarUrl
                  }))}
                  comboboxPlaceholder="Search members…"
                  onComboboxSelect={handleAssigneeSelect}
                  clearable={!!assigneeValue}
                  onClear={handleClearAssignee}
                  borderRadius="4px"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

