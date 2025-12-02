import { NextRequest, NextResponse } from 'next/server'
import { getActiveContext } from '@/lib/mode/getActiveContext'
import { getStripeInstance } from '@/lib/stripe/server'
import { createClient } from '@/lib/supabase/server'
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
    
    // Create portal session
    const stripe = getStripeInstance()
    
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

