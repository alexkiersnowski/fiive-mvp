"use client"

import * as React from "react"
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Check } from '@phosphor-icons/react'
import { Spinner } from '@/components/ui/shadcn-io/spinner'
import { toast } from 'sonner'

const CORE_FEATURES = [
  { text: 'Unlimited clients' },
  { text: 'Unlimited live connections' },
  { text: 'Unlimited team members' },
  { text: 'Requests, projects & task management' },
  { text: 'Price locked in while subscribed' }
]

interface PaywallModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function PaywallModal({ open, onOpenChange }: PaywallModalProps) {
  const [isCreatingCheckout, setIsCreatingCheckout] = React.useState(false)

  const handleCheckout = async () => {
    if (isCreatingCheckout) return
    
    setIsCreatingCheckout(true)
    try {
      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          billingPeriod: 'monthly' // Always monthly for paywall modal
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create checkout session')
      }

      const data = await response.json()
      
      if (data.url) {
        window.location.href = data.url
      } else {
        throw new Error('No checkout URL returned')
      }
    } catch (error) {
      console.error('Error creating checkout session:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to start checkout. Please try again.')
      setIsCreatingCheckout(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        style={{ 
          padding: '40px', 
          maxWidth: '640px', 
          gap: '0',
          borderRadius: 'var(--radius-5, 12px)',
          border: '1px solid var(--color-neutral-alpha-4, rgba(0, 0, 45, 0.09))',
          background: 'var(--color-base-surface-page-background, #ffffff)',
        }} 
        className="[&>button]:hidden h-auto"
        showCloseButton={true}
      >
        {/* Visually hidden title for accessibility */}
        <DialogTitle className="sr-only">
          Upgrade to Agency Pro
        </DialogTitle>
        
        {/* Header */}
        <div style={{ marginBottom: '32px' }}>
          <h2 className="display-7-medium" style={{ color: 'var(--color-base-text-primary)', marginBottom: '12px' }}>
            Upgrade to Agency Pro
          </h2>
          <p className="text-sm-regular" style={{ color: 'var(--color-base-text-secondary)'}}>
            Founding member access is limited to the first 100 agencies.
          </p>
          <p className="text-sm-regular" style={{ color: 'var(--color-base-text-secondary)' }}>
            Built for agencies managing clients at scale.
          </p>
        </div>

        {/* Features List */}
        <div style={{ marginBottom: '32px', display: 'flex', flexDirection: 'column', gap: 'var(--spacing-2, 8px)' }}>
          {CORE_FEATURES.map((feature, index) => (
            <div key={index} style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2, 8px)' }}>
              <Check size={16} style={{ color: 'var(--color-base-text-secondary)', flexShrink: 0 }} />
              <span className="text-sm-regular" style={{ color: 'var(--color-base-text-secondary)' }}>
                {feature.text}
              </span>
            </div>
          ))}
        </div>

        {/* Pricing */}
        <div style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--spacing-2, 8px)', marginBottom: '8px' }}>
            <span className="display-7-medium" style={{ color: 'var(--color-base-text-primary)' }}>
              €119
            </span>
            <span className="text-xl-medium" style={{ color: 'var(--color-base-text-tertiary)' }}>
              /month
            </span>
          </div>
          <p className="text-xs-regular" style={{ color: 'var(--color-base-text-tertiary)' }}>
            Founding member rate. Cancel anytime.
          </p>
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--spacing-3, 12px)' }}>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            style={{ height: '40px' }}
            className="cursor-pointer"
          >
            Not now
          </Button>
          <Button
            variant="default"
            onClick={handleCheckout}
            disabled={isCreatingCheckout}
            style={{ height: '40px' }}
            className="cursor-pointer relative"
          >
            <span className={isCreatingCheckout ? 'invisible' : ''}>Upgrade for €119/month</span>
            {isCreatingCheckout && (
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
