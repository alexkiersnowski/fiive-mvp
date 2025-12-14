-- ============================================================================
-- Migration: RPC function for fetching requests for a specific client in a status
-- Date: 2025-12-15
-- Description: Returns all requests for a specific client organization in a specific status.
--              Used for accordion fetch-on-expand pattern. No pagination needed.
--              ORDER BY created_at DESC, id DESC.
-- ============================================================================

CREATE OR REPLACE FUNCTION get_requests_for_client_status(
  p_connection_ids uuid[],
  p_client_org_id uuid, -- The organization ID (client_id for agency view, agency_id for client view)
  p_status text,
  p_assigned_to_user_id uuid DEFAULT NULL,
  p_created_by_user_id uuid DEFAULT NULL,
  p_view_type text DEFAULT 'agency'
)
RETURNS SETOF requests
LANGUAGE sql
STABLE
AS $$
  SELECT r.*
  FROM requests r
  INNER JOIN connections c ON r.connection_id = c.id
  WHERE r.connection_id = ANY(p_connection_ids)
  AND (
    (p_view_type = 'agency' AND c.client_id = p_client_org_id) OR
    (p_view_type != 'agency' AND c.agency_id = p_client_org_id)
  )
  AND r.status::text = p_status
  AND r.deleted_at IS NULL
  AND (p_assigned_to_user_id IS NULL OR r.assignee_user_id = p_assigned_to_user_id)
  AND (p_created_by_user_id IS NULL OR r.created_by_user_id = p_created_by_user_id)
  ORDER BY r.created_at DESC, r.id DESC;
$$;

COMMENT ON FUNCTION get_requests_for_client_status(uuid[], uuid, text, uuid, uuid, text)
IS 'Returns all requests for a specific client organization in a specific status. Used for accordion fetch-on-expand pattern. No pagination - fetches all requests for the client.';
