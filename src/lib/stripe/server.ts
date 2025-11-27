import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'

/**
 * Get configured Stripe instance
 * Server-side only - never import in client components
 */
export function getStripeInstance(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY
  
  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY environment variable is not set')
  }
  
  return new Stripe(secretKey, {
    apiVersion: '2025-11-17.clover',
  })
}

/**
 * Get or create a Stripe customer for an organization
 * Returns the customer ID
 */
export async function getOrCreateCustomer(
  organizationId: string,
  userEmail: string,
  organizationName?: string
): Promise<string> {
  const stripe = getStripeInstance()
  const supabase = await createClient()
  
  // Check if organization already has a customer ID
  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .select('stripe_customer_id, name')
    .eq('id', organizationId)
    .single()
  
  if (orgError) {
    throw new Error(`Failed to fetch organization: ${orgError.message}`)
  }
  
  // If customer ID exists, verify it's valid in current Stripe mode
  if (org.stripe_customer_id) {
    try {
      // Try to retrieve the customer to verify it exists
      await stripe.customers.retrieve(org.stripe_customer_id)
      // Customer exists, return it
      return org.stripe_customer_id
    } catch (_error) {
      // Customer doesn't exist (likely from different mode), clear it and create new one
      // Clear the invalid customer ID
      await supabase
        .from('organizations')
        .update({ stripe_customer_id: null })
        .eq('id', organizationId)
    }
  }
  
  // Create new Stripe customer
  const customer = await stripe.customers.create({
    email: userEmail,
    name: organizationName || org.name,
    metadata: {
      organization_id: organizationId,
    },
  })
  
  // Save customer ID to organization
  const { error: updateError } = await supabase
    .from('organizations')
    .update({ stripe_customer_id: customer.id })
    .eq('id', organizationId)
  
  if (updateError) {
    throw new Error(`Failed to save Stripe customer ID: ${updateError.message}`)
  }
  
  return customer.id
}

/**
 * Map Stripe subscription status to our billing_status enum
 * For Flexible Billing: checks cancel_at to determine if subscription is cancelling but still active
 */
export function mapSubscriptionStatusToBillingStatus(
  subscription: Stripe.Subscription
): 'free' | 'active' | 'canceled_pending' | 'past_due' {
  const { status, cancel_at } = subscription;

  // Pending cancellation (still paid until cancel_at)
  if (cancel_at) return 'canceled_pending';

  if (status === 'active' || status === 'trialing') return 'active';
  if (status === 'past_due' || status === 'unpaid') return 'past_due';
  if (status === 'canceled' || status === 'incomplete_expired') return 'free';

  return 'free';
}

/**
 * Verify checkout session and get updated billing status
 * Server-side only - used for server-side rendering
 */
export async function verifyCheckoutSessionAndGetBillingStatus(
  sessionId: string,
  organizationId: string
): Promise<{ billingStatus: string; shouldShowDialog: boolean }> {
  const stripe = getStripeInstance()
  const supabase = createAdminClient()
  
  try {
    // Retrieve checkout session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId)
    
    // Verify this session belongs to the organization
    if (session.metadata?.organization_id !== organizationId) {
      // Return current status if mismatch
      const { data: org } = await supabase
        .from('organizations')
        .select('billing_status')
        .eq('id', organizationId)
        .single()
      return { 
        billingStatus: org?.billing_status || 'free',
        shouldShowDialog: false
      }
    }
    
    // Check if session is completed
    if (session.status !== 'complete') {
      // Session not complete yet, return current status
      const { data: org } = await supabase
        .from('organizations')
        .select('billing_status')
        .eq('id', organizationId)
        .single()
      return { 
        billingStatus: org?.billing_status || 'free',
        shouldShowDialog: false
      }
    }
    
    // Check if this is a subscription checkout
    if (session.mode !== 'subscription') {
      const { data: org } = await supabase
        .from('organizations')
        .select('billing_status')
        .eq('id', organizationId)
        .single()
      return { 
        billingStatus: org?.billing_status || 'free',
        shouldShowDialog: false
      }
    }
    
    // Check if subscription exists
    if (!session.subscription) {
      // Subscription not created yet, but session is complete
      // Return optimistic 'active' status
      return { 
        billingStatus: 'active',
        shouldShowDialog: true
      }
    }
    
    const subscriptionId = typeof session.subscription === 'string' 
      ? session.subscription 
      : session.subscription.id
    
    // Get current database state
    const { data: currentOrg } = await supabase
      .from('organizations')
      .select('stripe_subscription_id, billing_status')
      .eq('id', organizationId)
      .single()
    
    // If subscription is already recorded, return current status
    if (currentOrg?.stripe_subscription_id === subscriptionId) {
      return { 
        billingStatus: currentOrg.billing_status || 'active',
        shouldShowDialog: true
      }
    }
    
    // Subscription exists but not recorded - return optimistic active status
    // Client-side verification will handle the actual update
    return { 
      billingStatus: 'active',
      shouldShowDialog: true
    }
    
  } catch (_error) {
    // On error, return current status from database
    const { data: org } = await supabase
      .from('organizations')
      .select('billing_status')
      .eq('id', organizationId)
      .single()
    return { 
      billingStatus: org?.billing_status || 'free',
      shouldShowDialog: false
    }
  }
}
