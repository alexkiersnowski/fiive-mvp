// CRITICAL: These MUST be first - before any imports
// Next.js uses these to determine route handling before imports are evaluated
// Without these at the top, Next.js auto-parses body as JSON, breaking Stripe signature verification
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import Stripe from 'stripe'
import { getStripeInstance, mapSubscriptionStatusToBillingStatus } from '@/lib/stripe/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  
  if (!webhookSecret) {
    return NextResponse.json(
      { error: 'Webhook secret not configured' },
      { status: 500 }
    )
  }
  
  try {
    // Get raw body as text for signature verification
    const bodyText = await request.text()
    const body = Buffer.from(bodyText)
    const headersList = await headers()
    const signature = headersList.get('stripe-signature')
    
    if (!signature) {
      return NextResponse.json(
        { error: 'Missing stripe-signature header' },
        { status: 400 }
      )
    }
    
    // Verify webhook signature
    const stripe = getStripeInstance()
    let event: Stripe.Event
    
    try {
      event = stripe.webhooks.constructEvent(
        body,
        signature,
        webhookSecret
      )
    } catch (err) {
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      )
    }
    
    // Use admin client to update organizations (bypasses RLS)
    const supabase = createAdminClient()
    
    // Handle different event types
    // Note: Using string comparison for invoice.past_due as it may not be in Stripe type definitions yet
    const eventType = event.type as string
    switch (eventType) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        
        if (session.mode === 'subscription' && session.metadata?.organization_id) {
          const organizationId = session.metadata.organization_id
          const customerId = session.customer as string
          
          // CRITICAL: Check if subscription exists before proceeding
          if (!session.subscription) {
            // Don't throw - return 200 to Stripe, but the subscription.created event will handle this case
            break
          }
          
          const subscriptionId = session.subscription as string
          
          try {
            // Get subscription details to extract price_id and current_period_end
            const subscription: Stripe.Subscription = await stripe.subscriptions.retrieve(subscriptionId) as Stripe.Subscription
            
            // Validate subscription has items
            if (!subscription.items || !subscription.items.data || subscription.items.data.length === 0) {
              break
            }
            
            const priceId = subscription.items.data[0]?.price?.id
            
            if (!priceId) {
              break
            }
            
            // Verify organization exists before updating
            const { data: existingOrg, error: checkError } = await supabase
              .from('organizations')
              .select('id, name')
              .eq('id', organizationId)
              .single()
            
            if (checkError || !existingOrg) {
              return NextResponse.json(
                { error: 'Organization not found' },
                { status: 404 }
              )
            }
            
            // Use mapping function to determine correct billing status
            const billingStatus = mapSubscriptionStatusToBillingStatus(subscription)
            
            // Access current_period_end with type safety
            const currentPeriodEnd = 'current_period_end' in subscription && typeof subscription.current_period_end === 'number'
              ? subscription.current_period_end
              : null
            
            // Update organization
            const { data, error } = await supabase
              .from('organizations')
              .update({
                stripe_customer_id: customerId,
                stripe_subscription_id: subscriptionId,
                stripe_price_id: priceId,
                billing_status: billingStatus,
                current_period_end: currentPeriodEnd ? new Date(currentPeriodEnd * 1000).toISOString() : null,
              })
              .eq('id', organizationId)
              .select()
            
            if (error) {
              return NextResponse.json(
                { error: 'Failed to update organization', details: error.message },
                { status: 500 }
              )
            }
          } catch (subscriptionError) {
            return NextResponse.json(
              { error: 'Failed to retrieve subscription', details: subscriptionError instanceof Error ? subscriptionError.message : String(subscriptionError) },
              { status: 500 }
            )
          }
        }
        break
      }
      
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        try {
          const subscription = event.data.object as Stripe.Subscription
          
          // Defensive check: Validate subscription has required fields
          if (!subscription.id || !subscription.customer) {
            return NextResponse.json(
              { error: 'Invalid subscription object: missing id or customer' },
              { status: 400 }
            )
          }
          
          const customerId = subscription.customer as string
        
          // Validate subscription has items
          if (!subscription.items || !subscription.items.data || subscription.items.data.length === 0) {
            return NextResponse.json(
              { error: 'Subscription has no items' },
              { status: 400 }
            )
          }
          
          const priceId = subscription.items.data[0]?.price?.id
          
          if (!priceId) {
            return NextResponse.json(
              { error: 'Subscription item has no price ID' },
              { status: 400 }
            )
          }
          
          const billingStatus = mapSubscriptionStatusToBillingStatus(subscription)
          
          // Access current_period_end with type safety
          const currentPeriodEnd = 'current_period_end' in subscription && typeof subscription.current_period_end === 'number'
            ? subscription.current_period_end
            : null
          
          // Find organization by subscription ID first (most reliable - unique per subscription)
          const { data: orgBySub, error: subError } = await supabase
            .from('organizations')
            .select('id, billing_status')
            .eq('stripe_subscription_id', subscription.id)
            .single()
          
          // Fallback: If not found by subscription ID, try customer ID
          let organization = orgBySub
          
          if (subError) {
            // Check if it's a "not found" error
            if (subError.code === 'PGRST116') {
              const { data: org, error: findError } = await supabase
                .from('organizations')
                .select('id, billing_status')
                .eq('stripe_customer_id', customerId)
                .single()
              
              if (!findError && org) {
                organization = org
              } else if (findError) {
                return NextResponse.json(
                  { error: 'Organization not found for customer or subscription' },
                  { status: 404 }
                )
              }
            } else {
              return NextResponse.json(
                { error: 'Failed to find organization', details: subError.message },
                { status: 500 }
              )
            }
          }
          
          // Only proceed if we found an organization
          if (!organization) {
            return NextResponse.json(
              { error: 'Organization not found for customer or subscription' },
              { status: 404 }
            )
          }
          
          // Update organization - ALWAYS sync all Stripe fields (webhook is source of truth)
          const { data, error } = await supabase
            .from('organizations')
            .update({
              stripe_customer_id: customerId,  // CRITICAL: Always update - IDs can change/rotate
              stripe_subscription_id: subscription.id,
              stripe_price_id: priceId,
              billing_status: billingStatus,
              current_period_end: currentPeriodEnd ? new Date(currentPeriodEnd * 1000).toISOString() : null,
            })
            .eq('id', organization.id)
            .select('id, billing_status, stripe_subscription_id, stripe_customer_id')
          
          if (error) {
            return NextResponse.json(
              { error: 'Failed to update organization', details: error.message },
              { status: 500 }
            )
          }
        } catch (subscriptionError) {
          return NextResponse.json(
            { error: 'Failed to process subscription event', details: subscriptionError instanceof Error ? subscriptionError.message : String(subscriptionError) },
            { status: 500 }
          )
        }
        break
      }
      
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = subscription.customer as string
        
        // Find organization by customer ID
        const { data: org, error: findError } = await supabase
          .from('organizations')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .single()
        
        if (!findError && org) {
          const { error } = await supabase
            .from('organizations')
            .update({
              billing_status: 'free',
            })
            .eq('id', org.id)
          
          if (error) {
            return NextResponse.json(
              { error: 'Failed to update organization after cancellation', details: error.message },
              { status: 500 }
            )
          }
        }
        break
      }
      
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice
        const customerId = invoice.customer as string
        const subscriptionId = 'subscription' in invoice && invoice.subscription 
          ? (typeof invoice.subscription === 'string' ? invoice.subscription : (invoice.subscription as Stripe.Subscription).id)
          : null
        
        if (subscriptionId) {
          // Get subscription to get current_period_end and check status
          const subscription: Stripe.Subscription = await stripe.subscriptions.retrieve(subscriptionId as string) as Stripe.Subscription
          
          // Validate subscription has items
          if (!subscription.items || !subscription.items.data || subscription.items.data.length === 0) {
            break
          }
          
          const priceId = subscription.items.data[0]?.price?.id
          
          if (!priceId) {
            break
          }
          
          // Use mapping function to determine correct billing status
          // This ensures we don't override 'canceled_pending' if subscription is still cancelling
          const billingStatus = mapSubscriptionStatusToBillingStatus(subscription)
          
          // Access current_period_end with type safety
          const currentPeriodEnd = 'current_period_end' in subscription && typeof subscription.current_period_end === 'number'
            ? subscription.current_period_end
            : null
          
          // Find organization by subscription ID first (most reliable)
          const { data: orgBySub, error: subError } = await supabase
            .from('organizations')
            .select('id')
            .eq('stripe_subscription_id', subscriptionId)
            .single()
          
          // Fallback to customer ID if subscription ID lookup fails
          let org = orgBySub
          if (subError && subError.code === 'PGRST116') {
            const { data: orgByCustomer, error: customerError } = await supabase
              .from('organizations')
              .select('id')
              .eq('stripe_customer_id', customerId)
              .single()
            
            if (!customerError && orgByCustomer) {
              org = orgByCustomer
            }
          }
          
          if (org) {
            const { error } = await supabase
              .from('organizations')
              .update({
                stripe_customer_id: customerId,  // Always sync - webhook is source of truth
                stripe_subscription_id: subscriptionId,
                stripe_price_id: priceId,
                billing_status: billingStatus,
                current_period_end: currentPeriodEnd ? new Date(currentPeriodEnd * 1000).toISOString() : null,
              })
              .eq('id', org.id)
            
            if (error) {
              return NextResponse.json(
                { error: 'Failed to update organization after payment', details: error.message },
                { status: 500 }
              )
            }
          }
        }
        break
      }
      
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const customerId = invoice.customer as string
        
        // Find organization by customer ID
        const { data: org, error: findError } = await supabase
          .from('organizations')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .single()
        
        if (!findError && org) {
          const { error } = await supabase
            .from('organizations')
            .update({
              billing_status: 'past_due',
            })
            .eq('id', org.id)
          
          if (error) {
            return NextResponse.json(
              { error: 'Failed to update organization after payment failure', details: error.message },
              { status: 500 }
            )
          }
        }
        break
      }
      
      case 'invoice.past_due' as any: {
        const invoice = event.data.object as Stripe.Invoice
        const customerId = invoice.customer as string
        
        // Find organization by customer ID
        const { data: org, error: findError } = await supabase
          .from('organizations')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .single()
        
        if (!findError && org) {
          const { error } = await supabase
            .from('organizations')
            .update({
              billing_status: 'past_due',
            })
            .eq('id', org.id)
          
          if (error) {
            return NextResponse.json(
              { error: 'Failed to update organization after invoice past due', details: error.message },
              { status: 500 }
            )
          }
        }
        break
      }
      
      default:
        // Unhandled event type - return 200 to acknowledge receipt
        break
    }
    
    // Return success response
    return NextResponse.json({ 
      received: true,
      eventType: event.type,
      processed: true,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Webhook handler failed', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
