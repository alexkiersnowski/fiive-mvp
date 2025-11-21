'use server'

import { createClient } from '@/lib/supabase/server'
import { createHash } from 'crypto'
import { randomBytes } from 'crypto'

/**
 * Creates an invite token for a client connection
 * 
 * Generates a secure random token, hashes it with SHA-256, and stores the hash
 * in the connections table. Returns the raw token for use in email links.
 * 
 * @param connectionId - UUID of the connection
 * @param email - Email address of the invited client
 * @returns Raw token string (for email link) or null if error
 */
export async function createInviteToken(
  connectionId: string,
  email: string
): Promise<{ success: true; token: string } | { success: false; error: string }> {
  const supabase = await createClient()

  try {
    // Verify the user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return {
        success: false,
        error: 'Unauthorized'
      }
    }

    // Validate connection exists and is in draft state
    const { data: connection, error: connectionError } = await supabase
      .from('connections')
      .select('id, connection_status, agency_id, client_id')
      .eq('id', connectionId)
      .single()

    if (connectionError || !connection) {
      return {
        success: false,
        error: 'Connection not found'
      }
    }

    // CRITICAL: Only allow token creation for internal or invited connections
    // (invited allows re-invites after 7 days)
    if (connection.connection_status !== 'internal' && connection.connection_status !== 'invited') {
      return {
        success: false,
        error: 'Token can only be created for internal or invited connections'
      }
    }

    // Generate raw token (32 bytes = 256 bits)
    const rawToken = randomBytes(32).toString('hex')

    // Hash the token using SHA-256
    const tokenHash = createHash('sha256').update(rawToken).digest('hex')

    // Update connections row with hashed token, invite details, and status
    const { error: updateError } = await supabase
      .from('connections')
      .update({
        invite_token: tokenHash,
        invited_email: email,
        invited_at: new Date().toISOString(),
        connection_status: 'invited'
      })
      .eq('id', connectionId)

    if (updateError) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Error updating connection with invite token:', updateError)
      }
      return {
        success: false,
        error: 'Failed to store invite token'
      }
    }

    // Return raw token (for email link) - never store this in DB
    return {
      success: true,
      token: rawToken
    }
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Unexpected error creating invite token:', error)
    }
    return {
      success: false,
      error: 'An unexpected error occurred'
    }
  }
}

