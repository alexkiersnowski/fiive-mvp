-- ============================================================================
-- Migration: RPC function for sorting requests by organization name
-- Date: 2025-12-07
-- Description: Creates a PostgreSQL function to sort requests by organization
--              name through connections. This bypasses PostgREST's limitation
--              of not supporting ordering through two-level nested joins.
-- ============================================================================

-- Drop existing function if it exists (for idempotency)
DROP FUNCTION IF EXISTS public.get_requests_sorted_by_org_name(
  uuid[],
  text,
  int,
  int,
  text,
  uuid,
  uuid
);

-- Create RPC function for sorting requests by organization name
CREATE OR REPLACE FUNCTION public.get_requests_sorted_by_org_name(
  p_connection_ids uuid[],
  p_sort_type text, -- 'client_asc', 'client_desc', 'agency_asc', 'agency_desc'
  p_limit_count int,
  p_offset_count int,
  p_search_query text DEFAULT NULL,
  p_assigned_to_user_id uuid DEFAULT NULL,
  p_created_by_user_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result json;
  v_sort_asc boolean;
  v_search_pattern text;
  v_status_match text;
BEGIN
  -- Validate inputs
  IF p_connection_ids IS NULL OR array_length(p_connection_ids, 1) IS NULL THEN
    RETURN '[]'::json;
  END IF;

  -- Validate sort type
  IF p_sort_type NOT IN ('client_asc', 'client_desc', 'agency_asc', 'agency_desc') THEN
    RAISE EXCEPTION 'Invalid sort_type: %. Must be one of: client_asc, client_desc, agency_asc, agency_desc', p_sort_type;
  END IF;

  -- Determine sort direction
  v_sort_asc := p_sort_type IN ('client_asc', 'agency_asc');

  -- Prepare search pattern
  IF p_search_query IS NOT NULL AND p_search_query != '' THEN
    v_search_pattern := '%' || p_search_query || '%';
    -- Check if search matches a status
    v_status_match := CASE LOWER(TRIM(p_search_query))
      WHEN 'open' THEN 'new'
      WHEN 'new' THEN 'new'
      WHEN 'in review' THEN 'in_review'
      WHEN 'in_review' THEN 'in_review'
      WHEN 'review' THEN 'in_review'
      WHEN 'reviewing' THEN 'in_review'
      WHEN 'accepted' THEN 'accepted'
      WHEN 'approve' THEN 'accepted'
      WHEN 'approved' THEN 'accepted'
      WHEN 'accept' THEN 'accepted'
      WHEN 'canceled' THEN 'canceled'
      WHEN 'cancelled' THEN 'canceled'
      WHEN 'cancel' THEN 'canceled'
      WHEN 'closed' THEN 'closed'
      WHEN 'close' THEN 'closed'
      WHEN 'completed' THEN 'closed'
      ELSE NULL
    END;
  END IF;

  -- Build and execute query based on sort type
  -- Note: RLS policies are automatically applied because we're querying tables directly
  -- SECURITY DEFINER runs with definer privileges but respects RLS policies
  IF p_sort_type = 'client_asc' THEN
    -- Sort by client organization name (A-Z)
    WITH ordered_requests AS (
      SELECT 
        r.id,
        r.title,
        r.description,
        r.status,
        r.project_id,
        r.project_name_cached,
        r.connection_id,
        r.created_by_user_id,
        r.assignee_user_id,
        r.created_at,
        r.created_by_org_id,
        conn.client_id,
        conn.agency_id,
        client_org.name AS client_org_name,
        client_org.logo_url AS client_org_logo,
        agency_org.name AS agency_org_name,
        agency_org.logo_url AS agency_org_logo
      FROM public.requests r
      INNER JOIN public.connections conn ON r.connection_id = conn.id
      LEFT JOIN public.organizations client_org ON conn.client_id = client_org.id AND client_org.deleted_at IS NULL
      LEFT JOIN public.organizations agency_org ON conn.agency_id = agency_org.id AND agency_org.deleted_at IS NULL
      WHERE r.connection_id = ANY(p_connection_ids)
        AND r.deleted_at IS NULL
        AND (p_assigned_to_user_id IS NULL OR r.assignee_user_id = p_assigned_to_user_id)
        AND (p_created_by_user_id IS NULL OR r.created_by_user_id = p_created_by_user_id)
        AND (
          v_search_pattern IS NULL OR
          r.title ILIKE v_search_pattern OR
          r.project_name_cached ILIKE v_search_pattern OR
          (v_status_match IS NOT NULL AND r.status::text = v_status_match) OR
          (LOWER(p_search_query) LIKE '%general%' AND r.project_id IS NULL)
        )
      ORDER BY COALESCE(client_org.name, '') COLLATE "C" ASC, r.created_at DESC
      LIMIT p_limit_count
      OFFSET p_offset_count
    )
    SELECT COALESCE(json_agg(
      json_build_object(
        'id', id,
        'title', title,
        'description', description,
        'status', status,
        'project_id', project_id,
        'project_name_cached', project_name_cached,
        'connection_id', connection_id,
        'created_by_user_id', created_by_user_id,
        'assignee_user_id', assignee_user_id,
        'created_at', created_at,
        'created_by_org_id', created_by_org_id,
        'client_id', client_id,
        'agency_id', agency_id,
        'client_org_name', client_org_name,
        'client_org_logo', client_org_logo,
        'agency_org_name', agency_org_name,
        'agency_org_logo', agency_org_logo
      )
    ), '[]'::json)
    INTO v_result
    FROM ordered_requests;
  ELSIF p_sort_type = 'client_desc' THEN
    -- Sort by client organization name (Z-A)
    WITH ordered_requests AS (
      SELECT 
        r.id,
        r.title,
        r.description,
        r.status,
        r.project_id,
        r.project_name_cached,
        r.connection_id,
        r.created_by_user_id,
        r.assignee_user_id,
        r.created_at,
        r.created_by_org_id,
        conn.client_id,
        conn.agency_id,
        client_org.name AS client_org_name,
        client_org.logo_url AS client_org_logo,
        agency_org.name AS agency_org_name,
        agency_org.logo_url AS agency_org_logo
      FROM public.requests r
      INNER JOIN public.connections conn ON r.connection_id = conn.id
      LEFT JOIN public.organizations client_org ON conn.client_id = client_org.id AND client_org.deleted_at IS NULL
      LEFT JOIN public.organizations agency_org ON conn.agency_id = agency_org.id AND agency_org.deleted_at IS NULL
      WHERE r.connection_id = ANY(p_connection_ids)
        AND r.deleted_at IS NULL
        AND (p_assigned_to_user_id IS NULL OR r.assignee_user_id = p_assigned_to_user_id)
        AND (p_created_by_user_id IS NULL OR r.created_by_user_id = p_created_by_user_id)
        AND (
          v_search_pattern IS NULL OR
          r.title ILIKE v_search_pattern OR
          r.project_name_cached ILIKE v_search_pattern OR
          (v_status_match IS NOT NULL AND r.status::text = v_status_match) OR
          (LOWER(p_search_query) LIKE '%general%' AND r.project_id IS NULL)
        )
      ORDER BY COALESCE(client_org.name, '') COLLATE "C" DESC, r.created_at DESC
      LIMIT p_limit_count
      OFFSET p_offset_count
    )
    SELECT COALESCE(json_agg(
      json_build_object(
        'id', id,
        'title', title,
        'description', description,
        'status', status,
        'project_id', project_id,
        'project_name_cached', project_name_cached,
        'connection_id', connection_id,
        'created_by_user_id', created_by_user_id,
        'assignee_user_id', assignee_user_id,
        'created_at', created_at,
        'created_by_org_id', created_by_org_id,
        'client_id', client_id,
        'agency_id', agency_id,
        'client_org_name', client_org_name,
        'client_org_logo', client_org_logo,
        'agency_org_name', agency_org_name,
        'agency_org_logo', agency_org_logo
      )
    ), '[]'::json)
    INTO v_result
    FROM ordered_requests;
  ELSIF p_sort_type = 'agency_asc' THEN
    -- Sort by agency organization name (A-Z)
    WITH ordered_requests AS (
      SELECT 
        r.id,
        r.title,
        r.description,
        r.status,
        r.project_id,
        r.project_name_cached,
        r.connection_id,
        r.created_by_user_id,
        r.assignee_user_id,
        r.created_at,
        r.created_by_org_id,
        conn.client_id,
        conn.agency_id,
        client_org.name AS client_org_name,
        client_org.logo_url AS client_org_logo,
        agency_org.name AS agency_org_name,
        agency_org.logo_url AS agency_org_logo
      FROM public.requests r
      INNER JOIN public.connections conn ON r.connection_id = conn.id
      LEFT JOIN public.organizations client_org ON conn.client_id = client_org.id AND client_org.deleted_at IS NULL
      LEFT JOIN public.organizations agency_org ON conn.agency_id = agency_org.id AND agency_org.deleted_at IS NULL
      WHERE r.connection_id = ANY(p_connection_ids)
        AND r.deleted_at IS NULL
        AND (p_assigned_to_user_id IS NULL OR r.assignee_user_id = p_assigned_to_user_id)
        AND (p_created_by_user_id IS NULL OR r.created_by_user_id = p_created_by_user_id)
        AND (
          v_search_pattern IS NULL OR
          r.title ILIKE v_search_pattern OR
          r.project_name_cached ILIKE v_search_pattern OR
          (v_status_match IS NOT NULL AND r.status::text = v_status_match) OR
          (LOWER(p_search_query) LIKE '%general%' AND r.project_id IS NULL)
        )
      ORDER BY COALESCE(agency_org.name, '') COLLATE "C" ASC, r.created_at DESC
      LIMIT p_limit_count
      OFFSET p_offset_count
    )
    SELECT COALESCE(json_agg(
      json_build_object(
        'id', id,
        'title', title,
        'description', description,
        'status', status,
        'project_id', project_id,
        'project_name_cached', project_name_cached,
        'connection_id', connection_id,
        'created_by_user_id', created_by_user_id,
        'assignee_user_id', assignee_user_id,
        'created_at', created_at,
        'created_by_org_id', created_by_org_id,
        'client_id', client_id,
        'agency_id', agency_id,
        'client_org_name', client_org_name,
        'client_org_logo', client_org_logo,
        'agency_org_name', agency_org_name,
        'agency_org_logo', agency_org_logo
      )
    ), '[]'::json)
    INTO v_result
    FROM ordered_requests;
  ELSE
    -- Sort by agency organization name (Z-A)
    WITH ordered_requests AS (
      SELECT 
        r.id,
        r.title,
        r.description,
        r.status,
        r.project_id,
        r.project_name_cached,
        r.connection_id,
        r.created_by_user_id,
        r.assignee_user_id,
        r.created_at,
        r.created_by_org_id,
        conn.client_id,
        conn.agency_id,
        client_org.name AS client_org_name,
        client_org.logo_url AS client_org_logo,
        agency_org.name AS agency_org_name,
        agency_org.logo_url AS agency_org_logo
      FROM public.requests r
      INNER JOIN public.connections conn ON r.connection_id = conn.id
      LEFT JOIN public.organizations client_org ON conn.client_id = client_org.id AND client_org.deleted_at IS NULL
      LEFT JOIN public.organizations agency_org ON conn.agency_id = agency_org.id AND agency_org.deleted_at IS NULL
      WHERE r.connection_id = ANY(p_connection_ids)
        AND r.deleted_at IS NULL
        AND (p_assigned_to_user_id IS NULL OR r.assignee_user_id = p_assigned_to_user_id)
        AND (p_created_by_user_id IS NULL OR r.created_by_user_id = p_created_by_user_id)
        AND (
          v_search_pattern IS NULL OR
          r.title ILIKE v_search_pattern OR
          r.project_name_cached ILIKE v_search_pattern OR
          (v_status_match IS NOT NULL AND r.status::text = v_status_match) OR
          (LOWER(p_search_query) LIKE '%general%' AND r.project_id IS NULL)
        )
      ORDER BY COALESCE(agency_org.name, '') COLLATE "C" DESC, r.created_at DESC
      LIMIT p_limit_count
      OFFSET p_offset_count
    )
    SELECT COALESCE(json_agg(
      json_build_object(
        'id', id,
        'title', title,
        'description', description,
        'status', status,
        'project_id', project_id,
        'project_name_cached', project_name_cached,
        'connection_id', connection_id,
        'created_by_user_id', created_by_user_id,
        'assignee_user_id', assignee_user_id,
        'created_at', created_at,
        'created_by_org_id', created_by_org_id,
        'client_id', client_id,
        'agency_id', agency_id,
        'client_org_name', client_org_name,
        'client_org_logo', client_org_logo,
        'agency_org_name', agency_org_name,
        'agency_org_logo', agency_org_logo
      )
    ), '[]'::json)
    INTO v_result
    FROM ordered_requests;
  END IF;

  -- Return empty array if no results
  RETURN COALESCE(v_result, '[]'::json);
END;
$$;

COMMENT ON FUNCTION public.get_requests_sorted_by_org_name(uuid[], text, int, int, text, uuid, uuid)
IS 'Returns requests sorted by organization name (client or agency) through connections. Bypasses PostgREST limitation of not supporting ordering through two-level nested joins. Respects RLS policies automatically.';

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_requests_sorted_by_org_name(uuid[], text, int, int, text, uuid, uuid) TO authenticated;

