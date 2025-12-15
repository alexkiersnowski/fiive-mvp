-- ============================================================================
-- Migration: Index for optimizing newCount query pattern
-- Date: 2025-12-06
-- Description: Creates composite index to optimize newCount queries
--              (connection_id + status='new' + deleted_at IS NULL)
-- ============================================================================

-- Index for newCount query: count requests with status='new' for a connection
-- Optimizes queries: WHERE connection_id = ? AND status = 'new' AND deleted_at IS NULL
-- Used by: getRequestsForConnection (newCount query)
CREATE INDEX IF NOT EXISTS idx_requests_connection_status_new 
  ON public.requests(connection_id, status) 
  WHERE deleted_at IS NULL AND status = 'new';

-- ============================================================================
-- VERIFICATION NOTES
-- ============================================================================
-- This index complements existing indexes:
-- - idx_requests_connection_not_deleted (from 20251113_requests_tasks_search_indexes.sql)
-- - idx_requests_status (from 20251113_requests_tasks_search_indexes.sql)
-- - idx_requests_connection_status_created (from 20251113_requests_tasks_search_indexes.sql)
-- 
-- This partial index is more efficient for the specific newCount query pattern
-- because it only indexes rows where status = 'new', making the count query faster.
-- 
-- Expected performance improvement: 10-20ms reduction in newCount query time.

