-- ============================================================================
-- Migration: Add check_user_email_exists RPC function
-- Date: 2025-11-17
-- Description: Creates an efficient RPC function to check if a user exists
--              by email address. Uses direct query to auth.users table instead
--              of listing all users, which scales much better.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.check_user_email_exists(p_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_exists boolean;
BEGIN
  -- Query auth.users directly (much more efficient than listing all users)
  SELECT EXISTS(
    SELECT 1
    FROM auth.users
    WHERE email = lower(trim(p_email))
  ) INTO v_user_exists;
  
  RETURN v_user_exists;
END;
$$;

COMMENT ON FUNCTION public.check_user_email_exists(text)
IS 'Efficiently checks if a user exists by email address. Returns true if user exists, false otherwise. Uses direct query to auth.users table for better performance.';

-- Grant execute permission to authenticated users (agency members who can invite)
GRANT EXECUTE ON FUNCTION public.check_user_email_exists(text) TO authenticated;

