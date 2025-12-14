-- ============================================================================
-- Migration: RPC function for tasks counts for a single connection
-- Date: 2025-12-18
-- Description: Returns status counts for a single connection WITHOUT fetching task rows.
--              Used for accurate header counts in connections tables to prevent flicker.
-- ============================================================================

CREATE OR REPLACE FUNCTION get_tasks_counts_for_connection(
  p_connection_id uuid,
  p_assigned_to_user_id uuid DEFAULT NULL,
  p_assigned_to_user_ids uuid[] DEFAULT NULL
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
          t.status,
          COUNT(*) as count
        FROM tasks t
        WHERE t.connection_id = p_connection_id
        AND t.deleted_at IS NULL
        AND (
          (p_assigned_to_user_id IS NULL AND p_assigned_to_user_ids IS NULL) OR
          (p_assigned_to_user_id IS NOT NULL AND t.assignee_user_id = p_assigned_to_user_id) OR
          (p_assigned_to_user_ids IS NOT NULL AND t.assignee_user_id = ANY(p_assigned_to_user_ids))
        )
        GROUP BY t.status
      ) status_counts
    )
  );
$$;

COMMENT ON FUNCTION get_tasks_counts_for_connection(uuid, uuid, uuid[])
IS 'Returns lightweight status counts for a single connection without fetching task rows. Used for accurate header counts in connections tables to prevent flicker.';
