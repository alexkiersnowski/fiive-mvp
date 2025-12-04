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

  // Determine sender email (use environment variable or default to Fiive <notifications@fiive.co>)
  // Format: "Display Name <email@domain.com>" - Resend handles SPF/DKIM automatically for verified domains
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'Fiive <notifications@fiive.co>'

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

/**
 * Sends multiple member invitation emails via Resend Batch API
 * 
 * @param emails - Array of email objects with to, organizationName, and inviteUrl
 * @returns Array of results with success/failure per email
 */
export async function sendMemberInviteEmailsBatch(
  emails: Array<{
    to: string
    organizationName: string
    inviteUrl: string
  }>
): Promise<Array<{ email: string; success: boolean; error?: string }>> {
  // Validate required environment variable
  if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY environment variable is not set')
  }

  // Validate input
  if (!emails || emails.length === 0) {
    return []
  }

  // Resend batch API supports up to 100 emails per request
  if (emails.length > 100) {
    throw new Error('Cannot send more than 100 emails in a single batch')
  }

  // Initialize Resend client
  const resend = new Resend(process.env.RESEND_API_KEY)

  // Determine sender email (use environment variable or default to Fiive <notifications@fiive.co>)
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'Fiive <notifications@fiive.co>'

  // Prepare batch payload - each email needs its own object
  const batchPayload = emails.map(({ to, organizationName, inviteUrl }) => {
    const html = inviteMemberTemplate({ organizationName, inviteUrl })
    return {
      from: fromEmail,
      to: [to],
      subject: `${organizationName} invited you to join their team`,
      html,
    }
  })

  // Send batch via Resend Batch API with permissive validation mode
  // This allows partial success - some emails can succeed while others fail
  const response = await resend.batch.send(batchPayload, {
    batchValidation: 'permissive', // Allow partial success
  })

  // Handle overall batch error (entire request failed)
  if (response.error) {
    const errorMessage = response.error.message || 'Unknown error'
    console.error('[sendMemberInviteEmailsBatch] Batch API error:', errorMessage)
    // If entire batch failed, mark all emails as failed
    return emails.map(({ to }) => ({
      email: to,
      success: false,
      error: `Batch send failed: ${errorMessage}`,
    }))
  }

  // Process results - map batch response to email addresses
  // The data array contains successful emails in the same order as batchPayload
  // Check for errors in the response (may be in different format depending on Resend API)
  const results: Array<{ email: string; success: boolean; error?: string }> = []
  
  // Create a map of failed emails by index
  const failedEmailsMap = new Map<number, string>()
  // Check if response has errors property (may not exist in type but could be present at runtime)
  const responseErrors = (response as unknown as { errors?: Array<{ index: number; message: string }> }).errors
  if (responseErrors && Array.isArray(responseErrors)) {
    responseErrors.forEach((err) => {
      failedEmailsMap.set(err.index, err.message)
    })
  }

  // Process each email in the batch
  emails.forEach(({ to }, index) => {
    // Check if this email failed (has an error entry)
    if (failedEmailsMap.has(index)) {
      results.push({
        email: to,
        success: false,
        error: failedEmailsMap.get(index) || 'Email failed to send',
      })
    } else {
      // Email succeeded - should have a corresponding entry in data array
      // Note: data array length should match successful emails count
      results.push({ email: to, success: true })
    }
  })

  // Log summary
  const successfulCount = results.filter((r) => r.success).length
  const failedCount = results.filter((r) => !r.success).length
  console.log(
    `[sendMemberInviteEmailsBatch] Batch send complete: ${successfulCount} succeeded, ${failedCount} failed`
  )

  if (failedCount > 0) {
    const failedEmails = results.filter((r) => !r.success).map((r) => r.email)
    console.error('[sendMemberInviteEmailsBatch] Failed emails:', failedEmails)
  }

  return results
}

