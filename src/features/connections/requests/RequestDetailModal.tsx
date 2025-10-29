'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { RequestDetailContent } from './RequestDetailContent'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { X, ArrowsOutSimple, DotsThree, FlowArrow, LinkSimple, Trash, LockSimple } from '@phosphor-icons/react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { toast } from 'sonner'
import { deleteRequest } from './actions'

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
    status?: 'new' | 'in_review' | 'accepted' | 'canceled'
    createdAt?: string
    createdByOrgId?: string
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
  onRequestUpdate?: (requestId: string, updates: { title?: string; description?: string; status?: 'new' | 'in_review' | 'accepted' | 'canceled'; assignee?: any }) => void
  onRequestDeleted?: (requestId: string) => void
  connectionId: string
  currentOrgId: string
}

export function RequestDetailModal({ requestData, agencyMembers = [], isOpen, onClose, onExpand, onRequestUpdate, onRequestDeleted, connectionId, currentOrgId }: RequestDetailModalProps) {
  const [isActionsDropdownOpen, setIsActionsDropdownOpen] = useState(false)
  
  // Determine if this is a client-submitted request (locked for editing)
  const isClientSubmitted = requestData?.createdByOrgId && requestData.createdByOrgId !== currentOrgId
  
  // Determine dialog title based on who created the request
  const getDialogTitle = () => {
    if (!requestData?.createdByOrgId) return 'Request'
    
    const isAgencyCreated = requestData.createdByOrgId === currentOrgId
    return isAgencyCreated ? 'Request — Agency created' : 'Request — Client submitted'
  }
  
  // Handle delete request (optimistic)
  const handleDeleteRequest = async () => {
    if (!requestData?.requestId) return
    
    // Close modal immediately
    onClose()
    
    // Show success toast immediately
    toast.success('Request deleted')
    
    // Update table optimistically
    onRequestDeleted?.(requestData.requestId)
    
    // Delete in background
    deleteRequest(requestData.requestId).catch((error) => {
      console.error('Error deleting request:', error)
      toast.error('Failed to delete request')
    })
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
            {isClientSubmitted && (
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
                    You can update status and assignee only
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
                <DropdownMenuItem onClick={() => setIsActionsDropdownOpen(false)}>
                  <FlowArrow size={16} style={{ color: 'var(--color-base-text-primary)' }} />
                  Convert to task
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setIsActionsDropdownOpen(false)}>
                  <LinkSimple size={16} style={{ color: 'var(--color-base-text-primary)' }} />
                  Copy link
                </DropdownMenuItem>
                {!isClientSubmitted && (
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
        {requestData && (
          <div className="pl-10 pr-10 h-full min-h-0 flex flex-col">
            <RequestDetailContent 
              requestId={requestData.requestId}
              title={requestData.title}
              description={requestData.description}
              client={requestData.client}
              submittedBy={requestData.submittedBy}
              assignee={requestData.assignee}
              agencyMembers={agencyMembers}
              type={requestData.type}
              status={requestData.status}
              createdAt={requestData.createdAt}
              onRequestUpdate={onRequestUpdate}
              createdByOrgId={requestData.createdByOrgId}
              currentOrgId={currentOrgId}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

