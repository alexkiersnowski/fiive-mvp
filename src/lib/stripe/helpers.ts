import { createAdminClient } from '@/lib/supabase/server'

/**
 * Reset all Stripe-related fields for an organization to NULL/free state
 * Used when customer is deleted, invalid, or subscription is cancelled
 * 
 * @param organizationId - The organization ID to reset Stripe fields for
 * @returns Promise that resolves when fields are reset
 */
export async function resetStripeFields(organizationId: string): Promise<void> {
  const supabase = createAdminClient()
  
  const { error } = await supabase
    .from('organizations')
    .update({
      stripe_customer_id: null,
      stripe_subscription_id: null,
      stripe_price_id: null,
      billing_status: 'free',
      current_period_end: null,
    })
    .eq('id', organizationId)
  
  if (error) {
    throw new Error(`Failed to reset Stripe fields: ${error.message}`)
  }
}

