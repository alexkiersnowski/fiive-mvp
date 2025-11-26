-- ============================================================================
-- Migration: Prevent memberships in draft organizations
-- Date: 2025-11-11
-- Description: Adds database-level trigger to prevent creating memberships in draft
--              organizations. Draft orgs are only visible through connections,
--              never as active logged-in contexts.
--
-- NOTE: RLS policies should be updated manually in Supabase dashboard to add
--       draft org checks to existing INSERT policies. This migration only adds
--       the trigger as a database-level safeguard.
-- ============================================================================

-- IMPORTANT: This trigger prevents ANY insert (even with admin client) into draft org memberships
-- This is the most critical safeguard - it works regardless of RLS policies

-- Create or replace the function to check draft status
CREATE OR REPLACE FUNCTION check_no_draft_org_membership()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $function$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.organizations
    WHERE id = NEW.org_id
      AND is_draft = true
  ) THEN
    RAISE EXCEPTION 'Cannot create membership in draft organization. Draft orgs cannot have members.';
  END IF;
  RETURN NEW;
END;
$function$;

-- Add comment to the function
COMMENT ON FUNCTION check_no_draft_org_membership() IS 
'Prevents creating memberships in draft organizations. This is a critical security measure to ensure draft orgs never become active contexts.';

-- Drop trigger if it exists, then recreate it
DROP TRIGGER IF EXISTS memberships_no_draft_orgs_trigger ON public.memberships;

CREATE TRIGGER memberships_no_draft_orgs_trigger
BEFORE INSERT ON public.memberships
FOR EACH ROW
EXECUTE FUNCTION check_no_draft_org_membership();

-- Add comment to the trigger
COMMENT ON TRIGGER memberships_no_draft_orgs_trigger ON public.memberships
IS 'Prevents inserting memberships into draft organizations. Draft orgs are only visible through connections, never as active contexts.';

