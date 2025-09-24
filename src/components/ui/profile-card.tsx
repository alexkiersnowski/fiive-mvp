"use client"

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { X } from "@phosphor-icons/react"

interface ProfileCardProps {
  user: {
    name: string
    email: string
    title?: string
    avatar?: string
  }
  workspaceAvatar?: string
  isOpen: boolean
  onClose: () => void
}

export function ProfileCard({ user, workspaceAvatar, isOpen, onClose }: ProfileCardProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className="sm:max-w-[620px]" 
        style={{ padding: '48px 40px' }}
        showCloseButton={false}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogTitle className="sr-only">User Profile</DialogTitle>
        
        {/* Custom Close Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="absolute p-2 hover:bg-gray-100 cursor-pointer transition-all duration-75"
          style={{ top: '16px', right: '16px', width: '32px', height: '32px' }}
        >
          <X size={16} className="text-gray-500" />
        </Button>
        

        {/* Content Wrapper with Separator Inside */}
        <div className="flex items-center w-full min-w-0">
          {/* Left Section - Workspace Avatar */}
          <div 
            className="rounded-full flex items-center justify-center flex-shrink-0"
            style={{ 
              width: '100px', 
              height: '100px',
              background: 'var(--color-neutral-9, #8B8D98)'
            }}
          >
            <span className="text-2xl font-medium text-white">E</span>
          </div>

          {/* Separator */}
          <Separator orientation="vertical" className="mx-6 flex-shrink-0" style={{ height: '140px' }} />

          {/* Right Section - User Profile */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-4 w-full min-w-0">
              {/* User Avatar */}
              <div 
                className="rounded-full flex items-center justify-center flex-shrink-0"
                style={{ 
                  width: '80px', 
                  height: '80px',
                  background: 'var(--color-neutral-9, #8B8D98)'
                }}
              >
                <span className="text-xl font-medium text-white">
                  {user.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                </span>
              </div>

              {/* User Details */}
              <div className="flex-1 min-w-0 w-full">
                {/* Name */}
                <h2 className="display-7-medium" style={{ color: 'var(--color-base-text-primary)' }}>
                  {user.name}
                </h2>

                {/* Job Title */}
                <p className="text-md-regular" style={{ color: 'var(--color-base-text-primary)' }}>
                  {user.title || 'Job title'}
                </p>

                {/* Email */}
                <p className="text-sm-regular overflow-hidden text-ellipsis whitespace-nowrap" style={{ color: 'var(--color-base-text-tertiary)' }}>
                  {user.email}
                </p>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
