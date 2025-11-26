-- ============================================================================
-- Migration: Add verify_invite_token RPC function
-- Date: 2025-11-13
-- Description: Creates a read-only RPC function to verify invite tokens
--              for the client claim flow. Accepts pre-hashed token (hashed in Node.js)
--              and checks if it matches a connection's invite_token within
--              the 7-day expiration window. Accepts both 'draft' and 'invited' statuses.
-- ============================================================================

-- Drop existing function if it exists (to allow parameter name change)
DROP FUNCTION IF EXISTS public.verify_invite_token(TEXT);

CREATE OR REPLACE FUNCTION public.verify_invite_token(token_hash TEXT)
RETURNS TABLE (
  connection_id uuid,
  client_id uuid,
  invited_email text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Return connection details if token hash matches and is not expired
  -- Token is already hashed in the application layer (Node.js)
  -- Returns the draft org ID (client_id for agency-invited clients, agency_id for client-invited agencies)
  -- The client_id field is used generically to return the draft org ID
  RETURN QUERY
  SELECT
    c.id AS connection_id,
    CASE 
      -- If client org is draft, return client_id
      WHEN EXISTS (
        SELECT 1 FROM public.organizations o 
        WHERE o.id = c.client_id AND o.is_draft = true
      ) THEN c.client_id
      -- If agency org is draft, return agency_id
      WHEN EXISTS (
        SELECT 1 FROM public.organizations o 
        WHERE o.id = c.agency_id AND o.is_draft = true
      ) THEN c.agency_id
      -- Fallback (shouldn't happen if data is consistent)
      ELSE c.client_id
    END AS client_id,
    c.invited_email
  FROM public.connections c
  WHERE c.invite_token = token_hash
    AND c.invited_at IS NOT NULL
    AND c.invited_at > (NOW() - INTERVAL '7 days')
    AND c.connection_status IN ('draft', 'invited');
END;
$$;

COMMENT ON FUNCTION public.verify_invite_token(TEXT)
IS 'Verifies an invite token hash (pre-hashed in Node.js) and checks against connections table. Returns connection details if token is valid and not expired (7 days). Accepts both draft and invited connection statuses. Works for both agency-inviting-client and client-inviting-agency flows. Returns the draft org ID (client_id field contains the draft org ID, whether it is a client or agency org).';

-- Grant execute permission to anonymous and authenticated users
-- Required for unauthenticated users to verify invite tokens
GRANT EXECUTE ON FUNCTION public.verify_invite_token(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.verify_invite_token(TEXT) TO authenticated;

