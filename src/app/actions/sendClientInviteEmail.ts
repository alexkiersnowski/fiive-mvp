'use server'

import { Resend } from 'resend'
import { inviteClientTemplate } from '../../../emails/inviteClientTemplate'

/**
 * Sends a client invitation email via Resend
 * 
 * @param to - Email address of the recipient
 * @param agencyName - Name of the agency sending the invitation
 * @param inviteUrl - Full URL for the client to claim their organization
 * @returns Success status
 * @throws Error if email sending fails
 */
export async function sendClientInviteEmail({
  to,
  agencyName,
  inviteUrl,
}: {
  to: string
  agencyName: string
  inviteUrl: string
}): Promise<{ success: true }> {
  // Validate required environment variable
  if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY environment variable is not set')
  }

  // Initialize Resend client
  const resend = new Resend(process.env.RESEND_API_KEY)

  // Generate email HTML from template
  const html = inviteClientTemplate({ agencyName, inviteUrl })

  // Determine sender email (use environment variable or default to Fiive <notifications@fiive.co>)
  // Format: "Display Name <email@domain.com>" - Resend handles SPF/DKIM automatically for verified domains
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'Fiive <notifications@fiive.co>'

  // Send email via Resend
  const { data, error } = await resend.emails.send({
    from: fromEmail,
    to: [to],
    subject: `${agencyName} invited you to Fiive`,
    html,
    // Optional: Set reply_to if you want replies to go to a different address
    // reply_to: 'support@fiive.co',
  })

  if (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Resend API error:', error)
    }
    throw new Error(`Failed to send invitation email: ${error.message || 'Unknown error'}`)
  }

  if (!data) {
    throw new Error('Failed to send invitation email: No data returned from Resend')
  }

  return { success: true }
}

