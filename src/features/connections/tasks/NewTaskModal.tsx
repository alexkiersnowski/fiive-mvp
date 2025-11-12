'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Dialog, DialogContent, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { InlineEdit, InlineEditRef } from '@/components/ui/inline-edit'
import { ListRow } from '@/components/ui/list-row'
import { X } from '@phosphor-icons/react'
import { createTask, fetchProjectsForConnection } from './actions'
import { toast } from 'sonner'

interface NewTaskModalProps {
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
    orgId?: string
    orgName?: string
    orgType?: 'agency' | 'client'
  }>
  projects?: Array<{ id: string; name: string }> // Optional: if provided, skip fetching projects
  isOpen: boolean
  onClose: () => void
  onTaskOptimistic?: (payload: {
    tempId: string
    title: string
    description: string
    projectId: string | null
    projectName?: string | null
    assigneeUserId: string | null
  }) => void
  onTaskCreated?: (payload: { taskId: string; tempId?: string }) => void
  connectionId: string
  currentOrgId: string
  variant?: 'agency' | 'client'
}

export function NewTaskModal({ client, agencyMembers = [], projects: providedProjects, isOpen, onClose, onTaskOptimistic, onTaskCreated, connectionId, currentOrgId, variant = 'agency' }: NewTaskModalProps) {
  // Refs for controlling InlineEdit focus
  const titleRef = useRef<InlineEditRef>(null)
  const descriptionRef = useRef<InlineEditRef>(null)
  
  // Local state for form fields
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [projectId, setProjectId] = useState<string>('')
  const [assigneeUserId, setAssigneeUserId] = useState<string | null>(null)
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>(providedProjects || [])
  
  // Fetch projects when modal opens only if not provided as prop (optimization: use pre-fetched projects)
  useEffect(() => {
    if (isOpen && !providedProjects) {
      fetchProjectsForConnection(connectionId)
        .then(setProjects)
        .catch(error => {
          console.error('Error fetching projects:', error)
        })
    } else if (providedProjects) {
      // Use provided projects immediately (no fetch needed)
      setProjects(providedProjects)
    }
  }, [isOpen, connectionId, providedProjects])
  
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
        setProjectId('')
        setAssigneeUserId(null)
      }, 300) // Match modal animation duration
    }
  }, [isOpen])
  
  // Check if create button should be enabled (title is required)
  const canCreate = title.trim().length > 0
  
  // Handle create task
  const handleCreateTask = useCallback(async () => {
    if (!canCreate) return
    
    // Close modal and show toast immediately for snappy UX
    onClose()
    toast.success('Task created successfully')
    
    try {
      // Look up project name from projects list
      const selectedProject = !projectId || projectId === '' ? null : projects.find(p => p.id === projectId)
      const projectName = selectedProject ? selectedProject.name : null
      
      // Emit optimistic row with temp id immediately
      const tempId = `temp-${Date.now()}`
      onTaskOptimistic?.({
        tempId,
        title,
        description,
        projectId: !projectId || projectId === '' ? null : projectId,
        projectName,
        assigneeUserId
      })

      // Await the server insert to obtain the new task id
      const created = await createTask(
        connectionId,
        title,
        description,
        !projectId || projectId === '' ? null : projectId,
        assigneeUserId
      )
      // Notify parent with the created id so it can fetch and prepend the row
      if (created?.id) {
        ;(onTaskCreated as any)?.({ taskId: created.id, tempId })
      }
    } catch (error) {
      console.error('Error creating task:', error)
      toast.error('Failed to create task')
    }
  }, [canCreate, connectionId, title, description, projectId, assigneeUserId, onTaskCreated, onTaskOptimistic, onClose])
  
  // Keyboard shortcut: Cmd+Enter / Ctrl+Enter to submit
  useEffect(() => {
    if (!isOpen) return
    
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+Enter (Mac) or Ctrl+Enter (Windows/Linux)
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        if (canCreate) {
          handleCreateTask()
        }
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, canCreate, handleCreateTask])
  
  // Get selected assignee
  const selectedAssignee = assigneeUserId 
    ? agencyMembers.find(m => m.id === assigneeUserId) 
    : null
  
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
              {variant === 'client' ? 'Submit task' : 'New task'}
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
                placeholder="Task title"
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
                placeholder="Add description…"
                className="text-md-regular"
                multiline={true}
                preventNewLines={false}
              />
            </div>

            {/* Inline Fields: Client, Project, Assignee */}
            <div className="flex items-center gap-4 px-10">
              {/* Client */}
              <ListRow
                avatar={true}
                avatarUrl={client.logoUrl}
                text={client.name}
                nonInteractive={true}
                className="[&>*]:!rounded-[4px]"
              />

              {/* Project */}
              <InlineEdit
                type="badge"
                value={projectId}
                options={projects.map(p => ({ value: p.id, label: p.name }))}
                onSave={setProjectId}
                placeholder="Add project"
                searchPlaceholder="Search projects…"
                clearable={!!projectId}
                popoverWidth="240px"
                badgeBorderRadius="4px"
                maxHeight="210px"
                className="h-6"
              />

              {/* Assignee - Only for agency view */}
              {variant === 'agency' && (
                <ListRow
                  avatar={true}
                  avatarUrl={selectedAssignee?.avatarUrl}
                  text={selectedAssignee ? `${selectedAssignee.firstName} ${selectedAssignee.lastName}` : 'Assignee'}
                  textColor={!selectedAssignee ? 'var(--color-base-text-tertiary)' : undefined}
                  comboboxSelectedValue={assigneeUserId}
                  comboboxOptions={agencyMembers.map(member => ({
                    value: member.id,
                    label: `${member.firstName} ${member.lastName}`.trim() || member.email,
                    avatar: member.avatarUrl,
                    email: member.email,
                    orgName: member.orgName,
                    orgType: member.orgType
                  }))}
                  onComboboxSelect={(value: string) => setAssigneeUserId(value)}
                  comboboxPlaceholder="Search members…"
                  clearable={!!selectedAssignee}
                  onClear={() => setAssigneeUserId(null)}
                  borderRadius="4px"
                  className="[&>*]:!rounded-[4px]"
                />
              )}
            </div>
          </div>
        </div>
        
        {/* Footer with Create button - Sticky */}
        <DialogFooter className="px-10 pb-5 pt-5 border-t border-neutral-4 flex-shrink-0">
          <Button 
            onClick={handleCreateTask} 
            className="!h-[32px] cursor-pointer"
            disabled={!canCreate}
          >
            {variant === 'client' ? 'Submit task' : 'Create task'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

