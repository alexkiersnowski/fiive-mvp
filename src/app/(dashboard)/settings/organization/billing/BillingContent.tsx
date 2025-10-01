"use client"

import { Separator } from '@/components/ui/separator'
import { Check } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'

interface BillingContentProps {
  variant: 'agency' | 'client'
}

export default function BillingContent({ variant }: BillingContentProps) {
  const isAgency = variant === 'agency'
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

      <div style={{ marginTop: 'var(--spacing-7, 40px)', display: 'flex', gap: 'var(--spacing-4, 16px)', alignItems: 'flex-start' }}>
      {/* First card - Founding member */}
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
          Founding member
        </h3>
        <p 
          className="text-sm-regular" 
          style={{ 
            color: 'var(--color-base-text-secondary)',
            marginTop: 'var(--spacing-1, 4px)'
          }}
        >
          Full access to Fiive with founding member benefits, forever.
        </p>
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
                {isAgency ? 'Unlimited clients' : 'Unlimited agencies'}
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
                All current and future features
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2, 8px)' }}>
              <Check size={16} style={{ color: 'var(--color-base-text-secondary)' }} />
              <span className="text-sm-regular" style={{ color: 'var(--color-base-text-secondary)' }}>
                Guided onboarding & setup
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2, 8px)' }}>
              <Check size={16} style={{ color: 'var(--color-base-text-secondary)' }} />
              <span className="text-sm-regular" style={{ color: 'var(--color-base-text-secondary)' }}>
                Priority support
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2, 8px)' }}>
              <Check size={16} style={{ color: 'var(--color-base-text-secondary)' }} />
              <span className="text-sm-regular" style={{ color: 'var(--color-base-text-secondary)' }}>
                Influence upcoming features
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2, 8px)' }}>
              <Check size={16} style={{ color: 'var(--color-base-text-secondary)' }} />
              <span className="text-sm-regular" style={{ color: 'var(--color-base-text-secondary)' }}>
                Locked-in founding rate
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
    
    {/* Delete workspace section */}
    <div style={{ marginTop: 'var(--spacing-7, 40px)' }}>
      <h4 className="text-xs-medium" style={{ color: 'var(--color-base-text-primary)' }}>
        Delete workspace
      </h4>
      <p 
        className="text-xs-regular" 
        style={{ 
          color: 'var(--color-base-text-tertiary)',
          marginTop: 'var(--spacing-1, 4px)'
        }}
      >
        To permanently delete your agency and all associated data, contact Fiive support.
      </p>
    </div>
    </div>
  )
}
