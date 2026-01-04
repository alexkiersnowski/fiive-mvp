'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { RequestDetailContent } from './RequestDetailContent'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { X, ArrowsOutSimple, DotsThree, FlowArrow, LinkSimple, Trash } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { useConnection } from '../ConnectionContext'
import type { Request } from '../server'

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
    status?: 'new' | 'in_review' | 'accepted' | 'canceled' | 'closed'
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
  onRequestUpdate?: (requestId: string, updates: { title?: string; description?: string; status?: 'new' | 'in_review' | 'accepted' | 'canceled' | 'closed'; assignee?: Request['assignee']; project?: { id: string; name: string } | null }) => void
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
  isDisconnected?: boolean // Optional prop for when used outside ConnectionProvider
}

// Helper hook to safely use connection context
function useConnectionSafe() {
  try {
    return useConnection()
  } catch {
    // Return default values when not in ConnectionProvider context
    return { isDisconnected: false }
  }
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
  isDisconnected: propIsDisconnected,
}: RequestDetailModalProps) {
  // Use prop if provided, otherwise try to get from context
  const connectionContext = useConnectionSafe()
  const isDisconnected = propIsDisconnected !== undefined ? propIsDisconnected : connectionContext.isDisconnected
  const [isActionsDropdownOpen, setIsActionsDropdownOpen] = useState(false)
  
  // Determine if this is a client-submitted request
  const isClientSubmitted = requestData?.createdByOrgType === 'client'
  
  // Calculate canDelete permission (same logic as RequestDetailContent)
  const canClientDelete = variant === 'client' && isClientSubmitted && requestData?.status === 'new'
  const canAgencyDelete = variant === 'agency' && !isClientSubmitted && !isDisconnected
  const canDelete = variant === 'client' ? canClientDelete : canAgencyDelete
  
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

    const fullUrl = `${window.location.origin}/${routeSegment}/${connectionId}/requests/${requestData.requestId}`

    clipboard.writeText(fullUrl)
      .then(() => {
        toast.success('Link copied to clipboard')
        setIsActionsDropdownOpen(false)
      })
      .catch((error) => {
        console.error('Failed to copy request link:', error)
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
                {!isDisconnected && variant === 'agency' && (
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
                {canDelete && (
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
              isDisconnected={isDisconnected}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

