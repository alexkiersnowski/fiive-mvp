'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Dialog, DialogContent, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { InlineEdit, InlineEditRef } from '@/components/ui/inline-edit'
import { ListRow } from '@/components/ui/list-row'
import { X, Users, BuildingOffice } from '@phosphor-icons/react'
import { createRequest, fetchProjectsForConnection } from './actions'
import { toast } from 'sonner'

interface NewRequestModalProps {
  client?: {
    id: string
    name: string
    logoUrl?: string
  }
  connections?: Array<{
    id: string
    name: string
    logoUrl?: string
  }> // For global mode - list of all connections
  agencyMembers?: Array<{
    id: string
    firstName: string
    lastName: string
    email: string
    avatarUrl?: string
    jobTitle?: string
  }>
  projects?: Array<{ id: string; name: string }> // Optional: if provided, skip fetching projects
  isOpen: boolean
  onClose: () => void
  onRequestOptimistic?: (payload: {
    tempId: string
    title: string
    description: string
    projectId: string | null
    projectName?: string | null
    assigneeUserId: string | null
  }) => void
  onRequestCreated?: (payload: { requestId: string; tempId?: string }) => void
  connectionId?: string // Optional for global mode
  currentOrgId: string
  variant?: 'agency' | 'client'
  isGlobal?: boolean // If true, show client dropdown instead of fixed client
  onConnectionSelect?: (connectionId: string) => void // Callback when connection is selected in global mode
}

export function NewRequestModal({ 
  client, 
  connections = [],
  agencyMembers = [], 
  projects: providedProjects, 
  isOpen, 
  onClose, 
  onRequestOptimistic, 
  onRequestCreated, 
  connectionId, 
  currentOrgId: _currentOrgId, 
  variant = 'agency',
  isGlobal = false,
  onConnectionSelect
}: NewRequestModalProps) {
  // Refs for controlling InlineEdit focus
  const titleRef = useRef<InlineEditRef>(null)
  const descriptionRef = useRef<InlineEditRef>(null)
  
  // Local state for form fields
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [selectedConnectionId, setSelectedConnectionId] = useState<string>('')
  const [projectId, setProjectId] = useState<string>('general')
  const [assigneeUserId, setAssigneeUserId] = useState<string | null>(null)
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>(providedProjects || [])
  
  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setTimeout(() => {
        setTitle('')
        setDescription('')
        setSelectedConnectionId('')
        setProjectId('general')
        setAssigneeUserId(null)
        setProjects([])
      }, 300)
    }
  }, [isOpen])
  
  // Sync providedProjects prop to local state
  useEffect(() => {
    if (providedProjects && providedProjects.length > 0) {
      setProjects(providedProjects)
    }
  }, [providedProjects])
  
  // Fetch projects when connection is selected in global mode
  useEffect(() => {
    if (isGlobal && selectedConnectionId) {
      // Reset project selection when connection changes
      setProjectId('general')
      // Notify parent of connection selection
      onConnectionSelect?.(selectedConnectionId)
      // Fetch projects for the selected connection
      fetchProjectsForConnection(selectedConnectionId)
        .then(setProjects)
        .catch(error => {
          console.error('Error fetching projects:', error)
          setProjects([])
        })
    } else if (!isGlobal && isOpen && connectionId) {
      // Non-global mode: fetch projects for the fixed connection
      fetchProjectsForConnection(connectionId)
        .then(setProjects)
        .catch(error => {
          console.error('Error fetching projects:', error)
        })
    }
  }, [isGlobal, selectedConnectionId, isOpen, connectionId, onConnectionSelect])
  
  // Auto-focus title when modal opens
  useEffect(() => {
    if (isOpen) {
      // Small delay to ensure modal is fully rendered
      setTimeout(() => {
        titleRef.current?.startEditing()
      }, 100)
    }
  }, [isOpen])
  
  // Check if create button should be enabled (title is required, and connection if global)
  const canCreate = title.trim().length > 0 && (!isGlobal || selectedConnectionId.length > 0)
  
  // Handle create request
  const handleCreateRequest = useCallback(async () => {
    if (!canCreate) return
    
    // Determine the connection ID to use
    const targetConnectionId = isGlobal ? selectedConnectionId : connectionId
    if (!targetConnectionId) return
    
    // Close modal immediately for snappy UX
    onClose()
    
    try {
      // Look up project name from projects list
      const selectedProject = projectId === 'general' ? null : projects.find(p => p.id === projectId)
      const projectName = selectedProject ? selectedProject.name : null
      
      // Emit optimistic row with temp id immediately
      const tempId = `temp-${Date.now()}`
      onRequestOptimistic?.({
        tempId,
        title,
        description,
        projectId: projectId === 'general' ? null : projectId,
        projectName,
        assigneeUserId
      })

      // Await the server insert to obtain the new request id
      const created = await createRequest(
        targetConnectionId,
        title,
        description,
        projectId === 'general' ? null : projectId,
        assigneeUserId
      )
      
      // Only show success toast after server confirms
      if (created?.id) {
        toast.success('Request created successfully')
        // Notify parent with the created id so it can fetch and prepend the row
        onRequestCreated?.({ requestId: created.id, tempId })
      }
    } catch (error) {
      console.error('Error creating request:', error)
      toast.error('Failed to create request')
    }
  }, [canCreate, isGlobal, selectedConnectionId, connectionId, title, description, projectId, assigneeUserId, projects, onRequestCreated, onRequestOptimistic, onClose])
  
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
  
  // Get selected connection/client
  const _selectedConnection = isGlobal && selectedConnectionId
    ? connections.find(c => c.id === selectedConnectionId)
    : client
  
  // Connection options for global mode (for combobox)
  const connectionComboboxOptions = connections.map(c => ({
    value: c.id,
    label: c.name,
    avatar: c.logoUrl
  }))
  
  // Project options: General request + actual projects
  const projectOptions = [
    { value: 'general', label: 'General request' },
    ...projects.map(p => ({ value: p.id, label: p.name }))
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

            {/* Inline Fields: Client/Connection, Project, Assignee */}
            <div className="flex items-center gap-4 px-10">
              {/* Client/Connection - Dropdown in global mode, fixed in connection mode */}
              {isGlobal ? (
                <ListRow
                  avatar={true}
                  avatarUrl={selectedConnectionId ? connections.find(c => c.id === selectedConnectionId)?.logoUrl : undefined}
                  avatarFallback={!selectedConnectionId ? (
                    variant === 'client' ? (
                      <BuildingOffice weight="fill" className="text-white" />
                    ) : (
                      <Users weight="fill" className="text-white" />
                    )
                  ) : undefined}
                  text={selectedConnectionId ? connections.find(c => c.id === selectedConnectionId)?.name || (variant === 'agency' ? 'Client' : 'Agency') : (variant === 'agency' ? 'Client' : 'Agency')}
                  textColor={selectedConnectionId ? 'var(--color-base-text-primary)' : 'var(--color-base-text-tertiary)'}
                  comboboxSelectedValue={selectedConnectionId || null}
                  comboboxOptions={connectionComboboxOptions}
                  onComboboxSelect={(value) => {
                    setSelectedConnectionId(value)
                    // Reset project when connection changes
                    setProjectId('general')
                  }}
                  comboboxPlaceholder="Search connections…"
                  comboboxWidth="240px"
                  clearable={false}
                  borderRadius="4px"
                  className="[&>*]:!rounded-[4px]"
                />
              ) : (
                client && (
                  <ListRow
                    avatar={true}
                    avatarUrl={client.logoUrl}
                    text={client.name}
                    nonInteractive={true}
                    className="[&>*]:!rounded-[4px]"
                  />
                )
              )}

              {/* Project */}
              <div className="min-w-0 max-w-[150px]">
                <InlineEdit
                  type="badge"
                  value={projectId}
                  options={projectOptions}
                  onSave={setProjectId}
                  placeholder="General request"
                  searchPlaceholder="Search projects…"
                  clearable={false}
                  dividerIndex={0}
                  popoverWidth="240px"
                  badgeBorderRadius="4px"
                  maxHeight="210px"
                  className="h-6"
                />
              </div>

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

