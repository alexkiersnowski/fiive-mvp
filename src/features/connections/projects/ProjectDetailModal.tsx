'use client'

import React, { useState } from 'react'
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogHeader } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ProjectDetailContent } from './ProjectDetailContent'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { X, ArrowsOutSimple, DotsThree, LinkSimple, Trash } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { deleteProject } from './actions'
import type { Project } from '../server'
import { useConnection } from '../ConnectionContext'

interface ProjectDetailModalProps {
  projectData: {
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
    type?: string | null
    status?: 'planned' | 'active' | 'on_hold' | 'completed' | 'canceled'
    startDate?: string
    endDate?: string
    createdAt?: string
    requestsCount?: number
    tasksCount?: number
    createdByOrgId?: string
    createdByOrgType?: 'agency' | 'client'
  } | null
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
  onExpand: () => void
  onProjectUpdate?: (projectId: string, updates: { title?: string; description?: string; status?: 'planned' | 'active' | 'on_hold' | 'completed' | 'canceled'; assignee?: Project['assignee'] }) => void
  onProjectDeleted?: (projectId: string) => void
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
}

export function ProjectDetailModal({ projectData, agencyMembers = [], isOpen, onClose, onExpand, onProjectUpdate, onProjectDeleted, connectionId, currentOrgId, variant = 'agency', activeUser, initialComments = [], onCommentsUpdate }: ProjectDetailModalProps) {
  const { isDisconnected } = useConnection()
  const [isActionsDropdownOpen, setIsActionsDropdownOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  
  // Determine dialog title based on organization type that created the project
  const getDialogTitle = () => {
    return 'Project'
  }
  
  // Handle copy link
  const handleCopyLink = () => {
    if (!projectData?.projectId || !connectionId) return
    if (typeof window === 'undefined') return

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

    const fullUrl = `${window.location.origin}/${routeSegment}/${connectionId}/projects/${projectData.projectId}`

    clipboard.writeText(fullUrl)
      .then(() => {
        toast.success('Link copied to clipboard')
        setIsActionsDropdownOpen(false)
      })
      .catch((error) => {
        console.error('Failed to copy project link:', error)
        toast.error('Failed to copy link')
      })
  }
  
  // Handle delete project click (opens confirmation dialog)
  const handleDeleteProject = () => {
    setDeleteDialogOpen(true)
  }

  // Confirm delete project (optimistic)
  const confirmDeleteProject = async () => {
    if (!projectData?.projectId) return
    
    // Close confirmation dialog immediately
    setDeleteDialogOpen(false)
    
    // Close modal immediately
    onClose()
    
    // Show success toast immediately
    toast.success('Project deleted')
    
    // Update table optimistically
    onProjectDeleted?.(projectData.projectId)
    
    // Delete in background
    deleteProject(projectData.projectId).catch((error) => {
      console.error('Error deleting project:', error)
      toast.error('Failed to delete project')
    })
  }
  
  return (
    <>
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent 
        className="!max-w-[1080px] !max-h-[800px] !min-h-[500px] overflow-hidden !p-0 !gap-0 !flex !flex-col" 
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
                <DropdownMenuItem onClick={handleCopyLink}>
                  <LinkSimple size={16} style={{ color: 'var(--color-base-text-primary)' }} />
                  Copy link
                </DropdownMenuItem>
                {!isDisconnected && variant === 'agency' && (
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
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={onExpand}
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
        {projectData && (
          <div className="pl-10 pr-10 min-h-[427px] h-full flex flex-col">
            <ProjectDetailContent 
              projectId={projectData.projectId}
              title={projectData.title}
              description={projectData.description}
              client={projectData.client}
              agency={projectData.agency}
              submittedBy={projectData.submittedBy}
              assignee={projectData.assignee}
              agencyMembers={agencyMembers}
              type={projectData.type}
              status={projectData.status}
              startDate={projectData.startDate}
              endDate={projectData.endDate}
              createdAt={projectData.createdAt}
              requestsCount={projectData.requestsCount}
              tasksCount={projectData.tasksCount}
              onProjectUpdate={onProjectUpdate}
              createdByOrgId={projectData.createdByOrgId}
              createdByOrgType={projectData.createdByOrgType}
              currentOrgId={currentOrgId}
              connectionId={connectionId}
              variant={variant}
              activeUser={activeUser}
              initialComments={initialComments}
              onCommentsUpdate={onCommentsUpdate}
              isDisconnected={isDisconnected}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>

    {/* Delete Project Confirmation Dialog */}
    <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
      <DialogContent style={{ padding: '24px', width: '460px', gap: '0.75rem' }} className="[&>button]:hidden h-auto">
        <DialogHeader className="space-y-0">
          <DialogTitle className="display-5-medium mb-0">
            Delete project &quot;{projectData?.title}&quot;?
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
  </>
  )
}

