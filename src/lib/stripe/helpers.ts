import { createAdminClient } from '@/lib/supabase/server'

/**
 * Reset subscription-related fields only (keeps customer_id)
 * Used when subscription is cancelled/deleted but customer still exists in Stripe
 * Customer ID is preserved to enable resubscription and prevent duplicate customers
 * 
 * @param organizationId - The organization ID to reset subscription fields for
 * @returns Promise that resolves when fields are reset
 */
export async function resetSubscriptionFields(organizationId: string): Promise<void> {
  const supabase = createAdminClient()
  
  const { error } = await supabase
    .from('organizations')
    .update({
      stripe_subscription_id: null,
      stripe_price_id: null,
      billing_status: 'free',
      current_period_end: null,
      // NOTE: stripe_customer_id is NOT cleared - customer still exists in Stripe
    })
    .eq('id', organizationId)
  
  if (error) {
    throw new Error(`Failed to reset subscription fields: ${error.message}`)
  }
}

/**
 * Reset all Stripe-related fields for an organization to NULL/free state
 * Used when customer is deleted or invalid in Stripe
 * Clears everything including customer_id since customer no longer exists
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

