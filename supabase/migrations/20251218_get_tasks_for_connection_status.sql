-- ============================================================================
-- Migration: RPC function for fetching tasks for a connection by status
-- Date: 2025-12-18
-- Description: Returns paginated tasks for a single connection in a specific status.
--              Used for connections tables with virtual scrolling and pagination.
--              ORDER BY created_at DESC, id DESC.
-- ============================================================================

CREATE OR REPLACE FUNCTION get_tasks_for_connection_status(
  p_connection_id uuid,
  p_status text,
  p_limit integer DEFAULT 100,
  p_offset integer DEFAULT 0,
  p_assigned_to_user_id uuid DEFAULT NULL,
  p_assigned_to_user_ids uuid[] DEFAULT NULL,
  p_search_query text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  connection_id uuid,
  title text,
  description text,
  status text,
  assignee_user_id uuid,
  created_by_user_id uuid,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  deleted_at timestamp with time zone,
  project_id uuid,
  due_date date,
  client_visible boolean,
  completed_at timestamp with time zone
)
LANGUAGE sql
STABLE
AS $$
  SELECT 
    t.id,
    t.connection_id,
    t.title,
    t.description,
    t.status,
    t.assignee_user_id,
    t.created_by_user_id,
    t.created_at,
    t.updated_at,
    t.deleted_at,
    t.project_id,
    t.due_date,
    t.client_visible,
    t.completed_at
  FROM tasks t
  WHERE t.connection_id = p_connection_id
  AND t.status::text = p_status
  AND t.deleted_at IS NULL
  AND (
    (p_assigned_to_user_id IS NULL AND p_assigned_to_user_ids IS NULL) OR
    (p_assigned_to_user_id IS NOT NULL AND t.assignee_user_id = p_assigned_to_user_id) OR
    (p_assigned_to_user_ids IS NOT NULL AND t.assignee_user_id = ANY(p_assigned_to_user_ids))
  )
  AND (p_search_query IS NULL OR t.title ILIKE '%' || p_search_query || '%')
  ORDER BY t.created_at DESC, t.id DESC
  LIMIT p_limit
  OFFSET p_offset;
$$;

COMMENT ON FUNCTION get_tasks_for_connection_status(uuid, text, integer, integer, uuid, uuid[], text)
IS 'Returns paginated tasks for a single connection in a specific status. Used for connections tables with virtual scrolling and pagination.';
