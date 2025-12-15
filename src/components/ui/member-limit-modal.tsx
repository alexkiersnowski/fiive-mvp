"use client"

import * as React from "react"
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/shadcn-io/spinner'
import { signOut } from '@/app/(dashboard)/settings/actions'

interface MemberLimitModalProps {
  open: boolean
  ownerName?: string
  ownerEmail?: string
}

export function MemberLimitModal({ open, ownerEmail, ownerName: _ownerName }: MemberLimitModalProps) {
  const [isSigningOut, setIsSigningOut] = React.useState(false)

  const handleSignOut = async () => {
    if (isSigningOut) return
    
    setIsSigningOut(true)
    try {
      const result = await signOut()
      if (result.ok) {
        window.location.href = '/signin'
      } else {
        console.error('Sign out error:', result.message)
        setIsSigningOut(false)
      }
    } catch (error) {
      console.error('Error signing out:', error)
      setIsSigningOut(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent 
        style={{ 
          padding: '40px', 
          maxWidth: '540px', 
          gap: '0',
          borderRadius: 'var(--radius-5, 12px)',
          border: '1px solid var(--color-neutral-alpha-4, rgba(0, 0, 45, 0.09))',
          background: 'var(--color-base-surface-page-background, #ffffff)',
        }} 
        className="[&>button]:hidden h-auto"
        showCloseButton={false}
      >
        {/* Visually hidden title for accessibility */}
        <DialogTitle className="sr-only">
          Team member limit reached
        </DialogTitle>
        
        {/* Header */}
        <div style={{ marginBottom: '32px' }}>
          <h2 className="display-7-medium" style={{ color: 'var(--color-base-text-primary)', marginBottom: '12px' }}>
            Member limit reached
          </h2>
          <p className="text-sm-regular" style={{ color: 'var(--color-base-text-secondary)', marginBottom: ownerEmail ? '12px' : '0' }}>
          Your organization is limited to 2 team members on the Starter plan. Contact your owner to regain access or upgrade:
          </p>
          {ownerEmail && (
            <p className="text-sm-regular" style={{ color: 'var(--color-base-text-primary)' }}>
              {ownerEmail}
            </p>
          )}
        </div>

        {/* Sign Out Button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--spacing-3, 12px)' }}>
          <Button
            variant="default"
            onClick={handleSignOut}
            disabled={isSigningOut}
            style={{ height: '40px' }}
            className="cursor-pointer relative"
          >
            <span className={isSigningOut ? 'invisible' : ''}>Sign out</span>
            {isSigningOut && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Spinner size={16} />
              </div>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

