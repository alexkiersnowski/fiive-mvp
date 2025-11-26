import { getActiveContext } from '@/lib/mode/getActiveContext'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { cache, Suspense } from 'react'
import { verifyCheckoutSessionAndGetBillingStatus } from '@/lib/stripe/server'
import BillingContent from './BillingContent'

/**
 * Check if an organization has any real connections (non-draft status)
 * Real connections are those with status: 'invited', 'connected', or 'disconnected'
 */
const hasRealConnections = cache(async (
  orgId: string,
  variant: 'agency' | 'client'
): Promise<boolean> => {
  const supabase = await createClient()
  
  try {
    let query = supabase
      .from('connections')
      .select('id')
      .in('connection_status', ['invited', 'connected', 'disconnected'])
      .limit(1)
    
    if (variant === 'agency') {
      query = query.eq('agency_id', orgId)
    } else {
      query = query.eq('client_id', orgId)
    }
    
    const { data, error } = await query
    
    if (error) {
      console.error('Error checking for real connections:', error)
      // Default to showing "contact support" message for safety
      return true
    }
    
    // Return true if any real connections exist
    return (data?.length ?? 0) > 0
  } catch (error) {
    console.error('Unexpected error checking for real connections:', error)
    // Default to showing "contact support" message for safety
    return true
  }
})

interface BillingPageProps {
  searchParams: Promise<{ session_id?: string; canceled?: string }>
}

export default async function BillingPage({ searchParams }: BillingPageProps) {
  // Check if user is authenticated and get their role
  const context = await getActiveContext()
  
  if (!context) {
    redirect('/signin')
  }
  
  // Redirect members to home page
  if (context.currentUserRole === 'member') {
    redirect('/home')
  }

  // Get search params
  const params = await searchParams
  const sessionId = params.session_id
  const canceled = params.canceled

  // Get Stripe price IDs from environment
  const monthlyPriceId = process.env.STRIPE_PRICE_AGENCY_PRO_MONTHLY
  const annualPriceId = process.env.STRIPE_PRICE_AGENCY_PRO_ANNUAL

  // If canceled, just show current status
  if (canceled === 'true') {
    return (
      <Suspense fallback={<div>Loading...</div>}>
        <BillingContent 
          variant={context.variant} 
          billingStatus={context.organization.billing_status}
          sessionId={null}
          shouldShowDialog={false}
          stripePriceId={context.organization.stripe_price_id}
          monthlyPriceId={monthlyPriceId}
          annualPriceId={annualPriceId}
          currentPeriodEnd={context.organization.current_period_end}
        />
      </Suspense>
    )
  }

  // If session_id is present, verify session server-side to get updated billing status
  let billingStatus = context.organization.billing_status
  let shouldShowDialog = false

  if (sessionId) {
    try {
      const result = await verifyCheckoutSessionAndGetBillingStatus(
        sessionId,
        context.orgId
      )
      billingStatus = result.billingStatus
      shouldShowDialog = result.shouldShowDialog
    } catch (error) {
      console.error('Error verifying session server-side:', error)
      // Fall back to current status if verification fails
    }
  }

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <BillingContent 
        variant={context.variant} 
        billingStatus={billingStatus}
        sessionId={sessionId || null}
        shouldShowDialog={shouldShowDialog}
        stripePriceId={context.organization.stripe_price_id}
        monthlyPriceId={monthlyPriceId}
        annualPriceId={annualPriceId}
        currentPeriodEnd={context.organization.current_period_end}
      />
    </Suspense>
  )
}
