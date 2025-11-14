-- ============================================================================
-- Migration: Create RPC to add draft agency organization and connection
-- Date: 2025-11-18
-- Description: Provides a transactional helper for clients to create a draft
--              agency organization linked to their client org via connections.
--              Creates the org and connection with 'invited' status (skips draft state).
--              Token generation happens in Node.js via createInviteToken, matching the client invite flow.
-- ============================================================================

-- Drop existing function if it exists (to allow return type change)
DROP FUNCTION IF EXISTS public.create_draft_agency_connection(uuid, uuid, text, text);

CREATE OR REPLACE FUNCTION public.create_draft_agency_connection(
  p_client_id uuid,
  p_owner_id uuid,
  p_agency_name text,
  p_primary_contact_email text
)
RETURNS TABLE (
  connection_id uuid,
  connection_status text,
  engagement_status text,
  agency_id uuid,
  agency_name text,
  logo_url text,
  is_draft boolean,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agency_id uuid;
  v_connection_id uuid;
  v_sanitized_name text;
  v_sanitized_email text;
  v_slug text;
  v_connection_code text;
  v_code_source text;
  v_attempts integer := 0;
BEGIN
  -- Validate and sanitize inputs
  v_sanitized_name := NULLIF(btrim(p_agency_name), '');
  IF v_sanitized_name IS NULL THEN
    RAISE EXCEPTION 'Agency name is required';
  END IF;

  v_sanitized_email := NULLIF(lower(btrim(p_primary_contact_email)), '');
  IF v_sanitized_email IS NULL THEN
    RAISE EXCEPTION 'Primary contact email is required';
  END IF;

  -- Validate email format (basic check)
  IF v_sanitized_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' THEN
    RAISE EXCEPTION 'Invalid email format';
  END IF;

  -- Validate client org exists and is a client type
  PERFORM 1
  FROM public.organizations
  WHERE id = p_client_id
    AND type = 'client'
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid client org';
  END IF;

  -- Generate unique connection code
  LOOP
    v_code_source := lower(replace(gen_random_uuid()::text, '-', '')); -- 32 chars
    v_connection_code :=
      substr(v_code_source, 1, 4) || '-' ||
      substr(v_code_source, 5, 4) || '-' ||
      substr(v_code_source, 9, 4) || '-' ||
      substr(v_code_source, 13, 4) || '-' ||
      substr(v_code_source, 17, 4);
    v_slug := v_connection_code;

    EXIT WHEN NOT EXISTS (
      SELECT 1
      FROM public.organizations
      WHERE connection_code = v_connection_code
         OR slug = v_slug
    );

    v_attempts := v_attempts + 1;
    IF v_attempts > 5 THEN
      RAISE EXCEPTION 'Could not generate unique connection code';
    END IF;
  END LOOP;

  -- Create draft agency organization
  INSERT INTO public.organizations (
    type,
    name,
    currency_code,
    connection_code,
    slug,
    description,
    website,
    industry,
    logo_url,
    owner_id,
    created_by_org_id,
    is_draft
  )
  VALUES (
    'agency',
    v_sanitized_name,
    'EUR',
    v_connection_code,
    v_slug,
    NULL,
    NULL,
    NULL,
    NULL,
    p_owner_id,
    p_client_id,
    true
  )
  RETURNING id INTO v_agency_id;

  -- Create connection with 'invited' status (skip draft state)
  -- Token will be generated in Node.js via createInviteToken, matching client invite flow
  INSERT INTO public.connections (
    agency_id,
    client_id,
    agency_primary_contact_id,
    client_primary_contact_id,
    connection_status,
    engagement_status,
    health_status,
    contract_value,
    contract_end_on,
    invited_email,
    invited_at,
    invite_token,
    connected_at,
    disconnected_at
  )
  VALUES (
    v_agency_id,
    p_client_id,
    NULL,
    NULL,
    'invited',
    NULL,
    NULL,
    NULL,
    NULL,
    v_sanitized_email,
    NOW(),
    NULL,
    NULL,
    NULL
  )
  RETURNING id INTO v_connection_id;

  RETURN QUERY
  SELECT
    c.id AS connection_id,
    c.connection_status::text,
    c.engagement_status::text,
    o.id AS agency_id,
    o.name AS agency_name,
    o.logo_url,
    o.is_draft,
    o.created_at
  FROM public.connections c
  JOIN public.organizations o ON o.id = c.agency_id
  WHERE c.id = v_connection_id;
END;
$$;

COMMENT ON FUNCTION public.create_draft_agency_connection(uuid, uuid, text, text)
IS 'Creates a draft agency organization and linked connection for a client in a single transaction. Sets connection status to invited (skips draft state). Token generation happens in Node.js via createInviteToken, matching the client invite flow pattern.';

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.create_draft_agency_connection(uuid, uuid, text, text) TO authenticated;

