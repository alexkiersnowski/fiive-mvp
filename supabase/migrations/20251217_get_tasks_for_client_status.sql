-- ============================================================================
-- Migration: RPC function for fetching tasks for a specific client in a status
-- Date: 2025-12-17
-- Description: Returns all tasks for a specific client organization in a specific status.
--              Used for accordion fetch-on-expand pattern. No pagination needed.
--              ORDER BY created_at DESC, id DESC.
-- ============================================================================

CREATE OR REPLACE FUNCTION get_tasks_for_client_status(
  p_connection_ids uuid[],
  p_client_org_id uuid, -- The organization ID (client_id for agency view, agency_id for client view)
  p_status text,
  p_assigned_to_user_id uuid DEFAULT NULL,
  p_assigned_to_user_ids uuid[] DEFAULT NULL,
  p_view_type text DEFAULT 'agency'
)
RETURNS SETOF tasks
LANGUAGE sql
STABLE
AS $$
  SELECT t.*
  FROM tasks t
  INNER JOIN connections c ON t.connection_id = c.id
  WHERE t.connection_id = ANY(p_connection_ids)
  AND (
    (p_view_type = 'agency' AND c.client_id = p_client_org_id) OR
    (p_view_type != 'agency' AND c.agency_id = p_client_org_id)
  )
  AND t.status::text = p_status
  AND t.deleted_at IS NULL
  AND (
    (p_assigned_to_user_id IS NULL AND p_assigned_to_user_ids IS NULL) OR
    (p_assigned_to_user_id IS NOT NULL AND t.assignee_user_id = p_assigned_to_user_id) OR
    (p_assigned_to_user_ids IS NOT NULL AND t.assignee_user_id = ANY(p_assigned_to_user_ids))
  )
  ORDER BY t.created_at DESC, t.id DESC;
$$;

COMMENT ON FUNCTION get_tasks_for_client_status(uuid[], uuid, text, uuid, uuid[], text)
IS 'Returns all tasks for a specific client organization in a specific status. Used for accordion fetch-on-expand pattern. No pagination - fetches all tasks for the client.';
