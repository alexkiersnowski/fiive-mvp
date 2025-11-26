'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { RequestDetailContent } from './RequestDetailContent'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { X, ArrowsOutSimple, DotsThree, FlowArrow, LinkSimple, Trash, LockSimple } from '@phosphor-icons/react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { toast } from 'sonner'

interface RequestDetailModalProps {
  requestData: {
    requestId: string
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
    status?: 'new' | 'in_review' | 'accepted' | 'canceled'
    createdAt?: string
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
  projects?: Array<{
    id: string
    name: string
  }>
  isOpen: boolean
  onClose: () => void
  onExpand: () => void
  onRequestUpdate?: (requestId: string, updates: { title?: string; description?: string; status?: 'new' | 'in_review' | 'accepted' | 'canceled'; assignee?: any; project?: { id: string; name: string } | null }) => void
  onRequestDeleted?: (requestId: string) => void
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
  onConvertToTask?: (request: RequestDetailModalProps['requestData']) => void
  isGlobalView?: boolean
}

export function RequestDetailModal({
  requestData,
  agencyMembers = [],
  projects = [],
  isOpen,
  onClose,
  onExpand,
  onRequestUpdate,
  onRequestDeleted,
  connectionId,
  currentOrgId,
  variant = 'agency',
  activeUser,
  initialComments = [],
  onCommentsUpdate,
  onConvertToTask,
  isGlobalView = false,
}: RequestDetailModalProps) {
  const [isActionsDropdownOpen, setIsActionsDropdownOpen] = useState(false)
  
  // Determine if the request is locked for editing based on view context and organization type
  // Agency view: locked if created by client
  // Client view: locked if created by agency
  const isLocked = (() => {
    if (!requestData?.createdByOrgType) return false
    if (variant === 'agency') {
      return requestData.createdByOrgType === 'client'
    } else {
      return requestData.createdByOrgType === 'agency'
    }
  })()
  
  // Determine dialog title based on organization type that created the request
  const getDialogTitle = () => {
    if (!requestData?.createdByOrgType) return 'Request'
    
    if (requestData.createdByOrgType === 'agency') {
      return variant === 'client' ? 'Request — Created by your agency' : 'Request — Agency created'
    } else {
      return variant === 'client' ? 'Request — Submitted to your agency' : 'Request — Client submitted'
    }
  }
  
  // Handle copy link
  const handleCopyLink = () => {
    if (!requestData?.requestId || !connectionId) return
    
    // Determine baseRoute based on variant
    // Agencies view clients, clients view agencies
    const baseRoute = variant === 'agency' ? 'clients' : 'agencies'
    const fullUrl = `${window.location.origin}/${baseRoute}/${connectionId}/requests/${requestData.requestId}`
    
    navigator.clipboard.writeText(fullUrl).then(() => {
      toast.success('Link copied to clipboard')
      setIsActionsDropdownOpen(false)
    }).catch(() => {
      toast.error('Failed to copy link')
    })
  }
  
  // Handle delete request (optimistic)
  const handleDeleteRequest = async () => {
    if (!requestData?.requestId) return
    
    // Close modal immediately
    onClose()
    
    // Notify parent - parent handles optimistic update, API call, and toast notification
    // Parent will show success toast after server confirms and handle error recovery if API call fails
    onRequestDeleted?.(requestData.requestId)
  }
  
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
            {isLocked && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center justify-center">
                    <LockSimple 
                      size={12} 
                      weight="fill"
                      style={{ color: 'var(--color-base-text-tertiary)' }}
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" align="center" sideOffset={8}>
                  <div className="text-xs text-center">
                    {variant === 'client' 
                      ? 'Created on your behalf. View and comment only.'
                      : 'You can update status and assignee only'
                    }
                  </div>
                </TooltipContent>
              </Tooltip>
            )}
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
                {variant === 'agency' && (
                  <DropdownMenuItem
                    onClick={() => {
                      setIsActionsDropdownOpen(false)
                      if (requestData) {
                        onClose()
                        setTimeout(() => {
                          onConvertToTask?.(requestData)
                        }, 175)
                      }
                    }}
                  >
                    <FlowArrow size={16} style={{ color: 'var(--color-base-text-primary)' }} />
                    Convert to task
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={handleCopyLink}>
                  <LinkSimple size={16} style={{ color: 'var(--color-base-text-primary)' }} />
                  Copy link
                </DropdownMenuItem>
                {!isLocked && (
                  <>
                    <div className="border-t border-[var(--color-neutral-6)] my-1" />
                    <DropdownMenuItem 
                      onClick={() => {
                        handleDeleteRequest()
                        setIsActionsDropdownOpen(false)
                      }}
                      style={{ color: 'var(--color-red-11)' }}
                    >
                      <Trash size={16} style={{ color: 'var(--color-red-11)' }} />
                      Delete request
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
        {requestData && (
          <div className="pl-10 pr-10 h-full min-h-0 flex flex-col">
            <RequestDetailContent 
              requestId={requestData.requestId}
              title={requestData.title}
              description={requestData.description}
              client={requestData.client}
              agency={requestData.agency}
              submittedBy={requestData.submittedBy}
              assignee={requestData.assignee}
              agencyMembers={agencyMembers}
              projects={projects}
              project={requestData.project}
              status={requestData.status}
              createdAt={requestData.createdAt}
              onRequestUpdate={onRequestUpdate}
              createdByOrgId={requestData.createdByOrgId}
              createdByOrgType={requestData.createdByOrgType}
              currentOrgId={currentOrgId}
              connectionId={connectionId}
              variant={variant}
              activeUser={activeUser}
              initialComments={initialComments}
              onCommentsUpdate={onCommentsUpdate}
              onConvertToTask={(request) => {
                onConvertToTask?.({
                  requestId: request.requestId,
                  title: request.title,
                  description: request.description,
                  client: request.client,
                  agency: request.agency,
                  submittedBy: request.submittedBy,
                  assignee: request.assignee,
                  project: request.project,
                  status: request.status,
                  createdAt: request.createdAt,
                  createdByOrgId: request.createdByOrgId,
                  createdByOrgType: request.createdByOrgType,
                })
              }}
              isGlobalView={isGlobalView}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

