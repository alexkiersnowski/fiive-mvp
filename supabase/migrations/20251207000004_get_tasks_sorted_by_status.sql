-- ============================================================================
-- Migration: RPC function for sorting tasks by status
-- Date: 2025-12-07
-- Description: Creates a PostgreSQL function to sort tasks by status, then
--              by created_at DESC. Handles pagination, search, and assignee filtering.
-- ============================================================================

-- Drop existing function if it exists (for idempotency)
DROP FUNCTION IF EXISTS public.get_tasks_sorted_by_status(
  uuid[],
  int,
  int,
  text,
  uuid,
  uuid[],
  uuid[],
  uuid[],
  uuid[]
);

-- Create RPC function for sorting tasks by status
CREATE OR REPLACE FUNCTION public.get_tasks_sorted_by_status(
  p_connection_ids uuid[],
  p_limit_count int,
  p_offset_count int,
  p_search_query text DEFAULT NULL,
  p_assigned_to_user_id uuid DEFAULT NULL,
  p_assigned_to_user_ids uuid[] DEFAULT NULL,
  p_matching_user_ids uuid[] DEFAULT NULL,
  p_matching_connection_ids uuid[] DEFAULT NULL,
  p_project_ids_matching_search uuid[] DEFAULT NULL
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

  -- Build and execute query
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
        -- If no search at all, include all tasks
        (v_search_pattern IS NULL 
         AND (p_matching_user_ids IS NULL OR array_length(p_matching_user_ids, 1) IS NULL OR array_length(p_matching_user_ids, 1) = 0)
         AND (p_matching_connection_ids IS NULL OR array_length(p_matching_connection_ids, 1) IS NULL OR array_length(p_matching_connection_ids, 1) = 0)
         AND (p_project_ids_matching_search IS NULL OR array_length(p_project_ids_matching_search, 1) IS NULL OR array_length(p_project_ids_matching_search, 1) = 0)
        ) OR
        -- Text search matches
        (v_search_pattern IS NOT NULL AND (
          t.title ILIKE v_search_pattern OR
          t.description ILIKE v_search_pattern OR
          (v_status_match IS NOT NULL AND t.status::text = v_status_match)
        )) OR
        -- Profile name matches
        (p_matching_user_ids IS NOT NULL AND array_length(p_matching_user_ids, 1) > 0 AND (
          t.created_by_user_id = ANY(p_matching_user_ids) OR
          t.assignee_user_id = ANY(p_matching_user_ids)
        )) OR
        -- Organization name matches
        (p_matching_connection_ids IS NOT NULL AND array_length(p_matching_connection_ids, 1) > 0 AND 
         t.connection_id = ANY(p_matching_connection_ids)
        ) OR
        -- Project name matches
        (p_project_ids_matching_search IS NOT NULL AND array_length(p_project_ids_matching_search, 1) > 0 AND 
         t.project_id = ANY(p_project_ids_matching_search)
        )
      )
    ORDER BY 
      t.status ASC,
      t.created_at DESC
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

  -- Return empty array if no results
  RETURN COALESCE(v_result, '[]'::json);
END;
$$;

COMMENT ON FUNCTION public.get_tasks_sorted_by_status(uuid[], int, int, text, uuid, uuid[], uuid[], uuid[], uuid[])
IS 'Returns tasks sorted by status ASC, then created_at DESC. Handles pagination, search, and assignee filtering. Supports search by title/description/status, profile names, organization names, and project names. Respects RLS policies automatically.';

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_tasks_sorted_by_status(uuid[], int, int, text, uuid, uuid[], uuid[], uuid[], uuid[]) TO authenticated;

