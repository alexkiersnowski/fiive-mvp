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
import { useSearchParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { PlanCard } from '@/components/ui/plan-card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Spinner } from '@/components/ui/shadcn-io/spinner'

// Feature constants for different plans
const STARTER_FEATURES_AGENCIES = [
  { text: '1 client' },
  { text: '2 team members' },
  { text: '1 inbound live connection (client-invited)' },
  { text: 'Manage workflows, requests, tasks & projects' }
]

const STARTER_FEATURES_CLIENTS = [
  { text: 'Unlimited agency invites' },
  { text: 'Unlimited team members' },
  { text: 'Submit requests, track tasks & projects' },
  { text: 'Access shared links & resources' }
]

const STARTER_FEATURE_SECTIONS = [
  {
    heading: 'For Agencies',
    features: STARTER_FEATURES_AGENCIES
  },
  {
    heading: 'For Clients',
    features: STARTER_FEATURES_CLIENTS
  }
]

const AGENCY_PRO_FEATURES = [
  { text: 'Unlimited clients' },
  { text: 'Unlimited team members' },
  { text: 'Unlimited live connections' },
  { text: 'Full client & relationship visibility' },
  { text: 'Requests, projects & task management' },
  { text: 'Shared links & resources' },
  { text: 'All current & future features' },
  { text: 'Priority onboarding & support' },
  { text: 'Directly influence the future of Fiive' },
  { text: 'Founding member rate locked for life' }
]

/**
 * Helper function to determine plan details from Stripe price ID
 * @param priceId - The Stripe price ID from the database
 * @param monthlyPriceId - The Stripe monthly price ID from environment
 * @param annualPriceId - The Stripe annual price ID from environment
 * @returns Plan details object or null if price ID is unknown
 */
function getPlanFromPriceId(
  priceId: string | null | undefined,
  monthlyPriceId: string | undefined,
  annualPriceId: string | undefined
): { name: string; price: string; isAnnual: boolean } | null {
  if (!priceId || !monthlyPriceId || !annualPriceId) return null

  if (priceId === monthlyPriceId) {
    return { name: 'Agency Pro', price: '119', isAnnual: false }
  }
  
  if (priceId === annualPriceId) {
    return { name: 'Agency Pro', price: '99', isAnnual: true }
  }

  return null
}

/**
 * Format renewal date as "Renews on DD Month YYYY"
 * @param dateString - ISO date string from database
 * @returns Formatted date string or null if invalid
 */
function formatRenewalDate(dateString: string | null | undefined): string | null {
  if (!dateString) return null
  
  try {
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return null
    
    const day = date.getDate()
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
    const month = monthNames[date.getMonth()]
    const year = date.getFullYear()
    
    return `Renews on ${day} ${month} ${year}`
  } catch {
    return null
  }
}

/**
 * Format cancellation date as "Cancels on DD Month YYYY"
 * @param dateString - ISO date string from database
 * @returns Formatted date string or null if invalid
 */
function formatCancellationDate(dateString: string | null | undefined): string | null {
  if (!dateString) return null
  
  try {
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return null
    
    const day = date.getDate()
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
    const month = monthNames[date.getMonth()]
    const year = date.getFullYear()
    
    return `Cancels on ${day} ${month} ${year}`
  } catch {
    return null
  }
}

/**
 * Format date as "DD Month YYYY"
 * @param dateString - ISO date string from database
 * @returns Formatted date string or null if invalid
 */
function formatDateOnly(dateString: string | null | undefined): string | null {
  if (!dateString) return null
  
  try {
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return null
    
    const day = date.getDate()
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
    const month = monthNames[date.getMonth()]
    const year = date.getFullYear()
    
    return `${day} ${month} ${year}`
  } catch {
    return null
  }
}

interface BillingContentProps {
  variant: 'agency' | 'client'
  billingStatus?: string
  sessionId?: string | null
  shouldShowDialog?: boolean
  stripePriceId?: string | null
  monthlyPriceId?: string
  annualPriceId?: string
  currentPeriodEnd?: string | null
}

export default function BillingContent({ variant: _variant, billingStatus, sessionId: initialSessionId, shouldShowDialog: initialShouldShowDialog, stripePriceId, monthlyPriceId, annualPriceId, currentPeriodEnd }: BillingContentProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [isCreatingCheckout, setIsCreatingCheckout] = React.useState(false)
  const [isCreatingPortal, setIsCreatingPortal] = React.useState(false)
  const [isManagingPlan, setIsManagingPlan] = React.useState(false)
  const [isAnnualBilling, setIsAnnualBilling] = React.useState(false) // Default: monthly billing
  const [isVerifyingSession, setIsVerifyingSession] = React.useState(false)
  const [showSuccessDialog, setShowSuccessDialog] = React.useState(initialShouldShowDialog || false)
  
  // Maintain optimistic billing status in local state to prevent flickering
  // Once we've set it optimistically, keep it until verification confirms
  const [optimisticBillingStatus, setOptimisticBillingStatus] = React.useState<string | null>(
    initialSessionId && initialShouldShowDialog ? 'active' : null
  )
  
  // Use optimistic billing status if we have one, otherwise use prop
  const effectiveBillingStatus = optimisticBillingStatus || billingStatus
  
  // Show dialog immediately if server-side verification indicated we should
  React.useEffect(() => {
    if (initialShouldShowDialog && initialSessionId) {
      // Set optimistic status to prevent flickering
      setOptimisticBillingStatus('active')
      // Don't clean up URL immediately - wait for verification to complete
      // This prevents premature re-render with stale data
    }
  }, [initialShouldShowDialog, initialSessionId])

  // Clear optimistic state only when prop billingStatus is confirmed 'active'
  // AND we're not in the middle of verification (to prevent flickering)
  React.useEffect(() => {
    if (optimisticBillingStatus === 'active' && billingStatus === 'active' && !isVerifyingSession) {
      // Real data has caught up and verification is complete, clear optimistic state
      setOptimisticBillingStatus(null)
    }
  }, [billingStatus, optimisticBillingStatus, isVerifyingSession])

  // Handle checkout session verification on mount (safety check)
  React.useEffect(() => {
    const sessionIdFromUrl = searchParams.get('session_id')
    const sessionId = sessionIdFromUrl || initialSessionId
    const canceled = searchParams.get('canceled')
    
    // Handle canceled checkout
    if (canceled === 'true') {
      toast.info('Checkout was canceled')
      // Clean up URL
      router.replace('/settings/organization/billing')
      return
    }
    
    // Handle successful checkout - verify session as safety check
    // Dialog is already shown from server-side verification, this just ensures DB is updated
    if (sessionId && !isVerifyingSession) {
      setIsVerifyingSession(true)
      
      const verifySession = async () => {
        try {
          const response = await fetch('/api/stripe/verify-session', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ session_id: sessionId }),
          })
          
          const data = await response.json()
          
          if (!response.ok) {
            // Don't show error to user if dialog is already shown - just log
            console.error('Client-side verification failed:', data.error)
            return
          }
          
          if (data.success) {
            // Update optimistic status to match verified status
            setOptimisticBillingStatus('active')
            // Clean up URL now that verification is complete
            if (searchParams.get('session_id') || initialSessionId) {
              router.replace('/settings/organization/billing')
            }
            // Only refresh if we actually updated something (not already processed)
            if (!data.alreadyProcessed) {
              router.refresh()
            }
          } else {
            // Verification didn't succeed, but clean up URL anyway
            if (searchParams.get('session_id') || initialSessionId) {
              router.replace('/settings/organization/billing')
            }
          }
        } catch (error) {
          // Don't show error to user if dialog is already shown - just log
          console.error('Error verifying checkout session:', error)
          // Clean up URL even on error
          if (searchParams.get('session_id') || initialSessionId) {
            router.replace('/settings/organization/billing')
          }
        } finally {
          setIsVerifyingSession(false)
        }
      }
      
      // Run verification in background without blocking UI
      verifySession()
    }
  }, [searchParams, router, isVerifyingSession, initialSessionId])

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
          billingPeriod: isAnnualBilling ? 'annual' : 'monthly' 
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

  const handlePortal = async (isPlanManagement: boolean = false) => {
    if (isPlanManagement) {
      setIsManagingPlan(true)
    } else {
      setIsCreatingPortal(true)
    }
    
    try {
      const response = await fetch('/api/stripe/create-portal-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create portal session')
      }

      const data = await response.json()
      
      if (data.url) {
        window.location.href = data.url
      } else {
        throw new Error('No portal URL returned')
      }
    } catch (error) {
      console.error('Error creating portal session:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to open billing portal. Please try again.')
      if (isPlanManagement) {
        setIsManagingPlan(false)
      } else {
        setIsCreatingPortal(false)
      }
    }
  }

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div>
        <h1 className="display-9-medium" style={{ color: 'var(--color-base-text-primary, #1C2024)', marginBottom: '0.75rem' }}>
          Plan & billing
        </h1>
        <p className="text-sm" style={{ color: 'var(--color-base-text-secondary, rgba(3, 9, 26, 0.72))' }}>
          Manage your plan, early access benefits, and subscription details.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 'var(--spacing-4, 16px)', alignItems: 'stretch' }}>
      {effectiveBillingStatus === 'free' ? (
        <>
          {/* Starter card */}
          <PlanCard
            title="Starter"
            price="0"
            currency="€"
            isActive={true}
            featureSections={STARTER_FEATURE_SECTIONS}
            onButtonClick={() => {
              // No-op: button is disabled for current plan
            }}
          />

          {/* Agency Pro card */}
          <PlanCard
            title="Agency Pro"
            price={isAnnualBilling ? "99" : "119"}
            currency="€"
            isActive={false}
            buttonText="Get early access"
            features={AGENCY_PRO_FEATURES}
            badge={{
              text: 'Only 100 spots',
              variant: 'outline',
              className: 'text-sm-regular rounded-full',
              style: { color: 'var(--color-base-text-primary)' }
            }}
            billingToggle={{
              isAnnual: isAnnualBilling,
              onToggle: setIsAnnualBilling,
              monthlyPrice: "119",
              annualPrice: "99"
            }}
            onButtonClick={handleCheckout}
          />
        </>
      ) : (
        <>
          {/* Agency Pro card - dynamically detected from stripe_price_id */}
          {(() => {
            const plan = getPlanFromPriceId(stripePriceId, monthlyPriceId, annualPriceId)
            // Fallback to monthly Pro if price ID is not found
            const displayPlan = plan || { name: 'Agency Pro', price: '119', isAnnual: false }
            const isCancelling = effectiveBillingStatus === 'canceled_pending'
            
            // Format renewal date if billing is active or past_due and date exists
            // Format cancellation date if billing is canceled_pending and date exists
            // Show cancellation date in renewalDate field when canceled_pending
            const renewalDate = (effectiveBillingStatus === 'active' || effectiveBillingStatus === 'past_due') && currentPeriodEnd
              ? formatRenewalDate(currentPeriodEnd)
              : null
            const cancellationDate = isCancelling && currentPeriodEnd
              ? formatCancellationDate(currentPeriodEnd)
              : null
            
            // Use cancellation date in renewalDate field when canceled_pending, otherwise use renewal date
            const displayDate = isCancelling ? cancellationDate : renewalDate
            
            // Description text to show below button
            const dateOnly = isCancelling && currentPeriodEnd ? formatDateOnly(currentPeriodEnd) : null
            const description = isCancelling ? (
              <p 
                className="text-xs-regular" 
                style={{ 
                  color: 'var(--color-base-text-tertiary)',
                  margin: 0
                }}
              >
                Full access remains until {dateOnly || 'the end of your billing period'}. Your founding rate stays locked while your subscription is active.
              </p>
            ) : (
              <>
                <p className="text-xs-regular" style={{ color: 'var(--color-base-text-tertiary)', margin: 0, marginBottom: 'var(--spacing-2, 8px)' }}>
                  Want to make changes?{' '}
                  <button
                    onClick={() => handlePortal(true)}
                    disabled={isManagingPlan}
                    className="text-xs-regular"
                    style={{
                      color: 'var(--color-base-text-secondary)',
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      cursor: isManagingPlan ? 'not-allowed' : 'pointer',
                      textDecoration: 'underline',
                      opacity: isManagingPlan ? 0.5 : 1
                    }}
                  >
                    Manage plan
                  </button>
                </p>
                <p 
                  className="text-xs-regular" 
                  style={{ 
                    color: 'var(--color-base-text-tertiary)',
                    margin: 0
                  }}
                >
                  Your founding rate stays locked while your subscription stays active. If you cancel and return later, standard pricing applies.
                </p>
              </>
            )
            
            return (
              <PlanCard
                title="Agency Pro"
                price={displayPlan.price}
                currency="€"
                billedAnnually={displayPlan.isAnnual}
                annualPrice={displayPlan.isAnnual ? "1,188" : undefined}
                isActive={true}
                features={AGENCY_PRO_FEATURES}
                renewalDate={displayDate}
                badge={{
                  text: 'Founding member',
                  variant: 'outline',
                  className: 'text-sm-regular rounded-full',
                  style: { color: 'var(--color-base-text-primary)' }
                }}
                buttonText={isCancelling ? 'Resume plan' : undefined}
                onButtonClick={isCancelling ? () => handlePortal(true) : undefined}
                buttonDisabled={isCancelling ? isManagingPlan : false}
                description={description}
              />
            )
          })()}

      {/* Second card - Payment method */}
      <div
        style={{
          width: '100%',
          maxWidth: '410px',
          alignSelf: 'flex-start',
          padding: 'var(--spacing-5, 24px)',
          borderRadius: 'var(--radius-5, 12px)',
          border: '1px solid var(--color-neutral-alpha-4, rgba(0, 0, 45, 0.09))',
          background: 'var(--color-base-surface-page-background, #ffffff)',
          display: 'flex',
          flexDirection: 'column'
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
            className="relative"
            onClick={() => handlePortal(false)}
            disabled={isCreatingPortal}
          >
            <span className={isCreatingPortal ? "invisible" : ""}>Manage payment method</span>
            {isCreatingPortal && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Spinner size={16} />
              </div>
            )}
          </Button>
        </div>
      </div>
        </>
      )}
    </div>

    {/* Success Dialog */}
    <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
      <DialogContent style={{ padding: '32px', width: '480px', gap: '0.75rem' }} className="[&>button]:hidden h-auto">
        <DialogHeader className="space-y-0">
          <DialogTitle className="display-7-medium mb-2">
            Welcome to Fiive
          </DialogTitle>
        </DialogHeader>
        <DialogDescription 
          className="text-sm-regular mb-0"
        >
          You&apos;re now a Founding Member.
          <br />
          <br />
          Full access is unlocked. Invite clients, manage work, receive requests, and collaborate across your workspace.
        </DialogDescription>
        <div className="flex justify-end" style={{ marginTop: '24px' }}>
          <Button 
            onClick={() => setShowSuccessDialog(false)}
            style={{ height: '40px' }}
            className="cursor-pointer"
          >
            Get started
          </Button>
        </div>
      </DialogContent>
    </Dialog>

    </div>
  )
}
