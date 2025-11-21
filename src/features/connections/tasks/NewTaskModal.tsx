'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Dialog, DialogContent, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { InlineEdit, InlineEditRef } from '@/components/ui/inline-edit'
import { ListRow } from '@/components/ui/list-row'
import { X, Users, BuildingOffice } from '@phosphor-icons/react'
import { createTask, fetchProjectsForConnection, fetchMembersForConnection } from './actions'
import { toast } from 'sonner'

interface NewTaskModalProps {
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
    assignee?: {
      id: string
      name: string
      email: string
      avatarUrl?: string
    } | null
    clientVisible?: boolean
    clientVisibilityLocked?: boolean
  }) => void
  onTaskCreated?: (payload: { taskId: string; tempId?: string }) => void
  connectionId?: string // Optional for global mode
  currentOrgId: string
  variant?: 'agency' | 'client'
  isGlobal?: boolean // If true, show client dropdown instead of fixed client
  onConnectionSelect?: (connectionId: string) => void // Callback when connection is selected in global mode
}

export function NewTaskModal({ 
  client, 
  connections = [],
  agencyMembers = [], 
  projects: providedProjects, 
  isOpen, 
  onClose, 
  onTaskOptimistic, 
  onTaskCreated, 
  connectionId, 
  currentOrgId, 
  variant = 'agency',
  isGlobal = false,
  onConnectionSelect
}: NewTaskModalProps) {
  // Refs for controlling InlineEdit focus
  const titleRef = useRef<InlineEditRef>(null)
  const descriptionRef = useRef<InlineEditRef>(null)
  
  // Local state for form fields
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [selectedConnectionId, setSelectedConnectionId] = useState<string>('')
  const [projectId, setProjectId] = useState<string>('')
  const [assigneeUserId, setAssigneeUserId] = useState<string | null>(null)
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>(providedProjects || [])
  const [connectionMembers, setConnectionMembers] = useState<Array<{
    id: string
    firstName: string
    lastName: string
    email: string
    avatarUrl?: string
    jobTitle?: string
    orgId?: string
    orgName?: string
    orgType?: 'agency' | 'client'
  }>>([])
  
  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setTimeout(() => {
        setTitle('')
        setDescription('')
        setSelectedConnectionId('')
        setProjectId('')
        setAssigneeUserId(null)
        setProjects([])
        setConnectionMembers([])
      }, 300)
    }
  }, [isOpen])
  
  // Sync providedProjects prop to local state
  useEffect(() => {
    if (providedProjects && providedProjects.length > 0) {
      setProjects(providedProjects)
    }
  }, [providedProjects])
  
  const hasAutoSelectedRef = useRef(false)
  
  // Auto-select connection if only one available in global mode
  useEffect(() => {
    if (isGlobal && isOpen && connections.length === 1 && !selectedConnectionId && !hasAutoSelectedRef.current) {
      const connectionId = connections[0].id
      setSelectedConnectionId(connectionId)
      hasAutoSelectedRef.current = true
      // Immediately notify parent and fetch projects + members
      onConnectionSelect?.(connectionId)
      fetchProjectsForConnection(connectionId)
        .then(setProjects)
        .catch(() => {
          setProjects([])
        })
      fetchMembersForConnection(connectionId)
        .then(({ agencyMembers, clientMembers }) => {
          const allMembers = [...agencyMembers, ...clientMembers]
          setConnectionMembers(allMembers)
        })
        .catch(() => {
          setConnectionMembers([])
        })
    }
    // Reset refs when modal closes
    if (!isOpen) {
      hasAutoSelectedRef.current = false
      prevSelectedConnectionIdRef.current = ''
    }
  }, [isGlobal, isOpen, connections, selectedConnectionId, onConnectionSelect])

  // Track previous selectedConnectionId to detect manual changes
  const prevSelectedConnectionIdRef = useRef<string>('')
  
  // Fetch projects and members when connection is manually selected in global mode
  useEffect(() => {
    if (isGlobal && selectedConnectionId && selectedConnectionId !== prevSelectedConnectionIdRef.current) {
      // Skip the initial auto-select (already handled by auto-select useEffect)
      const wasAutoSelected = hasAutoSelectedRef.current && prevSelectedConnectionIdRef.current === ''
      if (!wasAutoSelected) {
        // Reset project selection and assignee when connection changes
        setProjectId('')
        setAssigneeUserId(null)
        // Notify parent of connection selection
        onConnectionSelect?.(selectedConnectionId)
        
        // Fetch projects for the selected connection
        fetchProjectsForConnection(selectedConnectionId)
          .then(setProjects)
          .catch(error => {
            console.error('Error fetching projects:', error)
            setProjects([])
          })
        
        // Fetch members (both agency and client) for the selected connection
        fetchMembersForConnection(selectedConnectionId)
          .then(({ agencyMembers, clientMembers }) => {
            // Combine both agency and client members
            const allMembers = [...agencyMembers, ...clientMembers]
            setConnectionMembers(allMembers)
          })
          .catch(error => {
            console.error('Error fetching members:', error)
            setConnectionMembers([])
          })
      }
      prevSelectedConnectionIdRef.current = selectedConnectionId
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
  
  // Handle create task
  const handleCreateTask = useCallback(async () => {
    if (!canCreate) return
    
    // Determine the connection ID to use
    const targetConnectionId = isGlobal ? selectedConnectionId : connectionId
    if (!targetConnectionId) return
    
    // Close modal immediately for snappy UX
    onClose()
    
    try {
      // Look up project name from projects list
      const selectedProject = !projectId || projectId === '' ? null : projects.find(p => p.id === projectId)
      const projectName = selectedProject ? selectedProject.name : null
      
      // Look up assignee details from members list
      const assigneeMember = assigneeUserId ? membersToUse.find(m => m.id === assigneeUserId) : null
      const assigneeData = assigneeMember ? {
        id: assigneeMember.id,
        name: `${assigneeMember.firstName} ${assigneeMember.lastName}`.trim() || assigneeMember.email,
        email: assigneeMember.email,
        avatarUrl: assigneeMember.avatarUrl
      } : null
      
      // Determine if assignee is a client member (for visibility logic)
      const isClientMemberAssignee = assigneeMember && 'orgType' in assigneeMember && assigneeMember.orgType === 'client'
      
      // Emit optimistic row with temp id immediately
      const tempId = `temp-${Date.now()}`
      onTaskOptimistic?.({
        tempId,
        title,
        description,
        projectId: !projectId || projectId === '' ? null : projectId,
        projectName,
        assigneeUserId,
        assignee: assigneeData,
        clientVisible: isClientMemberAssignee ? true : false,
        clientVisibilityLocked: isClientMemberAssignee ? true : false
      })

      // Await the server insert to obtain the new task id
      const created = await createTask(
        targetConnectionId,
        title,
        description,
        !projectId || projectId === '' ? null : projectId,
        assigneeUserId
      )
      
      // Only show success toast after server confirms
      if (created?.id) {
        toast.success('Task created successfully')
        // Notify parent with the created id so it can fetch and prepend the row
        ;(onTaskCreated as any)?.({ taskId: created.id, tempId })
      }
    } catch (error) {
      console.error('Error creating task:', error)
      toast.error('Failed to create task')
    }
  }, [canCreate, isGlobal, selectedConnectionId, connectionId, title, description, projectId, assigneeUserId, projects, onTaskCreated, onTaskOptimistic, onClose])
  
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
  // In global mode: use connectionMembers if connection selected, otherwise use agencyMembers (active org members)
  // In connection-specific mode: use agencyMembers
  const membersToUse = isGlobal 
    ? (selectedConnectionId ? connectionMembers : agencyMembers)
    : agencyMembers
  const selectedAssignee = assigneeUserId 
    ? membersToUse.find(m => m.id === assigneeUserId) 
    : null
  
  // Get selected connection/client
  const selectedConnection = isGlobal && selectedConnectionId
    ? connections.find(c => c.id === selectedConnectionId)
    : client
  
  // Connection options for global mode (for combobox)
  const connectionComboboxOptions = connections.map(c => ({
    value: c.id,
    label: c.name,
    avatar: c.logoUrl
  }))
  
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
              {/* Client/Connection - Show dropdown in global mode */}
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
                  onComboboxSelect={(value: string) => setSelectedConnectionId(value)}
                  comboboxPlaceholder="Search clients…"
                  comboboxWidth="240px"
                  clearable={false}
                  borderRadius="4px"
                  className="[&>*]:!rounded-[4px]"
                />
              ) : selectedConnection ? (
                <ListRow
                  avatar={true}
                  avatarUrl={selectedConnection.logoUrl}
                  text={selectedConnection.name}
                  nonInteractive={true}
                  className="[&>*]:!rounded-[4px]"
                />
              ) : null}

              {/* Project - Only show if not in global mode OR if connection is selected in global mode */}
              {(!isGlobal || selectedConnectionId) && (
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
              )}

              {/* Assignee - Only for agency view */}
              {variant === 'agency' && (
                <ListRow
                  avatar={true}
                  avatarUrl={selectedAssignee?.avatarUrl}
                  text={selectedAssignee ? `${selectedAssignee.firstName} ${selectedAssignee.lastName}` : 'Assignee'}
                  textColor={!selectedAssignee ? 'var(--color-base-text-tertiary)' : undefined}
                  comboboxSelectedValue={assigneeUserId}
                  comboboxOptions={membersToUse.map(member => ({
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

