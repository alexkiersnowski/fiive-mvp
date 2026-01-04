'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Dialog, DialogContent, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { InlineEdit, InlineEditRef } from '@/components/ui/inline-edit'
import { ListRow } from '@/components/ui/list-row'
import { X } from '@phosphor-icons/react'
import { createProject } from './actions'
import { toast } from 'sonner'
import { parse, format } from 'date-fns'
import { registerProjectPendingCreate } from '../utils/optimisticTracker'

interface NewProjectModalProps {
  client: {
    id: string
    name: string
    logoUrl?: string
  }
  agencyMembers?: Array<{
    id: string
    firstName: string
    lastName: string
    email: string
    avatarUrl?: string
    jobTitle?: string
  }>
  isOpen: boolean
  onClose: () => void
  onProjectOptimistic?: (payload: {
    tempId: string
    title: string
    description: string
    type: string | null
    assigneeUserId: string | null
    startDate: string
    endDate: string
  }) => void
  onProjectCreated?: (payload: { projectId: string; tempId?: string }) => void
  connectionId: string
  currentOrgId: string
  variant?: 'agency' | 'client'
}

export function NewProjectModal({ client, agencyMembers: _agencyMembers = [], isOpen, onClose, onProjectOptimistic, onProjectCreated, connectionId, currentOrgId: _currentOrgId, variant = 'agency' }: NewProjectModalProps) {
  // Refs for controlling InlineEdit focus
  const titleRef = useRef<InlineEditRef>(null)
  const descriptionRef = useRef<InlineEditRef>(null)
  
  // Track mount status to prevent state updates after unmount
  const isMountedRef = useRef(true)
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])
  
  // Local state for form fields
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  
  // Auto-focus title when modal opens and reset form when it closes
  useEffect(() => {
    if (isOpen) {
      // Small delay to ensure modal is fully rendered
      setTimeout(() => {
        titleRef.current?.startEditing()
      }, 100)
    } else {
      // Delay clearing form data until after modal close animation completes
      setTimeout(() => {
        setTitle('')
        setDescription('')
        setStartDate('')
        setEndDate('')
      }, 300) // Match modal animation duration
    }
  }, [isOpen])
  
  // Check if create button should be enabled (title is required)
  const canCreate = title.trim().length > 0
  
  // Handle create project
  const handleCreateProject = useCallback(() => {
    if (!canCreate) return
    
    // Close modal and show toast immediately for snappy UX
    onClose()
    toast.success('Project created successfully')
    
    // Emit optimistic row with temp id immediately
    const tempId = `temp-${Date.now()}`
    onProjectOptimistic?.({
      tempId,
      title,
      description,
      type: null,
      assigneeUserId: null,
      startDate,
      endDate
    })

    // Parse dates from UI format ("d MMM yyyy") to ISO date strings for database
    const parseDate = (dateStr: string | null | undefined): string | null => {
      if (!dateStr || !dateStr.trim()) return null
      const trimmed = dateStr.trim()

      const tryPattern = (pattern: string) => {
        try {
          const parsed = parse(trimmed, pattern, new Date())
          if (isNaN(parsed.getTime())) return null
          return format(parsed, 'yyyy-MM-dd')
        } catch {
          return null
        }
      }

      return (
        tryPattern('d MMM yyyy') ??
        (() => {
          try {
            const parsed = new Date(trimmed)
            return isNaN(parsed.getTime()) ? null : format(parsed, 'yyyy-MM-dd')
          } catch {
            return null
          }
        })()
      )
    }

    const parsedStartDate = parseDate(startDate)
    const parsedEndDate = parseDate(endDate)

    // Fire server action concurrently
    const createPromise = createProject(
      connectionId,
      title,
      description,
      null, // type
      null, // assigneeUserId
      parsedStartDate,
      parsedEndDate
    )
    
    // Register pending create for optimistic updates
    registerProjectPendingCreate(tempId, createPromise.then(p => p.id))
    
    createPromise
      .then((created) => {
        if (!isMountedRef.current) return // Guard against unmounted updates
        
        if (created?.id) {
          // Log temp → real ID mapping for debugging
          if (process.env.NODE_ENV !== 'production') {
            console.log(`[Project] Created: tempId=${tempId} → projectId=${created.id}`)
          }
          // Notify parent with the created id so it can fetch and prepend the row
          onProjectCreated?.({ projectId: created.id, tempId })
        }
      })
      .catch((error) => {
        if (!isMountedRef.current) return // Guard against unmounted updates
        
        console.error('Error creating project:', error)
        toast.error('Failed to create project')
      })
  }, [canCreate, connectionId, title, description, startDate, endDate, onProjectCreated, onProjectOptimistic, onClose])
  
  // Keyboard shortcut: Cmd+Enter / Ctrl+Enter to submit
  useEffect(() => {
    if (!isOpen) return
    
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+Enter (Mac) or Ctrl+Enter (Windows/Linux)
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        if (canCreate) {
          handleCreateProject()
        }
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, canCreate, handleCreateProject])
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent 
        className="!max-w-[720px] !w-[720px] !max-h-[800px] !h-fit !p-0 !gap-0 !flex !flex-col !overflow-hidden" 
        showCloseButton={false}
      >
        {/* Header */}
        <div className="w-full flex items-center justify-between h-fit flex-shrink-0 pl-10 pr-4 py-4">
          <div className="flex items-center gap-2">
            <DialogTitle className="!text-[12px] !leading-[20px] !font-normal !tracking-[0.0025rem] !text-[var(--color-base-text-tertiary)]">
              {variant === 'client' ? 'Submit project' : 'New project'}
            </DialogTitle>
          </div>
          <div className="flex gap-0">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={onClose}
              className="h-10 w-10 cursor-pointer transition-all duration-75 rounded-md hover:bg-interactive-surface-hover"
            >
              <X className="w-[18px] h-[18px]" />
              <span className="sr-only">Close</span>
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="pb-2">
          <div className="flex flex-col">
            {/* Title */}
            <div data-inline-edit="title" className="flex-1 px-10 pb-2">
              <InlineEdit
                ref={titleRef}
                type="text"
                value={title}
                onSave={setTitle}
                onChange={setTitle}
                onTab={() => descriptionRef.current?.startEditing()}
                placeholder="Project name"
                className="display-7-medium"
                multiline={true}
                preventNewLines={true}
                maxLength={255}
              />
            </div>

            {/* Description - Scrollable */}
            <div className="max-h-[300px] overflow-y-auto px-10 pb-10">
              <InlineEdit
                ref={descriptionRef}
                type="text"
                value={description}
                onSave={setDescription}
                onChange={setDescription}
                placeholder="Add a short summary…"
                className="text-md-regular"
                multiline={true}
                preventNewLines={false}
                maxLength={10000}
              />
            </div>

            {/* Inline Fields: Client, Start date, End date */}
            <div className="flex items-center gap-4 px-10">
              {/* Client */}
              <ListRow
                avatar={true}
                avatarUrl={client.logoUrl}
                text={client.name}
                nonInteractive={true}
                className="[&>*]:!rounded-[4px]"
              />

              {/* Start date */}
              <InlineEdit
                type="date"
                value={startDate}
                placeholder="Start date"
                dateFormat="d MMM yyyy"
                onSave={setStartDate}
                className="h-[28px] cursor-pointer truncate"
              />

              {/* End date */}
              <InlineEdit
                type="date"
                value={endDate}
                placeholder="End date"
                dateFormat="d MMM yyyy"
                onSave={setEndDate}
                className="h-[28px] cursor-pointer truncate"
              />
            </div>
          </div>
        </div>
        
        {/* Footer with Create button - Sticky */}
        <DialogFooter className="px-10 pb-5 pt-5 border-t border-neutral-4 flex-shrink-0">
          <Button 
            onClick={handleCreateProject} 
            className="!h-[32px] cursor-pointer"
            disabled={!canCreate}
          >
            {variant === 'client' ? 'Submit project' : 'Create project'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

