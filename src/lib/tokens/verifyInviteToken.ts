'use server'

import { createAdminClient } from '@/lib/supabase/server'

/**
 * Verifies an invite token and returns connection details
 * 
 * @param token - Raw token string from URL
 * @returns Connection details or null if invalid/expired
 */
export async function verifyInviteToken(
  token: string
): Promise<{
  success: true
  connectionId: string
  clientId: string
  invitedEmail: string
} | {
  success: false
  error: string
}> {
  const supabase = createAdminClient()

  try {
    // Hash the token first (application-side hashing, no pgcrypto needed)
    const { createHash } = await import('crypto')
    const tokenHash = createHash('sha256').update(token).digest('hex')
    
    // Call the RPC function with the hashed token
    const { data, error } = await supabase.rpc('verify_invite_token', {
      token_hash: tokenHash
    })

    if (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Error verifying invite token:', error.message)
      }
      return {
        success: false,
        error: 'Invalid or expired invitation token'
      }
    }

    // RPC returns an array, get the first result
    const result = Array.isArray(data) && data.length > 0 ? data[0] : null

    if (!result || !result.connection_id || !result.client_id || !result.invited_email) {
      return {
        success: false,
        error: 'Invalid or expired invitation token'
      }
    }

    return {
      success: true,
      connectionId: result.connection_id,
      clientId: result.client_id,
      invitedEmail: result.invited_email
    }
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Unexpected error verifying invite token:', error)
    }
    return {
      success: false,
      error: 'An unexpected error occurred while verifying the invitation'
    }
  }
}

