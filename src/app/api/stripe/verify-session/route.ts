import { NextRequest, NextResponse } from 'next/server'
import { getActiveContext } from '@/lib/mode/getActiveContext'
import { getStripeInstance, mapSubscriptionStatusToBillingStatus } from '@/lib/stripe/server'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    // Verify authentication and get context
    const context = await getActiveContext()
    
    if (!context) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    // Ensure user is owner/admin (not member)
    if (context.currentUserRole === 'member') {
      return NextResponse.json(
        { error: 'Forbidden: Only organization owners and admins can verify checkout sessions' },
        { status: 403 }
      )
    }
    
    // Parse request body to get session_id
    let sessionId: string
    try {
      const body = await request.json()
      if (!body.session_id || typeof body.session_id !== 'string') {
        return NextResponse.json(
          { error: 'Missing or invalid session_id' },
          { status: 400 }
        )
      }
      sessionId = body.session_id
    } catch (_error) {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      )
    }
    
    const stripe = getStripeInstance()
    const supabase = createAdminClient()
    
    try {
      // Retrieve checkout session from Stripe
      const session = await stripe.checkout.sessions.retrieve(sessionId)
      
      // Verify this session belongs to the user's organization
      if (session.metadata?.organization_id !== context.orgId) {
        console.warn('Session organization mismatch:', {
          sessionOrgId: session.metadata?.organization_id,
          contextOrgId: context.orgId,
          sessionId
        })
        return NextResponse.json(
          { error: 'Session does not belong to your organization' },
          { status: 403 }
        )
      }
      
      // Check if session is completed
      if (session.status !== 'complete') {
        return NextResponse.json({
          success: false,
          message: `Checkout session is not complete. Status: ${session.status}`,
          sessionStatus: session.status
        })
      }
      
      // Check if this is a subscription checkout
      if (session.mode !== 'subscription') {
        return NextResponse.json({
          success: false,
          message: 'This endpoint only handles subscription checkouts',
          mode: session.mode
        })
      }
      
      // Check if subscription exists
      if (!session.subscription) {
        return NextResponse.json({
          success: false,
          message: 'Subscription not found in checkout session. Webhook may process it shortly.',
          sessionId
        })
      }
      
      const subscriptionId = typeof session.subscription === 'string' 
        ? session.subscription 
        : session.subscription.id
      
      // Retrieve full subscription details
      const subscription = await stripe.subscriptions.retrieve(subscriptionId)
      
      // Validate subscription has items
      if (!subscription.items || !subscription.items.data || subscription.items.data.length === 0) {
        return NextResponse.json({
          success: false,
          message: 'Subscription has no items',
          subscriptionId
        })
      }
      
      const priceId = subscription.items.data[0]?.price?.id
      
      if (!priceId) {
        return NextResponse.json({
          success: false,
          message: 'Subscription item has no price ID',
          subscriptionId
        })
      }
      
      // Check current database state
      const { data: currentOrg, error: orgError } = await supabase
        .from('organizations')
        .select('stripe_subscription_id, billing_status, stripe_customer_id')
        .eq('id', context.orgId)
        .single()
      
      if (orgError || !currentOrg) {
        console.error('Error fetching organization:', orgError)
        return NextResponse.json(
          { error: 'Failed to fetch organization' },
          { status: 500 }
        )
      }
      
      // Check if subscription is already recorded
      if (currentOrg.stripe_subscription_id === subscriptionId) {
        return NextResponse.json({
          success: true,
          message: 'Subscription already recorded',
          alreadyProcessed: true
        })
      }
      
      // Update organization with subscription details
      // Use mapping function to determine correct billing status (checks cancel_at for Flexible Billing)
      const billingStatus = mapSubscriptionStatusToBillingStatus(subscription)
      
      // Extract current_period_end: use cancel_at if present (cancelled), otherwise use current_period_end
      // Under Flexible Billing, cancel_at === current_period_end when cancelled
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const topLevelEnd = (subscription as any).current_period_end as number | null | undefined
      const itemEnd = subscription.items?.data?.[0]?.current_period_end ?? null
      const cancelAtUnix = subscription.cancel_at ?? null
      
      // Use cancel_at if present (cancelled), otherwise fallback to current_period_end
      const currentPeriodEndUnix = cancelAtUnix ?? topLevelEnd ?? itemEnd ?? null
      const currentPeriodEndIso = currentPeriodEndUnix
        ? new Date(currentPeriodEndUnix * 1000).toISOString()
        : null
      
      const { data: _updatedOrg, error: updateError } = await supabase
        .from('organizations')
        .update({
          stripe_customer_id: session.customer as string,
          stripe_subscription_id: subscriptionId,
          stripe_price_id: priceId,
          billing_status: billingStatus,
          current_period_end: currentPeriodEndIso,
        })
        .eq('id', context.orgId)
        .select()
      
      if (updateError) {
        console.error('Error updating organization:', {
          error: updateError.message,
          code: updateError.code,
          organizationId: context.orgId,
          subscriptionId
        })
        return NextResponse.json(
          { error: 'Failed to update organization', details: updateError.message },
          { status: 500 }
        )
      }
      
      console.log('✅ Successfully verified and updated subscription:', {
        organizationId: context.orgId,
        subscriptionId,
        priceId,
        billingStatus,
        cancel_at: subscription.cancel_at
      })
      
      return NextResponse.json({
        success: true,
        message: 'Subscription verified and updated successfully',
        subscriptionId,
        priceId,
        billingStatus
      })
      
    } catch (stripeError) {
      console.error('Error retrieving checkout session:', {
        error: stripeError instanceof Error ? stripeError.message : String(stripeError),
        stack: stripeError instanceof Error ? stripeError.stack : undefined,
        sessionId
      })
      
      if (stripeError instanceof Error && stripeError.message.includes('No such checkout session')) {
        return NextResponse.json(
          { error: 'Checkout session not found' },
          { status: 404 }
        )
      }
      
      return NextResponse.json(
        { error: 'Failed to verify checkout session', details: stripeError instanceof Error ? stripeError.message : String(stripeError) },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Error in verify-session endpoint:', error)
    
    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }
    
    return NextResponse.json(
      { error: 'Failed to verify checkout session' },
      { status: 500 }
    )
  }
}

