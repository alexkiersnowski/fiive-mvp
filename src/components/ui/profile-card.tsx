"use client"

import Image from "next/image"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { X } from "@phosphor-icons/react"

interface ProfileCardProps {
  member: {
    // User data
    id: string
    first_name: string
    last_name: string
    email: string
    job_title?: string
    avatar_url?: string
    // Organization data
    organization: {
      id: string
      name: string
      logo_url?: string
    }
  }
  isOpen: boolean
  onClose: () => void
}

export function ProfileCard({ member, isOpen, onClose }: ProfileCardProps) {
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
          {/* Left Section - Organization Avatar */}
          <div 
            className="rounded-full flex items-center justify-center flex-shrink-0"
            style={{ 
              width: '100px', 
              height: '100px',
              background: 'var(--color-neutral-9, #8B8D98)'
            }}
          >
            {member.organization.logo_url ? (
              <Image
                src={member.organization.logo_url}
                alt={member.organization.name}
                width={100}
                height={100}
                className="rounded-full object-cover"
                draggable={false}
                unoptimized
              />
            ) : (
              <span className="text-2xl font-medium text-white">
                {member.organization.name?.[0]?.toUpperCase() || '?'}
              </span>
            )}
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
                {member.avatar_url ? (
                  <Image
                    src={member.avatar_url}
                    alt={`${member.first_name} ${member.last_name}`}
                    width={80}
                    height={80}
                    className="rounded-full object-cover"
                    draggable={false}
                    unoptimized
                  />
                ) : (
                  <span className="text-xl font-medium text-white">
                    {member.first_name?.[0] || ''}{member.last_name?.[0] || ''}
                  </span>
                )}
              </div>

              {/* User Details */}
              <div className="flex-1 min-w-0 w-full">
                {/* Name */}
                <h2 className="display-7-medium" style={{ color: 'var(--color-base-text-primary)' }}>
                  {member.first_name} {member.last_name}
                </h2>

                {/* Job Title */}
                <p className="text-md-regular" style={{ color: 'var(--color-base-text-primary)' }}>
                  {member.job_title || 'Job title'}
                </p>

                {/* Email */}
                <p className="text-sm-regular overflow-hidden text-ellipsis whitespace-nowrap" style={{ color: 'var(--color-base-text-tertiary)' }}>
                  {member.email}
                </p>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
