-- ============================================================================
-- Migration: RPC function for requests counts (minimal metadata)
-- Date: 2025-12-15
-- Description: Returns status counts and connection counts WITHOUT fetching request rows.
--              Used for accurate header counts in MVP flat pagination.
-- ============================================================================

CREATE OR REPLACE FUNCTION get_requests_counts(
  p_connection_ids uuid[],
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
        WHERE r.connection_id = ANY(p_connection_ids)
        AND r.deleted_at IS NULL
        AND (p_assigned_to_user_id IS NULL OR r.assignee_user_id = p_assigned_to_user_id)
        AND (p_created_by_user_id IS NULL OR r.created_by_user_id = p_created_by_user_id)
        GROUP BY r.status
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
              r.status::text || '-' || c.client_id::text as key,
              COUNT(*) as count
            FROM requests r
            INNER JOIN connections c ON r.connection_id = c.id
            WHERE r.connection_id = ANY(p_connection_ids)
            AND r.deleted_at IS NULL
            AND (p_assigned_to_user_id IS NULL OR r.assignee_user_id = p_assigned_to_user_id)
            AND (p_created_by_user_id IS NULL OR r.created_by_user_id = p_created_by_user_id)
            GROUP BY r.status, c.client_id
          ) agency_counts
        ),
        'client', (
          SELECT json_object_agg(key, count)
          FROM (
            SELECT 
              r.status::text || '-' || c.agency_id::text as key,
              COUNT(*) as count
            FROM requests r
            INNER JOIN connections c ON r.connection_id = c.id
            WHERE r.connection_id = ANY(p_connection_ids)
            AND r.deleted_at IS NULL
            AND (p_assigned_to_user_id IS NULL OR r.assignee_user_id = p_assigned_to_user_id)
            AND (p_created_by_user_id IS NULL OR r.created_by_user_id = p_created_by_user_id)
            GROUP BY r.status, c.agency_id
          ) client_counts
        )
      )::json
    )
  );
$$;

COMMENT ON FUNCTION get_requests_counts(uuid[], uuid, uuid)
IS 'Returns lightweight metadata (status counts and connection counts) without fetching request rows. Used for accurate header counts in MVP flat pagination.';
