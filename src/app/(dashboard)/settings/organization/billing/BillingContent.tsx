"use client"

/**
 * TODO: Defer Delete Organization
 * 
 * Hide "Delete workspace" in UI for now (for now just display contact Fiive support)
 * Implement only after Stripe subscriptions + webhooks + cancellation logic are live.
 * 
 * Current state: Delete workspace button is hidden, always shows "contact Fiive support" message
 */

import * as React from "react"
import { Separator } from '@/components/ui/separator'
import { Check, StarFour } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/shadcn-io/spinner'
import { Badge } from '@/components/ui/badge'

interface BillingContentProps {
  variant: 'agency' | 'client'
  canDeleteWorkspace: boolean
  organizationName: string
}

export default function BillingContent({ variant, canDeleteWorkspace, organizationName }: BillingContentProps) {
  const isAgency = variant === 'agency'
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = React.useState('')
  const [isDeleting, setIsDeleting] = React.useState(false)

  // Check if confirmation matches organization name (case-sensitive, trimmed)
  const isDeleteConfirmed = deleteConfirmation.trim() === organizationName.trim()

  const handleDeleteWorkspace = async () => {
    // Validate confirmation matches organization name
    if (!isDeleteConfirmed) {
      return
    }

    // TODO: Wire up to database
    setIsDeleting(true)
    // Placeholder for future implementation
    setTimeout(() => {
      setIsDeleting(false)
      setDeleteDialogOpen(false)
      setDeleteConfirmation('')
    }, 1000)
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="display-9-medium" style={{ color: 'var(--color-base-text-primary, #1C2024)', marginBottom: '0.75rem' }}>
          Billing & subscription
        </h1>
        <p className="text-sm" style={{ color: 'var(--color-base-text-secondary, rgba(3, 9, 26, 0.72))' }}>
          Manage your subscription and billing details
        </p>
      </div>

      <div style={{ marginTop: 'var(--spacing-7, 40px)', marginBottom: '40px', display: 'flex', gap: 'var(--spacing-4, 16px)', alignItems: 'flex-start' }}>
      {/* First card - Agency premium */}
      <div
        style={{
          width: '100%',
          maxWidth: '552px',
          padding: 'var(--spacing-5, 24px)',
          borderRadius: 'var(--radius-5, 12px)',
          border: '1px solid var(--color-neutral-alpha-4, rgba(0, 0, 45, 0.09))',
          background: 'var(--color-base-surface-page-background, #ffffff)'
        }}
      >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 className="display-5-medium" style={{ color: 'var(--color-base-text-primary)' }}>
              Agency premium
            </h3>
            <Badge 
              variant="secondary" 
              className="flex items-center gap-1 bg-orange-3 font-medium text-xs tracking-wide"
              style={{ color: 'var(--color-orange-11)' }}
            >
              <StarFour 
                size={12} 
                weight="fill"
                style={{ fill: 'var(--color-orange-11)' }}
              />
              Founding member
            </Badge>
          </div>
          <div 
            style={{ 
              marginTop: 'var(--spacing-5, 24px)',
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              flexWrap: 'wrap'
            }}
          >
            <div style={{ 
              display: 'flex', 
              alignItems: 'baseline', 
              gap: 'var(--spacing-2, 8px)',
              marginRight: 'var(--spacing-2, 8px)',
              flexShrink: 0
            }}>
              <span className="display-8-medium" style={{ color: 'var(--color-base-text-primary)' }}>
                €99
              </span>
              <span className="text-xl-medium" style={{ color: 'var(--color-base-text-tertiary)' }}>
                / month
              </span>
            </div>
            <span 
              className="text-xs-regular" 
              style={{ 
                color: 'var(--color-base-text-tertiary)',
                textAlign: 'right',
                alignSelf: 'flex-end'
              }}
            >
              Billed annually (€1,188 / year)
            </span>
          </div>
          <div style={{ marginTop: 'var(--spacing-5, 24px)' }}>
            <Separator />
          </div>
          <div style={{ marginTop: 'var(--spacing-5, 24px)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-2, 8px)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2, 8px)' }}>
                <Check size={16} style={{ color: 'var(--color-base-text-secondary)' }} />
                <span className="text-sm-regular" style={{ color: 'var(--color-base-text-secondary)' }}>
                  Unlimited clients
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2, 8px)' }}>
                <Check size={16} style={{ color: 'var(--color-base-text-secondary)' }} />
                <span className="text-sm-regular" style={{ color: 'var(--color-base-text-secondary)' }}>
                  Unlimited live connections
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2, 8px)' }}>
                <Check size={16} style={{ color: 'var(--color-base-text-secondary)' }} />
                <span className="text-sm-regular" style={{ color: 'var(--color-base-text-secondary)' }}>
                  Unlimited team members
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2, 8px)' }}>
                <Check size={16} style={{ color: 'var(--color-base-text-secondary)' }} />
                <span className="text-sm-regular" style={{ color: 'var(--color-base-text-secondary)' }}>
                  Full client & relationship visibility
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2, 8px)' }}>
                <Check size={16} style={{ color: 'var(--color-base-text-secondary)' }} />
                <span className="text-sm-regular" style={{ color: 'var(--color-base-text-secondary)' }}>
                  Requests, projects & task management
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2, 8px)' }}>
                <Check size={16} style={{ color: 'var(--color-base-text-secondary)' }} />
                <span className="text-sm-regular" style={{ color: 'var(--color-base-text-secondary)' }}>
                  Shared links & resources
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2, 8px)' }}>
                <Check size={16} style={{ color: 'var(--color-base-text-secondary)' }} />
                <span className="text-sm-regular" style={{ color: 'var(--color-base-text-secondary)' }}>
                  All current & future features
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2, 8px)' }}>
                <Check size={16} style={{ color: 'var(--color-base-text-secondary)' }} />
                <span className="text-sm-regular" style={{ color: 'var(--color-base-text-secondary)' }}>
                  Priority onboarding & support
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2, 8px)' }}>
                <Check size={16} style={{ color: 'var(--color-base-text-secondary)' }} />
                <span className="text-sm-regular" style={{ color: 'var(--color-base-text-secondary)' }}>
                  Directly influence the future of Fiive
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2, 8px)' }}>
                <Check size={16} style={{ color: 'var(--color-base-text-secondary)' }} />
                <span className="text-sm-regular" style={{ color: 'var(--color-base-text-secondary)' }}>
                  Founding member rate locked for life
                </span>
              </div>
            </div>
          </div>
          <div style={{ marginTop: 'var(--spacing-5, 24px)' }}>
            <Button 
              variant="outline" 
              className="w-full"
              style={{
                pointerEvents: 'none',
                boxShadow: 'none',
                cursor: 'default',
                height: '40px'
              }}
            >
              Current plan
            </Button>
          </div>
          <div style={{ marginTop: 'var(--spacing-5, 24px)' }}>
            <p className="text-xs-regular" style={{ color: 'var(--color-base-text-tertiary)' }}>
              Want to make changes?{' '}
              <a 
                href="#" 
                className="text-xs-regular underline"
                style={{ color: 'var(--color-base-text-secondary)' }}
              >
                Manage your plan
              </a>
            </p>
          </div>
          <div style={{ marginTop: 'var(--spacing-2, 8px)' }}>
            <p className="text-xs-regular" style={{ color: 'var(--color-base-text-tertiary)' }}>
              Founding rate only applies with an active annual subscription. If you cancel, you&apos;ll lose your founding plan and locked-in price. If you rejoin later, standard pricing will apply.
            </p>
          </div>
        </div>

      {/* Second card - Payment method */}
      <div
        style={{
          width: '100%',
          maxWidth: '552px',
          padding: 'var(--spacing-5, 24px)',
          borderRadius: 'var(--radius-5, 12px)',
          border: '1px solid var(--color-neutral-alpha-4, rgba(0, 0, 45, 0.09))',
          background: 'var(--color-base-surface-page-background, #ffffff)'
        }}
      >
        <h3 className="text-xl-medium" style={{ color: 'var(--color-base-text-primary)' }}>
          Payment method
        </h3>
        <p 
          className="text-sm-regular" 
          style={{ 
            color: 'var(--color-base-text-secondary)',
            marginTop: 'var(--spacing-1, 4px)'
          }}
        >
          You can manage your card details through Stripe.
        </p>
        <div style={{ marginTop: 'var(--spacing-5, 24px)' }}>
          <Button 
            variant="outline" 
            style={{ 
              height: '40px',
              boxShadow: 'none',
              cursor: 'pointer'
            }}
          >
            Manage payment method
          </Button>
        </div>
      </div>
    </div>

    {/* Delete Workspace Component - 16px below both cards */}
    {/* TODO: Re-enable delete workspace button after Stripe subscriptions + webhooks + cancellation logic are live */}
    <div style={{ marginTop: '16px', width: 'calc(50% - 8px)', maxWidth: '552px' }}>
      <div 
        className="flex items-center p-4 gap-4"
        style={{
          borderRadius: 'var(--radius-4, 8px)',
          border: '1px solid var(--color-neutral-alpha-4, rgba(0, 0, 47, 0.15))',
          background: 'var(--color-base-panel-default, rgba(255, 255, 255, 0.80))'
        }}
      >
        <div>
          <p className="text-xs-medium" style={{ color: 'var(--color-base-text-primary, #1C2024)', marginBottom: '4px' }}>
            Delete workspace
          </p>
          <p className="text-xs-regular" style={{ color: 'var(--color-base-text-tertiary, rgba(3, 9, 26, 0.56))' }}>
            To permanently delete this workspace and all associated data, please contact Fiive support.
          </p>
        </div>
        {/* Delete button hidden until Stripe subscriptions + webhooks + cancellation logic are live */}
        {false && canDeleteWorkspace && (
          <Button
            variant="outline"
            className="text-sm cursor-pointer"
            style={{
              borderColor: 'var(--color-semantic-destructive-border, #EF4444)',
              color: 'var(--color-semantic-destructive-text, #EF4444)',
              backgroundColor: 'transparent',
              height: '40px'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-semantic-destructive-surface-hover, #FEF2F2)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent'
            }}
            onClick={() => setDeleteDialogOpen(true)}
          >
            Delete workspace
          </Button>
        )}
      </div>
    </div>

    {/* Delete Workspace Dialog */}
    <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
      <DialogContent style={{ padding: '24px', width: '460px', gap: '0.75rem' }} className="[&>button]:hidden h-auto">
        <DialogHeader className="space-y-0">
          <DialogTitle className="display-5-medium mb-0">
            Delete your workspace
          </DialogTitle>
        </DialogHeader>
        <DialogDescription 
          className="text-sm-regular mb-0"
        >
          This will permanently remove your workspace and all associated data. This action cannot be undone.
        </DialogDescription>
        <div style={{ marginTop: '12px' }}>
          <div className="mb-2">
            <label className="text-sm font-medium" style={{ color: 'var(--color-base-text-primary, #1C2024)' }}>
              Confirm by typing your workspace name
            </label>
          </div>
          <Input
            placeholder={organizationName}
            value={deleteConfirmation}
            onChange={(e) => setDeleteConfirmation(e.target.value)}
            className="h-10 px-4 py-2 text-sm"
            maxLength={255}
          />
        </div>
        <div className="flex justify-end" style={{ marginTop: '12px', gap: '12px' }}>
          <Button 
            variant="ghost" 
            onClick={() => {
              setDeleteDialogOpen(false)
              setDeleteConfirmation('')
            }}
            style={{ height: '40px' }}
            className="cursor-pointer"
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button 
            variant="destructive"
            onClick={handleDeleteWorkspace}
            style={{ height: '40px' }}
            className="cursor-pointer relative"
            disabled={!isDeleteConfirmed || isDeleting}
          >
            <span className={isDeleting ? "invisible" : ""}>Delete</span>
            {isDeleting && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Spinner size={16} />
              </div>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
    </div>
  )
}
