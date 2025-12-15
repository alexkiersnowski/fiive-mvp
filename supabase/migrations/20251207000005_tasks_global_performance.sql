-- ============================================================================
-- Migration: Indexes for optimizing global tasks queries
-- Date: 2025-12-07
-- Description: Creates composite indexes to optimize global tasks queries
--              that use connection_id IN (...) pattern. These indexes support
--              RPC functions and regular queries for sorting, filtering, and counting.
-- ============================================================================

-- ============================================================================
-- TASKS TABLE INDEXES FOR GLOBAL QUERIES
-- ============================================================================

-- Base filter index for connection_id IN (...) pattern
-- Optimizes queries: WHERE connection_id IN (...) AND deleted_at IS NULL
-- Used by: getTasksSnapshot (unfiltered count), all RPC functions
CREATE INDEX IF NOT EXISTS idx_tasks_connection_ids_deleted 
  ON public.tasks(connection_id, deleted_at) 
  WHERE deleted_at IS NULL;

-- Index for assignee filtering with multiple connections
-- Optimizes queries: WHERE connection_id IN (...) AND assignee_user_id = ? AND deleted_at IS NULL
-- Used by: getTasksSnapshot with assignedToUserId filter, RPC functions with assignee filter
CREATE INDEX IF NOT EXISTS idx_tasks_connection_ids_assignee 
  ON public.tasks(connection_id, assignee_user_id, deleted_at) 
  WHERE deleted_at IS NULL AND assignee_user_id IS NOT NULL;

-- Index for assignee filtering with multiple user IDs (array)
-- Optimizes queries: WHERE connection_id IN (...) AND assignee_user_id = ANY(...) AND deleted_at IS NULL
-- Used by: getTasksSnapshot with assignedToUserIds filter (client team members)
CREATE INDEX IF NOT EXISTS idx_tasks_connection_ids_assignee_array 
  ON public.tasks(connection_id, assignee_user_id, deleted_at) 
  WHERE deleted_at IS NULL;

-- Index for status sorting with multiple connections
-- Optimizes queries: WHERE connection_id IN (...) AND deleted_at IS NULL ORDER BY status, created_at DESC
-- Used by: get_tasks_sorted_by_status RPC function
CREATE INDEX IF NOT EXISTS idx_tasks_connection_ids_status_created 
  ON public.tasks(connection_id, status, created_at DESC, deleted_at) 
  WHERE deleted_at IS NULL;

-- Index for due_date sorting with multiple connections
-- Optimizes queries: WHERE connection_id IN (...) AND deleted_at IS NULL ORDER BY due_date ASC NULLS LAST, created_at DESC
-- Used by: get_tasks_sorted_by_due_date RPC function (non-Done tasks)
CREATE INDEX IF NOT EXISTS idx_tasks_connection_ids_due_created 
  ON public.tasks(connection_id, due_date ASC NULLS LAST, created_at DESC, deleted_at) 
  WHERE deleted_at IS NULL AND status != 'done';

-- Index for completed_at sorting (Done tasks)
-- Optimizes queries: WHERE connection_id IN (...) AND status = 'done' AND deleted_at IS NULL ORDER BY completed_at DESC
-- Used by: get_tasks_sorted_by_due_date RPC function (Done tasks)
CREATE INDEX IF NOT EXISTS idx_tasks_connection_ids_completed_created 
  ON public.tasks(connection_id, completed_at DESC NULLS LAST, created_at DESC, deleted_at) 
  WHERE deleted_at IS NULL AND status = 'done';

-- Index for count queries (minimal columns)
-- Optimizes queries: SELECT COUNT(*) WHERE connection_id IN (...) AND deleted_at IS NULL
-- Used by: getTasksSnapshot unfiltered count
CREATE INDEX IF NOT EXISTS idx_tasks_connection_ids_count 
  ON public.tasks(connection_id, deleted_at) 
  WHERE deleted_at IS NULL;

-- ============================================================================
-- VERIFICATION NOTES
-- ============================================================================
-- Existing indexes that complement these new ones:
-- - idx_tasks_connection_not_deleted (from 20251113_requests_tasks_search_indexes.sql)
--   - Single connection_id lookups (connection-specific views)
-- - idx_tasks_title_trgm (from 20251113_requests_tasks_search_indexes.sql)
--   - Text search on title
-- - idx_tasks_description_trgm (from 20251113_requests_tasks_search_indexes.sql)
--   - Text search on description
-- - idx_tasks_assignee_user_id (from 20251113_requests_tasks_search_indexes.sql)
--   - Profile name searches
-- 
-- Query patterns these indexes optimize:
-- 1. Base filtering: WHERE connection_id = ANY(...) AND deleted_at IS NULL
-- 2. Assignee filtering: WHERE connection_id = ANY(...) AND assignee_user_id = ? AND deleted_at IS NULL
-- 3. Status sorting: WHERE connection_id = ANY(...) ORDER BY status, created_at DESC
-- 4. Due date sorting: WHERE connection_id = ANY(...) ORDER BY due_date ASC NULLS LAST, created_at DESC
-- 5. Count queries: SELECT COUNT(*) WHERE connection_id = ANY(...) AND deleted_at IS NULL
--
-- Expected performance improvement:
-- - Index scans instead of full-table scans for global tasks queries
-- - Faster RPC function execution (get_tasks_sorted_by_due_date, get_tasks_sorted_by_status)
-- - Faster count queries for pagination
-- - Enables efficient database-level sorting with pagination

