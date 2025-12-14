-- ============================================================================
-- Migration: Database indexes for connections-specific requests and tasks queries
-- Date: 2025-12-18
-- Description: Creates indexes to optimize queries for connections tables.
--              These indexes support:
--              - Status-based filtering by connection
--              - Assignee filtering
--              - Search queries
--              - Sorting by created_at DESC
-- ============================================================================

-- Indexes for requests table (connection-specific queries)
-- Supports: get_requests_for_connection_status, get_requests_counts_for_connection
CREATE INDEX IF NOT EXISTS idx_requests_connection_status_created_at 
ON requests(connection_id, status, created_at DESC, id DESC)
WHERE deleted_at IS NULL;

-- Index for assignee filtering on requests
CREATE INDEX IF NOT EXISTS idx_requests_connection_assignee_status 
ON requests(connection_id, assignee_user_id, status)
WHERE deleted_at IS NULL;

-- Index for search on requests (using pg_trgm for ILIKE queries)
-- Note: Requires pg_trgm extension (should already be enabled)
CREATE INDEX IF NOT EXISTS idx_requests_connection_title_trgm 
ON requests USING gin(title gin_trgm_ops)
WHERE deleted_at IS NULL AND connection_id IS NOT NULL;

-- Indexes for tasks table (connection-specific queries)
-- Supports: get_tasks_for_connection_status, get_tasks_counts_for_connection
CREATE INDEX IF NOT EXISTS idx_tasks_connection_status_created_at 
ON tasks(connection_id, status, created_at DESC, id DESC)
WHERE deleted_at IS NULL;

-- Index for assignee filtering on tasks
CREATE INDEX IF NOT EXISTS idx_tasks_connection_assignee_status 
ON tasks(connection_id, assignee_user_id, status)
WHERE deleted_at IS NULL;

-- Index for search on tasks (using pg_trgm for ILIKE queries)
CREATE INDEX IF NOT EXISTS idx_tasks_connection_title_trgm 
ON tasks USING gin(title gin_trgm_ops)
WHERE deleted_at IS NULL AND connection_id IS NOT NULL;

COMMENT ON INDEX idx_requests_connection_status_created_at IS 'Optimizes status-based queries for requests in a connection, ordered by created_at DESC';
COMMENT ON INDEX idx_requests_connection_assignee_status IS 'Optimizes assignee filtering for requests in a connection';
COMMENT ON INDEX idx_requests_connection_title_trgm IS 'Optimizes title search queries for requests in a connection using trigram matching';
COMMENT ON INDEX idx_tasks_connection_status_created_at IS 'Optimizes status-based queries for tasks in a connection, ordered by created_at DESC';
COMMENT ON INDEX idx_tasks_connection_assignee_status IS 'Optimizes assignee filtering for tasks in a connection';
COMMENT ON INDEX idx_tasks_connection_title_trgm IS 'Optimizes title search queries for tasks in a connection using trigram matching';
