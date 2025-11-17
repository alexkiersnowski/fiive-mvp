'use server'

import { Resend } from 'resend'
import { inviteMemberTemplate } from '../../../emails/inviteMemberTemplate'

/**
 * Sends a member invitation email via Resend
 * 
 * @param to - Email address of the recipient
 * @param organizationName - Name of the organization sending the invitation
 * @param inviteUrl - Full URL for the member to claim their invitation
 * @returns Success status
 * @throws Error if email sending fails
 */
export async function sendMemberInviteEmail({
  to,
  organizationName,
  inviteUrl,
}: {
  to: string
  organizationName: string
  inviteUrl: string
}): Promise<{ success: true }> {
  // Validate required environment variable
  if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY environment variable is not set')
  }

  // Initialize Resend client
  const resend = new Resend(process.env.RESEND_API_KEY)

  // Generate email HTML from template
  const html = inviteMemberTemplate({ organizationName, inviteUrl })

  // Determine sender email (use environment variable or default to Fiive <noreply@fiive.co>)
  // Format: "Display Name <email@domain.com>" - Resend handles SPF/DKIM automatically for verified domains
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'Fiive <noreply@fiive.co>'

  // Send email via Resend
  const { data, error } = await resend.emails.send({
    from: fromEmail,
    to: [to],
    subject: `${organizationName} invited you to join their team`,
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

