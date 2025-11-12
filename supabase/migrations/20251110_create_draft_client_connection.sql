-- ============================================================================
-- Migration: Create RPC to add draft client organization and connection
-- Date: 2025-11-10
-- Description: Provides a transactional helper for agencies to create a draft
--              client organization linked to their agency via connections.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_draft_client_connection(
  p_agency_id uuid,
  p_owner_id uuid,
  p_client_name text
)
RETURNS TABLE (
  connection_id uuid,
  connection_status text,
  engagement_status text,
  client_id uuid,
  client_name text,
  logo_url text,
  is_draft boolean,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id uuid;
  v_connection_id uuid;
  v_sanitized_name text;
  v_slug text;
  v_connection_code text;
  v_code_source text;
  v_attempts integer := 0;
BEGIN
  -- Explicitly set search_path at function level (via SET clause above) to prevent search path issues
  -- The SET clause ensures search_path is set for the entire function execution

  v_sanitized_name := NULLIF(btrim(p_client_name), '');
  IF v_sanitized_name IS NULL THEN
    RAISE EXCEPTION 'Client name is required';
  END IF;

  PERFORM 1
  FROM public.organizations
  WHERE id = p_agency_id
    AND type = 'agency'
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid agency org';
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
    created_by_agency_id,
    is_draft
  )
  VALUES (
    'client',
    v_sanitized_name,
    'EUR',
    v_connection_code,
    v_slug,
    NULL,
    NULL,
    NULL,
    NULL,
    p_owner_id,
    p_agency_id,
    true
  )
  RETURNING id INTO v_client_id;

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
    p_agency_id,
    v_client_id,
    NULL,
    NULL,
    'draft',
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
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
    o.id AS client_id,
    o.name AS client_name,
    o.logo_url,
    o.is_draft,
    o.created_at
  FROM public.connections c
  JOIN public.organizations o ON o.id = c.client_id
  WHERE c.id = v_connection_id;
END;
$$;

COMMENT ON FUNCTION public.create_draft_client_connection(uuid, uuid, text)
IS 'Creates a draft client organization and linked connection for an agency in a single transaction. RLS policies use existing helper functions (auth_user_owns_org, user_is_member_of_org) to validate membership - no session variables needed.';

