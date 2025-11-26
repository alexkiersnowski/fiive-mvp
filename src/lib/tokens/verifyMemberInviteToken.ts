'use server'

import { createAdminClient } from '@/lib/supabase/server'

/**
 * Verifies a member invitation token and returns invitation details
 * 
 * @param token - Raw token string from URL
 * @returns Invitation details or error if invalid/expired
 */
export async function verifyMemberInviteToken(
  token: string
): Promise<{
  success: true
  invitationId: string
  orgId: string
  invitedEmail: string
  role: 'member' | 'owner'
} | {
  success: false
  error: string
}> {
  const supabase = createAdminClient()

  try {
    // Hash the token first (application-side hashing, no pgcrypto needed)
    const { createHash } = await import('crypto')
    const tokenHash = createHash('sha256').update(token).digest('hex')
    
    if (process.env.NODE_ENV !== 'production') {
      console.log('[verifyMemberInviteToken] Token hash:', tokenHash.substring(0, 16) + '...')
    }
    
    // Try RPC function first
    let result: { id: string; org_id: string; invited_email: string; role: string } | null = null
    
    const { data: rpcData, error: rpcError } = await supabase.rpc('verify_member_invite_token', {
      p_token_hash: tokenHash
    })

    if (rpcError) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('[verifyMemberInviteToken] RPC error:', rpcError)
        console.error('[verifyMemberInviteToken] Error details:', JSON.stringify(rpcError, null, 2))
      }
      
      // Fallback: Query directly if RPC fails (might be RPC function doesn't exist yet)
      if (process.env.NODE_ENV !== 'production') {
        console.log('[verifyMemberInviteToken] Falling back to direct query...')
      }
      
      const { data: directData, error: directError } = await supabase
        .from('membership_invitations')
        .select('id, org_id, invited_email, role')
        .eq('token_hash', tokenHash)
        .in('status', ['pending', 'accepted']) // Accept both pending and accepted invitations
        .gt('expires_at', new Date().toISOString())
        .single()
      
      if (directError || !directData) {
        if (process.env.NODE_ENV !== 'production') {
          console.error('[verifyMemberInviteToken] Direct query error:', directError)
        }
        return {
          success: false,
          error: `Invalid or expired invitation token: ${rpcError.message || 'Token not found'}`
        }
      }
      
      result = directData as { id: string; org_id: string; invited_email: string; role: string }
    } else {
      if (process.env.NODE_ENV !== 'production') {
        console.log('[verifyMemberInviteToken] RPC response:', rpcData)
      }

      // RPC returns an array, get the first result
      result = Array.isArray(rpcData) && rpcData.length > 0 ? rpcData[0] : null
    }

    if (!result || !result.id || !result.org_id || !result.invited_email || !result.role) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('[verifyMemberInviteToken] No valid result found. RPC data:', rpcData)
        // Try to see what's in the database
        const { data: debugData } = await supabase
          .from('membership_invitations')
          .select('id, org_id, invited_email, role, token_hash, status, expires_at')
          .eq('token_hash', tokenHash)
          .limit(5)
        console.error('[verifyMemberInviteToken] Debug query result:', debugData)
      }
      return {
        success: false,
        error: 'Invalid or expired invitation token'
      }
    }

    return {
      success: true,
      invitationId: result.id,
      orgId: result.org_id,
      invitedEmail: result.invited_email,
      role: result.role as 'member' | 'owner'
    }
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Unexpected error verifying member invite token:', error)
    }
    return {
      success: false,
      error: 'An unexpected error occurred while verifying the invitation'
    }
  }
}

