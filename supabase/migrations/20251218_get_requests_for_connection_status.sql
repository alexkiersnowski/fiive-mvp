-- ============================================================================
-- Migration: RPC function for fetching requests for a connection by status
-- Date: 2025-12-18
-- Description: Returns paginated requests for a single connection in a specific status.
--              Used for connections tables with virtual scrolling and pagination.
--              ORDER BY created_at DESC, id DESC.
-- ============================================================================

CREATE OR REPLACE FUNCTION get_requests_for_connection_status(
  p_connection_id uuid,
  p_status text,
  p_limit integer DEFAULT 100,
  p_offset integer DEFAULT 0,
  p_assigned_to_user_id uuid DEFAULT NULL,
  p_created_by_user_id uuid DEFAULT NULL,
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
  created_by_org_id uuid
)
LANGUAGE sql
STABLE
AS $$
  SELECT 
    r.id,
    r.connection_id,
    r.title,
    r.description,
    r.status,
    r.assignee_user_id,
    r.created_by_user_id,
    r.created_at,
    r.updated_at,
    r.deleted_at,
    r.project_id,
    r.created_by_org_id
  FROM requests r
  WHERE r.connection_id = p_connection_id
  AND r.status::text = p_status
  AND r.deleted_at IS NULL
  AND (p_assigned_to_user_id IS NULL OR r.assignee_user_id = p_assigned_to_user_id)
  AND (p_created_by_user_id IS NULL OR r.created_by_user_id = p_created_by_user_id)
  AND (p_search_query IS NULL OR r.title ILIKE '%' || p_search_query || '%')
  ORDER BY r.created_at DESC, r.id DESC
  LIMIT p_limit
  OFFSET p_offset;
$$;

COMMENT ON FUNCTION get_requests_for_connection_status(uuid, text, integer, integer, uuid, uuid, text)
IS 'Returns paginated requests for a single connection in a specific status. Used for connections tables with virtual scrolling and pagination.';
