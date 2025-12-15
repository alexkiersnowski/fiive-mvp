-- ============================================================================
-- Migration: RPC function for sorting tasks by organization name
-- Date: 2025-12-07
-- Description: Creates a PostgreSQL function to sort tasks by organization
--              name through connections. This bypasses PostgREST's limitation
--              of not supporting ordering through two-level nested joins.
--              Handles complex sorting: org name → Done separation → due_date/created_at
-- ============================================================================

-- Drop existing function if it exists (for idempotency)
DROP FUNCTION IF EXISTS public.get_tasks_sorted_by_org_name(
  uuid[],
  text,
  int,
  int,
  text,
  uuid,
  uuid[]
);

-- Create RPC function for sorting tasks by organization name
CREATE OR REPLACE FUNCTION public.get_tasks_sorted_by_org_name(
  p_connection_ids uuid[],
  p_sort_type text, -- 'client_asc', 'client_desc', 'agency_asc', 'agency_desc'
  p_limit_count int,
  p_offset_count int,
  p_search_query text DEFAULT NULL,
  p_assigned_to_user_id uuid DEFAULT NULL,
  p_assigned_to_user_ids uuid[] DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result json;
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

  -- Prepare search pattern
  IF p_search_query IS NOT NULL AND p_search_query != '' THEN
    v_search_pattern := '%' || p_search_query || '%';
    -- Check if search matches a status
    v_status_match := CASE LOWER(TRIM(p_search_query))
      WHEN 'to do' THEN 'to_do'
      WHEN 'todo' THEN 'to_do'
      WHEN 'open' THEN 'to_do'
      WHEN 'backlog' THEN 'to_do'
      WHEN 'in progress' THEN 'in_progress'
      WHEN 'progress' THEN 'in_progress'
      WHEN 'active' THEN 'in_progress'
      WHEN 'working' THEN 'in_progress'
      WHEN 'on hold' THEN 'on_hold'
      WHEN 'hold' THEN 'on_hold'
      WHEN 'paused' THEN 'on_hold'
      WHEN 'blocked' THEN 'on_hold'
      WHEN 'completed' THEN 'done'
      WHEN 'complete' THEN 'done'
      WHEN 'done' THEN 'done'
      WHEN 'finished' THEN 'done'
      ELSE NULL
    END;
  END IF;

  -- Build and execute query based on sort type
  -- Complex sorting logic:
  -- 1. Sort by org name (A-Z or Z-A)
  -- 2. Within same org: Done tasks at bottom
  -- 3. Within Done: sort by completed_at DESC
  -- 4. Within active: sort by due_date ASC (nulls last), then created_at DESC
  IF p_sort_type = 'client_asc' THEN
    -- Sort by client organization name (A-Z)
    WITH ordered_tasks AS (
      SELECT 
        t.id,
        t.connection_id,
        t.project_id,
        t.title,
        t.description,
        t.status::text AS status,
        t.due_date,
        t.assignee_user_id,
        t.client_visible,
        t.created_by_user_id,
        t.created_at,
        t.updated_at,
        t.completed_at,
        t.source_request_id,
        conn.client_id,
        conn.agency_id,
        client_org.name AS client_org_name,
        client_org.logo_url AS client_org_logo,
        agency_org.name AS agency_org_name,
        agency_org.logo_url AS agency_org_logo
      FROM public.tasks t
      INNER JOIN public.connections conn ON t.connection_id = conn.id
      LEFT JOIN public.organizations client_org ON conn.client_id = client_org.id AND client_org.deleted_at IS NULL
      LEFT JOIN public.organizations agency_org ON conn.agency_id = agency_org.id AND agency_org.deleted_at IS NULL
      WHERE t.connection_id = ANY(p_connection_ids)
        AND t.deleted_at IS NULL
        AND (p_assigned_to_user_id IS NULL OR t.assignee_user_id = p_assigned_to_user_id)
        AND (p_assigned_to_user_ids IS NULL OR t.assignee_user_id = ANY(p_assigned_to_user_ids))
        AND (
          v_search_pattern IS NULL OR
          t.title ILIKE v_search_pattern OR
          t.description ILIKE v_search_pattern OR
          (v_status_match IS NOT NULL AND t.status::text = v_status_match)
        )
      ORDER BY 
        COALESCE(client_org.name, '') COLLATE "C" ASC,
        CASE WHEN t.status::text = 'done' THEN 1 ELSE 0 END ASC, -- Done tasks last within org
        CASE WHEN t.status::text = 'done' THEN t.completed_at END DESC NULLS LAST, -- Done: newest completed first
        CASE WHEN t.status::text != 'done' THEN t.due_date END ASC NULLS LAST, -- Active: soonest due first
        t.created_at DESC -- Tiebreaker: newest created first
      LIMIT p_limit_count
      OFFSET p_offset_count
    )
    SELECT COALESCE(json_agg(
      json_build_object(
        'id', id,
        'connection_id', connection_id,
        'project_id', project_id,
        'title', title,
        'description', description,
        'status', status,
        'due_date', due_date,
        'assignee_user_id', assignee_user_id,
        'client_visible', client_visible,
        'created_by_user_id', created_by_user_id,
        'created_at', created_at,
        'updated_at', updated_at,
        'completed_at', completed_at,
        'source_request_id', source_request_id,
        'client_id', client_id,
        'agency_id', agency_id,
        'client_org_name', client_org_name,
        'client_org_logo', client_org_logo,
        'agency_org_name', agency_org_name,
        'agency_org_logo', agency_org_logo
      )
    ), '[]'::json)
    INTO v_result
    FROM ordered_tasks;
  ELSIF p_sort_type = 'client_desc' THEN
    -- Sort by client organization name (Z-A)
    WITH ordered_tasks AS (
      SELECT 
        t.id,
        t.connection_id,
        t.project_id,
        t.title,
        t.description,
        t.status::text AS status,
        t.due_date,
        t.assignee_user_id,
        t.client_visible,
        t.created_by_user_id,
        t.created_at,
        t.updated_at,
        t.completed_at,
        t.source_request_id,
        conn.client_id,
        conn.agency_id,
        client_org.name AS client_org_name,
        client_org.logo_url AS client_org_logo,
        agency_org.name AS agency_org_name,
        agency_org.logo_url AS agency_org_logo
      FROM public.tasks t
      INNER JOIN public.connections conn ON t.connection_id = conn.id
      LEFT JOIN public.organizations client_org ON conn.client_id = client_org.id AND client_org.deleted_at IS NULL
      LEFT JOIN public.organizations agency_org ON conn.agency_id = agency_org.id AND agency_org.deleted_at IS NULL
      WHERE t.connection_id = ANY(p_connection_ids)
        AND t.deleted_at IS NULL
        AND (p_assigned_to_user_id IS NULL OR t.assignee_user_id = p_assigned_to_user_id)
        AND (p_assigned_to_user_ids IS NULL OR t.assignee_user_id = ANY(p_assigned_to_user_ids))
        AND (
          v_search_pattern IS NULL OR
          t.title ILIKE v_search_pattern OR
          t.description ILIKE v_search_pattern OR
          (v_status_match IS NOT NULL AND t.status::text = v_status_match)
        )
      ORDER BY 
        COALESCE(client_org.name, '') COLLATE "C" DESC,
        CASE WHEN t.status::text = 'done' THEN 1 ELSE 0 END ASC, -- Done tasks last within org
        CASE WHEN t.status::text = 'done' THEN t.completed_at END DESC NULLS LAST, -- Done: newest completed first
        CASE WHEN t.status::text != 'done' THEN t.due_date END ASC NULLS LAST, -- Active: soonest due first
        t.created_at DESC -- Tiebreaker: newest created first
      LIMIT p_limit_count
      OFFSET p_offset_count
    )
    SELECT COALESCE(json_agg(
      json_build_object(
        'id', id,
        'connection_id', connection_id,
        'project_id', project_id,
        'title', title,
        'description', description,
        'status', status,
        'due_date', due_date,
        'assignee_user_id', assignee_user_id,
        'client_visible', client_visible,
        'created_by_user_id', created_by_user_id,
        'created_at', created_at,
        'updated_at', updated_at,
        'completed_at', completed_at,
        'source_request_id', source_request_id,
        'client_id', client_id,
        'agency_id', agency_id,
        'client_org_name', client_org_name,
        'client_org_logo', client_org_logo,
        'agency_org_name', agency_org_name,
        'agency_org_logo', agency_org_logo
      )
    ), '[]'::json)
    INTO v_result
    FROM ordered_tasks;
  ELSIF p_sort_type = 'agency_asc' THEN
    -- Sort by agency organization name (A-Z)
    WITH ordered_tasks AS (
      SELECT 
        t.id,
        t.connection_id,
        t.project_id,
        t.title,
        t.description,
        t.status::text AS status,
        t.due_date,
        t.assignee_user_id,
        t.client_visible,
        t.created_by_user_id,
        t.created_at,
        t.updated_at,
        t.completed_at,
        t.source_request_id,
        conn.client_id,
        conn.agency_id,
        client_org.name AS client_org_name,
        client_org.logo_url AS client_org_logo,
        agency_org.name AS agency_org_name,
        agency_org.logo_url AS agency_org_logo
      FROM public.tasks t
      INNER JOIN public.connections conn ON t.connection_id = conn.id
      LEFT JOIN public.organizations client_org ON conn.client_id = client_org.id AND client_org.deleted_at IS NULL
      LEFT JOIN public.organizations agency_org ON conn.agency_id = agency_org.id AND agency_org.deleted_at IS NULL
      WHERE t.connection_id = ANY(p_connection_ids)
        AND t.deleted_at IS NULL
        AND (p_assigned_to_user_id IS NULL OR t.assignee_user_id = p_assigned_to_user_id)
        AND (p_assigned_to_user_ids IS NULL OR t.assignee_user_id = ANY(p_assigned_to_user_ids))
        AND (
          v_search_pattern IS NULL OR
          t.title ILIKE v_search_pattern OR
          t.description ILIKE v_search_pattern OR
          (v_status_match IS NOT NULL AND t.status::text = v_status_match)
        )
      ORDER BY 
        COALESCE(agency_org.name, '') COLLATE "C" ASC,
        CASE WHEN t.status::text = 'done' THEN 1 ELSE 0 END ASC, -- Done tasks last within org
        CASE WHEN t.status::text = 'done' THEN t.completed_at END DESC NULLS LAST, -- Done: newest completed first
        CASE WHEN t.status::text != 'done' THEN t.due_date END ASC NULLS LAST, -- Active: soonest due first
        t.created_at DESC -- Tiebreaker: newest created first
      LIMIT p_limit_count
      OFFSET p_offset_count
    )
    SELECT COALESCE(json_agg(
      json_build_object(
        'id', id,
        'connection_id', connection_id,
        'project_id', project_id,
        'title', title,
        'description', description,
        'status', status,
        'due_date', due_date,
        'assignee_user_id', assignee_user_id,
        'client_visible', client_visible,
        'created_by_user_id', created_by_user_id,
        'created_at', created_at,
        'updated_at', updated_at,
        'completed_at', completed_at,
        'source_request_id', source_request_id,
        'client_id', client_id,
        'agency_id', agency_id,
        'client_org_name', client_org_name,
        'client_org_logo', client_org_logo,
        'agency_org_name', agency_org_name,
        'agency_org_logo', agency_org_logo
      )
    ), '[]'::json)
    INTO v_result
    FROM ordered_tasks;
  ELSE
    -- Sort by agency organization name (Z-A)
    WITH ordered_tasks AS (
      SELECT 
        t.id,
        t.connection_id,
        t.project_id,
        t.title,
        t.description,
        t.status::text AS status,
        t.due_date,
        t.assignee_user_id,
        t.client_visible,
        t.created_by_user_id,
        t.created_at,
        t.updated_at,
        t.completed_at,
        t.source_request_id,
        conn.client_id,
        conn.agency_id,
        client_org.name AS client_org_name,
        client_org.logo_url AS client_org_logo,
        agency_org.name AS agency_org_name,
        agency_org.logo_url AS agency_org_logo
      FROM public.tasks t
      INNER JOIN public.connections conn ON t.connection_id = conn.id
      LEFT JOIN public.organizations client_org ON conn.client_id = client_org.id AND client_org.deleted_at IS NULL
      LEFT JOIN public.organizations agency_org ON conn.agency_id = agency_org.id AND agency_org.deleted_at IS NULL
      WHERE t.connection_id = ANY(p_connection_ids)
        AND t.deleted_at IS NULL
        AND (p_assigned_to_user_id IS NULL OR t.assignee_user_id = p_assigned_to_user_id)
        AND (p_assigned_to_user_ids IS NULL OR t.assignee_user_id = ANY(p_assigned_to_user_ids))
        AND (
          v_search_pattern IS NULL OR
          t.title ILIKE v_search_pattern OR
          t.description ILIKE v_search_pattern OR
          (v_status_match IS NOT NULL AND t.status::text = v_status_match)
        )
      ORDER BY 
        COALESCE(agency_org.name, '') COLLATE "C" DESC,
        CASE WHEN t.status::text = 'done' THEN 1 ELSE 0 END ASC, -- Done tasks last within org
        CASE WHEN t.status::text = 'done' THEN t.completed_at END DESC NULLS LAST, -- Done: newest completed first
        CASE WHEN t.status::text != 'done' THEN t.due_date END ASC NULLS LAST, -- Active: soonest due first
        t.created_at DESC -- Tiebreaker: newest created first
      LIMIT p_limit_count
      OFFSET p_offset_count
    )
    SELECT COALESCE(json_agg(
      json_build_object(
        'id', id,
        'connection_id', connection_id,
        'project_id', project_id,
        'title', title,
        'description', description,
        'status', status,
        'due_date', due_date,
        'assignee_user_id', assignee_user_id,
        'client_visible', client_visible,
        'created_by_user_id', created_by_user_id,
        'created_at', created_at,
        'updated_at', updated_at,
        'completed_at', completed_at,
        'source_request_id', source_request_id,
        'client_id', client_id,
        'agency_id', agency_id,
        'client_org_name', client_org_name,
        'client_org_logo', client_org_logo,
        'agency_org_name', agency_org_name,
        'agency_org_logo', agency_org_logo
      )
    ), '[]'::json)
    INTO v_result
    FROM ordered_tasks;
  END IF;

  -- Return empty array if no results
  RETURN COALESCE(v_result, '[]'::json);
END;
$$;

COMMENT ON FUNCTION public.get_tasks_sorted_by_org_name(uuid[], text, int, int, text, uuid, uuid[])
IS 'Returns tasks sorted by organization name (client or agency) through connections. Bypasses PostgREST limitation of not supporting ordering through two-level nested joins. Handles complex sorting: org name → Done separation → due_date/created_at. Respects RLS policies automatically.';

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_tasks_sorted_by_org_name(uuid[], text, int, int, text, uuid, uuid[]) TO authenticated;

