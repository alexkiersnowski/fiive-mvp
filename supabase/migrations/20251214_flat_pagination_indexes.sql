-- ============================================================================
-- Migration: Indexes for flat pagination queries
-- Date: 2025-12-14
-- Description: Adds indexes to optimize get_requests_flat_ordered RPC performance.
--              Indexes match the ORDER BY clause: status, display_name (LOWER), created_at DESC, id DESC
-- ============================================================================

-- Index for requests flat ordered query
-- Matches ORDER BY: r.status, LOWER(display_org.name) ASC, r.created_at DESC, r.id DESC
-- Also covers WHERE clauses: connection_id, deleted_at, status, assignee_user_id, created_by_user_id
CREATE INDEX IF NOT EXISTS idx_requests_status_connection_created_id 
ON requests (status, connection_id, created_at DESC, id DESC)
WHERE deleted_at IS NULL;

-- Index for organizations name sorting (used in JOIN for display name)
-- Matches ORDER BY: LOWER(COALESCE(display_org.name, 'Unknown')) ASC
CREATE INDEX IF NOT EXISTS idx_organizations_name_lower 
ON organizations (LOWER(COALESCE(name, 'Unknown')));

-- Additional index for connection_id filtering (if not already exists)
-- This helps with the excluded_connection_ids filter
CREATE INDEX IF NOT EXISTS idx_requests_connection_id_status 
ON requests (connection_id, status)
WHERE deleted_at IS NULL;

COMMENT ON INDEX idx_requests_status_connection_created_id IS 'Optimizes flat pagination query: ORDER BY status, display_name, created_at DESC, id DESC';
COMMENT ON INDEX idx_organizations_name_lower IS 'Optimizes display name sorting in flat pagination';
COMMENT ON INDEX idx_requests_connection_id_status IS 'Optimizes connection_id filtering and excluded_connection_ids filter';
