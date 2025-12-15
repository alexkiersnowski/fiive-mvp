-- ============================================================================
-- Migration: Indexes for optimizing connection overview page performance
-- Date: 2025-12-06
-- Description: Creates indexes to optimize comment queries and project count queries
--              for the connection overview page
-- ============================================================================

-- ============================================================================
-- COMMENT TABLE INDEXES
-- ============================================================================

-- Index for request_comments queries: fetch comments by request_id
-- Optimizes queries: WHERE request_id IN (...) AND deleted_at IS NULL
-- Used by: getCommentsForRequests
CREATE INDEX IF NOT EXISTS idx_request_comments_request_id_deleted 
  ON public.request_comments(request_id, deleted_at) 
  WHERE deleted_at IS NULL;

-- Index for task_comments queries: fetch comments by task_id
-- Optimizes queries: WHERE task_id IN (...) AND deleted_at IS NULL
-- Used by: getCommentsForTasks
CREATE INDEX IF NOT EXISTS idx_task_comments_task_id_deleted 
  ON public.task_comments(task_id, deleted_at) 
  WHERE deleted_at IS NULL;

-- ============================================================================
-- PROJECT COUNT QUERY INDEXES
-- ============================================================================

-- Index for requests count queries by project
-- Optimizes queries: WHERE project_id IN (...) AND connection_id = ? AND deleted_at IS NULL
-- Used by: getProjectsForConnection (count queries)
CREATE INDEX IF NOT EXISTS idx_requests_project_connection 
  ON public.requests(project_id, connection_id) 
  WHERE deleted_at IS NULL AND project_id IS NOT NULL;

-- Index for tasks count queries by project
-- Optimizes queries: WHERE project_id IN (...) AND connection_id = ? AND deleted_at IS NULL
-- Used by: getProjectsForConnection (count queries)
CREATE INDEX IF NOT EXISTS idx_tasks_project_connection 
  ON public.tasks(project_id, connection_id) 
  WHERE deleted_at IS NULL AND project_id IS NOT NULL;

-- ============================================================================
-- VERIFICATION NOTES
-- ============================================================================
-- Existing indexes that complement these new ones:
-- - idx_requests_connection_not_deleted (from 20251113_requests_tasks_search_indexes.sql)
-- - idx_tasks_connection_not_deleted (from 20251113_requests_tasks_search_indexes.sql)
-- - idx_projects_connection_not_deleted (from 20251113_requests_tasks_search_indexes.sql)
-- 
-- These new indexes will improve:
-- 1. Comment fetching performance (faster lookups by request_id/task_id)
-- 2. Project count queries (faster aggregation for requests/tasks counts per project)
-- 
-- Expected performance improvement: 20-40% reduction in query time for overview page

