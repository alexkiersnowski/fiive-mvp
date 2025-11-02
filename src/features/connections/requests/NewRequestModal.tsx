'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Dialog, DialogContent, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { InlineEdit, InlineEditRef } from '@/components/ui/inline-edit'
import { ListRow } from '@/components/ui/list-row'
import { X } from '@phosphor-icons/react'
import { createRequest } from './actions'
import { toast } from 'sonner'

interface NewRequestModalProps {
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
  onRequestOptimistic?: (payload: {
    tempId: string
    title: string
    description: string
    type: string | null
    assigneeUserId: string | null
  }) => void
  onRequestCreated?: (payload: { requestId: string; tempId?: string }) => void
  connectionId: string
  currentOrgId: string
  variant?: 'agency' | 'client'
}

export function NewRequestModal({ client, agencyMembers = [], isOpen, onClose, onRequestOptimistic, onRequestCreated, connectionId, currentOrgId, variant = 'agency' }: NewRequestModalProps) {
  // Refs for controlling InlineEdit focus
  const titleRef = useRef<InlineEditRef>(null)
  const descriptionRef = useRef<InlineEditRef>(null)
  
  // Local state for form fields
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState('general')
  const [assigneeUserId, setAssigneeUserId] = useState<string | null>(null)
  
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
        setType('general')
        setAssigneeUserId(null)
      }, 300) // Match modal animation duration
    }
  }, [isOpen])
  
  // Check if create button should be enabled (title is required)
  const canCreate = title.trim().length > 0
  
  // Handle create request
  const handleCreateRequest = useCallback(async () => {
    if (!canCreate) return
    
    // Close modal and show toast immediately for snappy UX
    onClose()
    toast.success('Request created successfully')
    
    try {
      // Emit optimistic row with temp id immediately
      const tempId = `temp-${Date.now()}`
      onRequestOptimistic?.({
        tempId,
        title,
        description,
        type,
        assigneeUserId
      })

      // Await the server insert to obtain the new request id
      const created = await createRequest(
        connectionId,
        title,
        description,
        type,
        assigneeUserId
      )
      // Notify parent with the created id so it can fetch and prepend the row
      if (created?.id) {
        ;(onRequestCreated as any)?.({ requestId: created.id, tempId })
      }
    } catch (error) {
      console.error('Error creating request:', error)
      toast.error('Failed to create request')
    }
  }, [canCreate, connectionId, title, description, type, assigneeUserId, onRequestCreated, onRequestOptimistic, onClose])
  
  // Keyboard shortcut: Cmd+Enter / Ctrl+Enter to submit
  useEffect(() => {
    if (!isOpen) return
    
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+Enter (Mac) or Ctrl+Enter (Windows/Linux)
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        if (canCreate) {
          handleCreateRequest()
        }
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, canCreate, handleCreateRequest])
  
  // Get selected assignee
  const selectedAssignee = assigneeUserId 
    ? agencyMembers.find(m => m.id === assigneeUserId) 
    : null
  
  // Project options (TODO: Fetch real projects from database)
  const projectOptions = [
    { value: 'general', label: 'General request' }
  ]
  
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
              {variant === 'client' ? 'Submit request' : 'New request'}
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
                placeholder="Request title"
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
                value={type}
                options={projectOptions}
                onSave={setType}
                searchPlaceholder="Search projects…"
                clearable={false}
                dividerIndex={0}
                popoverWidth="240px"
                badgeBorderRadius="4px"
                className="h-6"
              />

              {/* Assignee - Only for agency view */}
              {variant === 'agency' && (
                <ListRow
                  avatar={true}
                  avatarUrl={selectedAssignee?.avatarUrl}
                  text={selectedAssignee ? `${selectedAssignee.firstName} ${selectedAssignee.lastName}` : 'Assignee'}
                  textColor={!selectedAssignee ? 'var(--color-base-text-tertiary)' : undefined}
                  comboboxOptions={agencyMembers.map(member => ({
                    value: member.id,
                    label: `${member.firstName} ${member.lastName}`,
                    avatar: member.avatarUrl
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
            onClick={handleCreateRequest} 
            className="!h-[32px] cursor-pointer"
            disabled={!canCreate}
          >
            {variant === 'client' ? 'Submit request' : 'Create request'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

