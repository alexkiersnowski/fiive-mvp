import { NextRequest, NextResponse } from 'next/server'
import { getActiveContext } from '@/lib/mode/getActiveContext'
import { getStripeInstance } from '@/lib/stripe/server'
import { createClient } from '@/lib/supabase/server'
import { resetStripeFields } from '@/lib/stripe/helpers'
import { SITE_URL } from '@/lib/env'

export const dynamic = 'force-dynamic'

export async function POST(_request: NextRequest) {
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
    
    // Get organization's Stripe customer ID
    const supabase = await createClient()
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('stripe_customer_id')
      .eq('id', context.orgId)
      .single()
    
    if (orgError || !org) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      )
    }
    
    if (!org.stripe_customer_id) {
      return NextResponse.json(
        { error: 'No active subscription found' },
        { status: 400 }
      )
    }
    
    // DEFENSIVE CHECK: Verify customer exists and isn't deleted before creating portal session
    const stripe = getStripeInstance()
    
    try {
      const customer = await stripe.customers.retrieve(org.stripe_customer_id)
      
      // Check if customer is deleted
      if (customer.deleted) {
        // Customer is deleted - reset all Stripe fields and return error
        await resetStripeFields(context.orgId)
        return NextResponse.json(
          { error: 'Your billing account has been deleted. Please contact support or start a new subscription.' },
          { status: 400 }
        )
      }
    } catch (customerError) {
      // Customer doesn't exist or error retrieving
      // Reset all Stripe fields and return error
      await resetStripeFields(context.orgId)
      
      // Check if it's a "not found" error
      if (customerError instanceof Error && customerError.message.includes('No such customer')) {
        return NextResponse.json(
          { error: 'Your billing account could not be found. Please contact support or start a new subscription.' },
          { status: 400 }
        )
      }
      
      // Other error - log and return generic error
      console.error('Error retrieving customer for portal session:', customerError)
      return NextResponse.json(
        { error: 'Unable to access billing portal. Please try again or contact support.' },
        { status: 500 }
      )
    }
    
    // Customer exists and is valid - create portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: org.stripe_customer_id,
      return_url: `${SITE_URL}/settings/organization/billing`,
    })
    
    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('Error creating portal session:', error)
    
    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }
    
    return NextResponse.json(
      { error: 'Failed to create portal session' },
      { status: 500 }
    )
  }
}

