'use server'

import { Resend } from 'resend'
import { agencyProWelcomeTemplate } from '../../../emails/agencyProWelcomeTemplate'
import { createAdminClient } from '@/lib/supabase/server'

/**
 * Sends an Agency Pro welcome email to the organization owner
 * 
 * @param organizationId - ID of the organization that upgraded
 * @returns Success status
 * @throws Error if email sending fails
 */
export async function sendAgencyProWelcomeEmail({
  organizationId,
}: {
  organizationId: string
}): Promise<{ success: true }> {
  // Validate required environment variable
  if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY environment variable is not set')
  }

  // Use admin client to bypass RLS and fetch organization owner info
  const supabase = createAdminClient()

  // Fetch organization to get owner_id and type
  const { data: organization, error: orgError } = await supabase
    .from('organizations')
    .select('owner_id, type')
    .eq('id', organizationId)
    .single()

  if (orgError || !organization) {
    throw new Error(`Failed to fetch organization: ${orgError?.message || 'Organization not found'}`)
  }

  // Only send email for agency organizations
  if (organization.type !== 'agency') {
    throw new Error('Welcome email is only sent for agency organizations')
  }

  // Fetch owner profile to get first_name and email
  const { data: ownerProfile, error: profileError } = await supabase
    .from('profiles')
    .select('first_name, email')
    .eq('id', organization.owner_id)
    .single()

  if (profileError || !ownerProfile) {
    throw new Error(`Failed to fetch owner profile: ${profileError?.message || 'Owner profile not found'}`)
  }

  if (!ownerProfile.email) {
    throw new Error('Owner email not found')
  }

  const firstName = ownerProfile.first_name || 'there'
  const ownerEmail = ownerProfile.email

  // Initialize Resend client
  const resend = new Resend(process.env.RESEND_API_KEY)

  // Generate email HTML from template
  const html = agencyProWelcomeTemplate({ firstName })

  // Use support@fiive.co as sender
  const fromEmail = 'Fiive <support@fiive.co>'

  // Send email via Resend
  const { data, error } = await resend.emails.send({
    from: fromEmail,
    to: [ownerEmail],
    subject: 'Welcome to Agency Pro',
    html,
  })

  if (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Resend API error:', error)
    }
    throw new Error(`Failed to send welcome email: ${error.message || 'Unknown error'}`)
  }

  if (!data) {
    throw new Error('Failed to send welcome email: No data returned from Resend')
  }

  return { success: true }
}

