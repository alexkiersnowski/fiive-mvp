import { NextRequest, NextResponse } from 'next/server'
import { getActiveContext } from '@/lib/mode/getActiveContext'
import { getStripeInstance, getOrCreateCustomer } from '@/lib/stripe/server'

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
        { error: 'Forbidden: Only organization owners and admins can manage billing' },
        { status: 403 }
      )
    }
    
    // Parse request body to get billing period
    let billingPeriod: 'monthly' | 'annual' = 'monthly'
    try {
      const body = await request.json()
      if (body.billingPeriod && (body.billingPeriod === 'monthly' || body.billingPeriod === 'annual')) {
        billingPeriod = body.billingPeriod
      }
    } catch (error) {
      // If body parsing fails, default to monthly
      console.warn('Failed to parse request body, defaulting to monthly billing')
    }
    
    // Get price ID from environment based on billing period
    const priceId = billingPeriod === 'annual'
      ? process.env.STRIPE_PRICE_AGENCY_PRO_ANNUAL
      : process.env.STRIPE_PRICE_AGENCY_PRO_MONTHLY
    
    if (!priceId) {
      const missingVar = billingPeriod === 'annual'
        ? 'STRIPE_PRICE_AGENCY_PRO_ANNUAL'
        : 'STRIPE_PRICE_AGENCY_PRO_MONTHLY'
      console.error(`${missingVar} environment variable is not set`)
      return NextResponse.json(
        { error: `Server configuration error: ${missingVar} is not set` },
        { status: 500 }
      )
    }
    
    // Get or create Stripe customer
    const customerId = await getOrCreateCustomer(
      context.orgId,
      context.user.email,
      context.organization.name
    )
    
    // Create checkout session
    const stripe = getStripeInstance()
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
    
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      metadata: {
        organization_id: context.orgId,
      },
      success_url: `${baseUrl}/settings/organization/billing?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/settings/organization/billing?canceled=true`,
    })
    
    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('Error creating checkout session:', error)
    
    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }
    
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    )
  }
}

