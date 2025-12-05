'use client'

import { useCallback, useState } from 'react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { TaskDetailContent } from './TaskDetailContent'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { X, ArrowsOutSimple, DotsThree, LinkSimple, Trash } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { useConnection } from '../ConnectionContext'
import { deleteTask } from './actions'
import type { Task } from '../server'

// Helper hook to safely use connection context
function useConnectionSafe() {
  try {
    return useConnection()
  } catch {
    // Return default values when not in ConnectionProvider context
    return { isDisconnected: false }
  }
}

interface TaskDetailModalProps {
  taskData: {
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
    project?: {
      id: string
      name: string
    } | null
    status?: 'to_do' | 'in_progress' | 'on_hold' | 'done'
    dueDate?: string | null
    dueDateRaw?: string | null
    createdAt?: string
    createdByOrgId?: string
    createdByOrgType?: 'agency' | 'client'
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
  isOpen: boolean
  onClose: () => void
  onExpand: () => void
  onTaskUpdate?: (taskId: string, updates: { title?: string; description?: string; status?: 'to_do' | 'in_progress' | 'on_hold' | 'done'; assignee?: Task['assignee']; project?: { id: string; name: string } | null; dueDate?: string | null; dueDateRaw?: string | null; clientVisible?: boolean; clientVisibilityLocked?: boolean }) => void
  onTaskDeleted?: (taskId: string) => void
  connectionId: string
  currentOrgId: string
  variant?: 'agency' | 'client'
  activeUser?: {
    id: string
    firstName: string
    lastName: string
    avatarUrl?: string
  }
  initialComments?: Array<{
    id: string
    userId: string
    userName: string
    userAvatar?: string
    createdAt: Date
    text: string
  }>
  onCommentsUpdate?: (comments: Array<{
    id: string
    userId: string
    userName: string
    userAvatar?: string
    createdAt: Date
    text: string
  }>) => void
  isGlobalView?: boolean
  isDisconnected?: boolean // Optional prop for when used outside ConnectionProvider
  organizationType?: 'agency' | 'client' // Optional prop for when used outside ConnectionProvider
}

export function TaskDetailModal({ taskData, agencyMembers = [], projects = [], isOpen, onClose, onExpand, onTaskUpdate, onTaskDeleted, connectionId, currentOrgId, variant = 'agency', activeUser, initialComments = [], onCommentsUpdate, isGlobalView = false, isDisconnected: propIsDisconnected, organizationType: propOrganizationType }: TaskDetailModalProps) {
  // Use prop if provided, otherwise try to get from context
  const connectionContext = useConnectionSafe()
  const isDisconnected = propIsDisconnected !== undefined ? propIsDisconnected : connectionContext.isDisconnected
  const isClientOrg = propOrganizationType === 'client' || ('context' in connectionContext && connectionContext.context?.organization?.type === 'client')
  const [isActionsDropdownOpen, setIsActionsDropdownOpen] = useState(false)
  
  // All fields are editable (no restrictions)
  
  // Dialog title is simply "Task"
  const getDialogTitle = () => {
    return 'Task'
  }
  
  // Handle delete task
  const handleDeleteTask = async () => {
    if (!taskData?.taskId) return
    
    // Close modal immediately
    onClose()
    
    // Notify parent for optimistic update
    onTaskDeleted?.(taskData.taskId)
    
    // Actually delete the task from the database
    try {
      await deleteTask(taskData.taskId)
      toast.success('Task deleted')
      // Real-time subscription will handle UI updates
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Error deleting task:', error)
      }
      toast.error('Failed to delete task')
      // Note: Optimistic update already happened, but real-time will reconcile
    }
  }

  const handleCopyLink = useCallback(() => {
    if (!taskData?.taskId) return
    if (typeof window === 'undefined') {
      return
    }

    const currentPath = window.location.pathname
    const routeSegment = currentPath.startsWith('/agencies/')
      ? 'agencies'
      : currentPath.startsWith('/clients/')
        ? 'clients'
        : variant === 'agency'
          ? 'clients' // Agencies view clients
          : 'agencies' // Clients view agencies

    const clipboard = navigator?.clipboard
    if (!clipboard?.writeText) {
      toast.error('Clipboard unavailable')
      return
    }

    const fullUrl = `${window.location.origin}/${routeSegment}/${connectionId}/tasks/${taskData.taskId}`

    clipboard.writeText(fullUrl)
      .then(() => {
        toast.success('Link copied to clipboard')
        setIsActionsDropdownOpen(false)
      })
      .catch((error) => {
        console.error('Failed to copy task link:', error)
        toast.error('Failed to copy link')
      })
  }, [taskData, connectionId, variant, setIsActionsDropdownOpen])
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent 
        className="!max-w-[1200px] !w-[calc(100vw-10rem)] !max-h-[800px] !h-[calc(100vh-7.5rem)] overflow-hidden !p-0 !gap-0 !flex !flex-col" 
        showCloseButton={false}
      >
        {/* Header */}
        <div className="w-full flex items-center justify-between h-fit flex-shrink-0 pl-10 pr-4 py-4">
          <div className="flex items-center gap-2">
            <DialogTitle className="!text-[12px] !leading-[20px] !font-normal !tracking-[0.0025rem] !text-[var(--color-base-text-tertiary)]">
              {getDialogTitle()}
            </DialogTitle>
          </div>
          <div className="flex gap-0">
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
                {!isDisconnected && !isClientOrg && (
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
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onExpand()
              }}
              className="h-10 w-10 cursor-pointer transition-all duration-75 rounded-md hover:bg-interactive-surface-hover"
            >
              <ArrowsOutSimple className="w-[18px] h-[18px]" />
              <span className="sr-only">Expand</span>
            </Button>
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
        {taskData && (
          <div className="pl-10 pr-10 h-full min-h-0 flex flex-col">
            <TaskDetailContent 
              taskId={taskData.taskId}
              title={taskData.title}
              description={taskData.description}
              client={taskData.client}
              agency={taskData.agency}
              submittedBy={taskData.submittedBy}
              assignee={taskData.assignee}
              agencyMembers={agencyMembers}
              projects={projects}
              project={taskData.project}
              status={taskData.status}
              dueDate={taskData.dueDate}
              dueDateRaw={taskData.dueDateRaw}
              createdAt={taskData.createdAt}
              onTaskUpdate={onTaskUpdate}
              createdByOrgId={taskData.createdByOrgId}
              createdByOrgType={taskData.createdByOrgType}
              clientVisible={taskData.clientVisible}
              clientVisibilityLocked={taskData.clientVisibilityLocked ?? false}
              sourceRequestId={taskData.sourceRequestId}
              linkedRequest={taskData.linkedRequest}
              currentOrgId={currentOrgId}
              connectionId={connectionId}
              variant={variant}
              activeUser={activeUser}
              initialComments={initialComments}
              onCommentsUpdate={onCommentsUpdate}
              isGlobalView={isGlobalView}
              isDisconnected={isDisconnected}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

