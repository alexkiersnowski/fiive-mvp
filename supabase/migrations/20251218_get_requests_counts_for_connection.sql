-- ============================================================================
-- Migration: RPC function for requests counts for a single connection
-- Date: 2025-12-18
-- Description: Returns status counts for a single connection WITHOUT fetching request rows.
--              Used for accurate header counts in connections tables to prevent flicker.
-- ============================================================================

CREATE OR REPLACE FUNCTION get_requests_counts_for_connection(
  p_connection_id uuid,
  p_assigned_to_user_id uuid DEFAULT NULL,
  p_created_by_user_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE sql
STABLE
AS $$
  SELECT json_build_object(
    'status_counts', (
      SELECT json_object_agg(status::text, count)
      FROM (
        SELECT 
          r.status,
          COUNT(*) as count
        FROM requests r
        WHERE r.connection_id = p_connection_id
        AND r.deleted_at IS NULL
        AND (p_assigned_to_user_id IS NULL OR r.assignee_user_id = p_assigned_to_user_id)
        AND (p_created_by_user_id IS NULL OR r.created_by_user_id = p_created_by_user_id)
        GROUP BY r.status
      ) status_counts
    )
  );
$$;

COMMENT ON FUNCTION get_requests_counts_for_connection(uuid, uuid, uuid)
IS 'Returns lightweight status counts for a single connection without fetching request rows. Used for accurate header counts in connections tables to prevent flicker.';
