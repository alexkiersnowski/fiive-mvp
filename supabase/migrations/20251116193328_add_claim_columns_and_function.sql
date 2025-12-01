-- ============================================================================
-- Migration: Add claim columns and atomic claim function
-- Date: 2025-11-16
-- Description: Adds claimed_at column to organizations, ensures connected_at exists,
--              and creates atomic claim_organization function for both agency and
--              client invite flows. The claim function generates a proper slug from
--              the organization name (replacing the random draft slug) following
--              the same pattern as regular organization creation: lowercase, hyphens
--              for spaces, random suffix if conflict.
-- ============================================================================

-- Add claimed_at column to organizations if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'organizations' 
    AND column_name = 'claimed_at'
  ) THEN
    ALTER TABLE public.organizations
    ADD COLUMN claimed_at timestamptz;
  END IF;
END $$;

-- Ensure connected_at exists in connections (should already exist, but verify)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'connections' 
    AND column_name = 'connected_at'
  ) THEN
    ALTER TABLE public.connections
    ADD COLUMN connected_at timestamptz;
  END IF;
END $$;

-- Drop existing function if it exists (needed to change parameter names)
DROP FUNCTION IF EXISTS public.claim_organization(uuid, uuid, uuid);

-- Create atomic claim function
CREATE OR REPLACE FUNCTION public.claim_organization(
  p_connection_id uuid,
  p_draft_org_id uuid,
  p_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_rows int;
  v_conn_rows int;
  v_org_name text;
  v_base_slug text;
  v_slug text;
  v_attempts integer := 0;
  v_suffix text;
BEGIN
  -- Get organization name for slug generation
  SELECT name INTO v_org_name
  FROM public.organizations
  WHERE id = p_draft_org_id
    AND is_draft = true;

  IF v_org_name IS NULL THEN
    RAISE EXCEPTION 'Organization not found or already claimed';
  END IF;

  -- Generate base slug from organization name
  -- First convert to lowercase, then replace spaces with hyphens, remove special characters
  v_base_slug := lower(trim(v_org_name));
  v_base_slug := regexp_replace(v_base_slug, '[^a-z0-9\s-]', '', 'g');
  v_base_slug := regexp_replace(v_base_slug, '\s+', '-', 'g');
  
  -- Remove leading/trailing hyphens
  v_base_slug := trim(both '-' from v_base_slug);
  
  -- Ensure slug is not empty (fallback to 'organization' if needed)
  IF v_base_slug = '' THEN
    v_base_slug := 'organization';
  END IF;

  -- Generate unique slug (check for conflicts and append suffix if needed)
  v_slug := v_base_slug;
  LOOP
    -- Check if slug already exists (excluding current organization and draft orgs)
    EXIT WHEN NOT EXISTS (
      SELECT 1
      FROM public.organizations
      WHERE slug = v_slug
        AND id != p_draft_org_id
        AND is_draft = false
        AND deleted_at IS NULL
    );

    -- Generate random suffix (4 hex characters)
    v_suffix := substr(replace(gen_random_uuid()::text, '-', ''), 1, 4);
    v_slug := v_base_slug || '-' || v_suffix;

    v_attempts := v_attempts + 1;
    IF v_attempts > 10 THEN
      RAISE EXCEPTION 'Could not generate unique slug';
    END IF;
  END LOOP;

  -- CRITICAL: Update organization FIRST to set is_draft = false and slug
  -- This must happen before inserting membership, otherwise the trigger
  -- check_no_draft_org_membership() will block the insert
  UPDATE public.organizations
  SET owner_id = p_user_id,
      is_draft = false,
      slug = v_slug,
      claimed_at = NOW(),
      updated_at = NOW()
  WHERE id = p_draft_org_id
    AND is_draft = true;

  GET DIAGNOSTICS v_org_rows = ROW_COUNT;
  IF v_org_rows = 0 THEN
    RAISE EXCEPTION 'Organization already claimed or invalid state';
  END IF;

  -- Now insert membership - org is no longer draft, so trigger will allow it
  INSERT INTO public.memberships (
    org_id, user_id, role, created_at, updated_at
  )
  VALUES (
    p_draft_org_id, p_user_id, 'member', NOW(), NOW()
  )
  ON CONFLICT DO NOTHING;

  UPDATE public.connections
  SET connection_status = 'connected',
      connected_at = NOW(),
      invite_token = NULL,
      -- Set primary contact based on organization type:
      -- If claiming an agency org and user email matches invited_email, set agency_primary_contact_id
      -- If claiming a client org and user email matches invited_email, set client_primary_contact_id
      agency_primary_contact_id = CASE 
        WHEN (SELECT email FROM auth.users WHERE id = p_user_id) = 
             (SELECT invited_email FROM public.connections WHERE id = p_connection_id)
        AND (SELECT type FROM public.organizations WHERE id = p_draft_org_id) = 'agency'
        THEN p_user_id
        ELSE agency_primary_contact_id
      END,
      client_primary_contact_id = CASE 
        WHEN (SELECT email FROM auth.users WHERE id = p_user_id) = 
             (SELECT invited_email FROM public.connections WHERE id = p_connection_id)
        AND (SELECT type FROM public.organizations WHERE id = p_draft_org_id) = 'client'
        THEN p_user_id
        ELSE client_primary_contact_id
      END,
      updated_at = NOW()
  WHERE id = p_connection_id
    AND connection_status IN ('internal', 'invited');

  GET DIAGNOSTICS v_conn_rows = ROW_COUNT;
  IF v_conn_rows = 0 THEN
    RAISE EXCEPTION 'Connection invalid or already connected';
  END IF;
END;
$$;

COMMENT ON FUNCTION public.claim_organization(uuid, uuid, uuid)
IS 'Atomically claims a draft organization (agency or client): updates organization (including slug generation from name), creates membership, and updates connection. Generates proper slug from organization name, replacing the random draft slug. Sets the appropriate primary contact ID (agency_primary_contact_id for agencies, client_primary_contact_id for clients) when the claiming user matches the invited email.';

