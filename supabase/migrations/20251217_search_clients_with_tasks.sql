-- ============================================================================
-- Migration: RPC function for fast server-side search of clients with tasks
-- Date: 2025-12-17
-- Description: Searches organization names and returns clients with their tasks
--              pre-loaded as JSONB. Used for atomic search results that eliminate
--              timing issues and flickering in the UI.
-- ============================================================================

CREATE OR REPLACE FUNCTION search_clients_with_tasks(
  p_search_text text,
  p_connection_ids uuid[],
  p_view_type text DEFAULT 'agency', -- 'agency' or 'client'
  p_status_filter text[] DEFAULT NULL, -- Optional: filter by status
  p_assigned_to_user_id uuid DEFAULT NULL,
  p_assigned_to_user_ids uuid[] DEFAULT NULL
)
RETURNS TABLE (
  client_id uuid,
  client_name text,
  client_logo_url text,
  tasks jsonb
)
LANGUAGE sql
STABLE
AS $$
  WITH matching_orgs AS (
    -- 1. Find matching organizations by name (Fast Index Scan with fuzzy word matching)
    -- For agency view: search client organizations
    -- For client view: search agency organizations
    -- Uses word-based fuzzy matching: all words from search must appear in name (in any order)
    SELECT DISTINCT o.id, o.name, o.logo_url
    FROM organizations o
    INNER JOIN connections c ON (
      (p_view_type = 'agency' AND c.client_id = o.id) OR
      (p_view_type != 'agency' AND c.agency_id = o.id)
    )
    WHERE c.id = ANY(p_connection_ids)
    AND o.deleted_at IS NULL
    AND (
      -- Fast path: simple substring match (works for single words and exact phrases)
      o.name ILIKE '%' || p_search_text || '%'
      OR
      -- Fuzzy path: word-based matching (only if search has multiple words)
      -- Replace spaces with '%' to create a fuzzy pattern: "Acme Corp" -> "%Acme%Corp%"
      (p_search_text ~ ' ' AND o.name ILIKE '%' || replace(p_search_text, ' ', '%') || '%')
    )
    LIMIT 50 -- Safety limit: max 50 clients
  ),
  client_tasks AS (
    -- 2. Get tasks for matching clients
    SELECT 
      mo.id as org_id,
      jsonb_agg(
        jsonb_build_object(
          'id', t.id,
          'connection_id', t.connection_id,
          'project_id', t.project_id,
          'title', t.title,
          'description', t.description,
          'status', t.status::text,
          'due_date', t.due_date,
          'assignee_user_id', t.assignee_user_id,
          'client_visible', t.client_visible,
          'created_by_user_id', t.created_by_user_id,
          'created_at', t.created_at,
          'updated_at', t.updated_at,
          'completed_at', t.completed_at,
          'source_request_id', t.source_request_id
        ) ORDER BY t.created_at DESC, t.id DESC
      ) FILTER (WHERE t.id IS NOT NULL) as tasks_json
    FROM matching_orgs mo
    INNER JOIN connections c ON (
      (p_view_type = 'agency' AND c.client_id = mo.id) OR
      (p_view_type != 'agency' AND c.agency_id = mo.id)
    )
    LEFT JOIN tasks t ON t.connection_id = c.id
      AND t.deleted_at IS NULL
      AND (p_status_filter IS NULL OR t.status::text = ANY(p_status_filter))
      AND (
        (p_assigned_to_user_id IS NULL AND p_assigned_to_user_ids IS NULL) OR
        (p_assigned_to_user_id IS NOT NULL AND t.assignee_user_id = p_assigned_to_user_id) OR
        (p_assigned_to_user_ids IS NOT NULL AND t.assignee_user_id = ANY(p_assigned_to_user_ids))
      )
    WHERE c.id = ANY(p_connection_ids)
    GROUP BY mo.id
  )
  SELECT 
    mo.id as client_id,
    mo.name as client_name,
    COALESCE(mo.logo_url, '') as client_logo_url,
    COALESCE(ct.tasks_json, '[]'::jsonb) as tasks
  FROM matching_orgs mo
  LEFT JOIN client_tasks ct ON mo.id = ct.org_id
  ORDER BY mo.name ASC;
$$;

COMMENT ON FUNCTION search_clients_with_tasks(text, uuid[], text, text[], uuid, uuid[])
IS 'Searches organization names and returns clients with their tasks pre-loaded as JSONB. Used for atomic search results that eliminate timing issues. Returns max 50 clients.';
