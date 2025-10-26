'use client'

import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { RequestDetailContent } from './RequestDetailContent'
import { X, ArrowsOut } from '@phosphor-icons/react'

interface RequestDetailModalProps {
  requestData: {
    requestId: string
    title: string
    description: string
  } | null
  isOpen: boolean
  onClose: () => void
  onExpand: () => void
}

export function RequestDetailModal({ requestData, isOpen, onClose, onExpand }: RequestDetailModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent 
        className="!max-w-[1600px] !w-[calc(100vw-10rem)] !max-h-[972px] !h-[calc(100vh-7.5rem)] overflow-auto !p-0 !gap-0 !flex !flex-col" 
        showCloseButton={false}
      >
        {/* Header */}
        <div className="w-full flex items-center justify-between h-fit flex-shrink-0 pl-10 pr-4 py-4">
          <DialogTitle className="!text-[14px] !leading-[20px] !font-normal !tracking-[0.0025rem] !text-[var(--color-base-text-tertiary)]">Request</DialogTitle>
          <div className="flex gap-2">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={onExpand}
              className="h-10 w-10 cursor-pointer transition-all duration-75 rounded-md hover:bg-interactive-surface-hover"
            >
              <ArrowsOut className="w-[18px] h-[18px]" />
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
          <div className="pl-10 pr-10 pb-10">
            <RequestDetailContent 
              requestId={requestData.requestId}
              title={requestData.title}
              description={requestData.description}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

