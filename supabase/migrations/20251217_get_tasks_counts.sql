-- ============================================================================
-- Migration: RPC function for tasks counts (minimal metadata)
-- Date: 2025-12-17
-- Description: Returns status counts and connection counts WITHOUT fetching task rows.
--              Used for accurate header counts in MVP accordion pattern.
-- ============================================================================

CREATE OR REPLACE FUNCTION get_tasks_counts(
  p_connection_ids uuid[],
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
        WHERE t.connection_id = ANY(p_connection_ids)
        AND t.deleted_at IS NULL
        AND (
          (p_assigned_to_user_id IS NULL AND p_assigned_to_user_ids IS NULL) OR
          (p_assigned_to_user_id IS NOT NULL AND t.assignee_user_id = p_assigned_to_user_id) OR
          (p_assigned_to_user_ids IS NOT NULL AND t.assignee_user_id = ANY(p_assigned_to_user_ids))
        )
        GROUP BY t.status
      ) status_counts
    ),
    'client_counts', (
      -- Return counts keyed by `${status}-${orgId}` for accordion headers
      -- We need separate counts for agency view (client_id) and client view (agency_id)
      -- Since we can't determine view_type in SQL, return both and frontend will use the right one
      -- Use jsonb_build_object to combine both views
      SELECT jsonb_build_object(
        'agency', (
          SELECT json_object_agg(key, count)
          FROM (
            SELECT 
              t.status::text || '-' || c.client_id::text as key,
              COUNT(*) as count
            FROM tasks t
            INNER JOIN connections c ON t.connection_id = c.id
            WHERE t.connection_id = ANY(p_connection_ids)
            AND t.deleted_at IS NULL
            AND (
              (p_assigned_to_user_id IS NULL AND p_assigned_to_user_ids IS NULL) OR
              (p_assigned_to_user_id IS NOT NULL AND t.assignee_user_id = p_assigned_to_user_id) OR
              (p_assigned_to_user_ids IS NOT NULL AND t.assignee_user_id = ANY(p_assigned_to_user_ids))
            )
            GROUP BY t.status, c.client_id
          ) agency_counts
        ),
        'client', (
          SELECT json_object_agg(key, count)
          FROM (
            SELECT 
              t.status::text || '-' || c.agency_id::text as key,
              COUNT(*) as count
            FROM tasks t
            INNER JOIN connections c ON t.connection_id = c.id
            WHERE t.connection_id = ANY(p_connection_ids)
            AND t.deleted_at IS NULL
            AND (
              (p_assigned_to_user_id IS NULL AND p_assigned_to_user_ids IS NULL) OR
              (p_assigned_to_user_id IS NOT NULL AND t.assignee_user_id = p_assigned_to_user_id) OR
              (p_assigned_to_user_ids IS NOT NULL AND t.assignee_user_id = ANY(p_assigned_to_user_ids))
            )
            GROUP BY t.status, c.agency_id
          ) client_counts
        )
      )::json
    )
  );
$$;

COMMENT ON FUNCTION get_tasks_counts(uuid[], uuid, uuid[])
IS 'Returns lightweight metadata (status counts and connection counts) without fetching task rows. Used for accurate header counts in MVP accordion pattern.';
