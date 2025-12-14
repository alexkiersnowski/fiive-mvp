-- ============================================================================
-- Migration: RPC function for fast server-side search of clients with requests
-- Date: 2025-12-14
-- Description: Searches organization names and returns clients with their requests
--              pre-loaded as JSONB. Used for atomic search results that eliminate
--              timing issues and flickering in the UI.
-- ============================================================================

CREATE OR REPLACE FUNCTION search_clients_with_requests(
  p_search_text text,
  p_connection_ids uuid[],
  p_view_type text DEFAULT 'agency', -- 'agency' or 'client'
  p_status_filter text[] DEFAULT NULL, -- Optional: filter by status
  p_assigned_to_user_id uuid DEFAULT NULL,
  p_created_by_user_id uuid DEFAULT NULL
)
RETURNS TABLE (
  client_id uuid,
  client_name text,
  client_logo_url text,
  requests jsonb
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
  client_requests AS (
    -- 2. Get requests for matching clients
    SELECT 
      mo.id as org_id,
      jsonb_agg(
        jsonb_build_object(
          'id', r.id,
          'title', r.title,
          'description', r.description,
          'status', r.status::text,
          'project_id', r.project_id,
          'project_name_cached', r.project_name_cached,
          'connection_id', r.connection_id,
          'created_by_user_id', r.created_by_user_id,
          'assignee_user_id', r.assignee_user_id,
          'created_at', r.created_at,
          'created_by_org_id', r.created_by_org_id
        ) ORDER BY r.created_at DESC, r.id DESC
      ) FILTER (WHERE r.id IS NOT NULL) as requests_json
    FROM matching_orgs mo
    INNER JOIN connections c ON (
      (p_view_type = 'agency' AND c.client_id = mo.id) OR
      (p_view_type != 'agency' AND c.agency_id = mo.id)
    )
    LEFT JOIN requests r ON r.connection_id = c.id
      AND r.deleted_at IS NULL
      AND (p_status_filter IS NULL OR r.status::text = ANY(p_status_filter))
      AND (p_assigned_to_user_id IS NULL OR r.assignee_user_id = p_assigned_to_user_id)
      AND (p_created_by_user_id IS NULL OR r.created_by_user_id = p_created_by_user_id)
    WHERE c.id = ANY(p_connection_ids)
    GROUP BY mo.id
  )
  SELECT 
    mo.id as client_id,
    mo.name as client_name,
    COALESCE(mo.logo_url, '') as client_logo_url,
    COALESCE(cr.requests_json, '[]'::jsonb) as requests
  FROM matching_orgs mo
  LEFT JOIN client_requests cr ON mo.id = cr.org_id
  ORDER BY mo.name ASC;
$$;

COMMENT ON FUNCTION search_clients_with_requests(text, uuid[], text, text[], uuid, uuid)
IS 'Searches organization names and returns clients with their requests pre-loaded as JSONB. Used for atomic search results that eliminate timing issues. Returns max 50 clients.';
