-- ============================================================================
-- Migration: Add verify_member_invite_token RPC function
-- Date: 2025-11-16
-- Description: Creates a read-only RPC function to verify member invitation tokens
--              for the member invite claim flow. Accepts pre-hashed token (hashed in Node.js)
--              and checks if it matches a membership_invitations token_hash within
--              the expiration window. Returns invitation details if valid.
-- ============================================================================

-- Drop existing function if it exists (to allow parameter name change)
DROP FUNCTION IF EXISTS public.verify_member_invite_token(TEXT);

CREATE OR REPLACE FUNCTION public.verify_member_invite_token(p_token_hash TEXT)
RETURNS TABLE (
  id uuid,
  org_id uuid,
  invited_email text,
  role role
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Return invitation details if token hash matches and is not expired
  -- Token is already hashed in the application layer (Node.js)
  -- Use p_token_hash parameter name to avoid conflict with column name
  RETURN QUERY
  SELECT
    mi.id,
    mi.org_id,
    mi.invited_email,
    mi.role
  FROM public.membership_invitations mi
  WHERE mi.token_hash = p_token_hash
    AND mi.status IN ('pending', 'accepted')
    AND mi.expires_at > NOW();
END;
$$;

COMMENT ON FUNCTION public.verify_member_invite_token(TEXT)
IS 'Verifies a member invitation token hash (pre-hashed in Node.js) and checks against membership_invitations table. Returns invitation details if token is valid, status is pending or accepted, and not expired.';

-- Grant execute permission to anonymous and authenticated users
-- Required for unauthenticated users to verify invite tokens
GRANT EXECUTE ON FUNCTION public.verify_member_invite_token(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.verify_member_invite_token(TEXT) TO authenticated;

