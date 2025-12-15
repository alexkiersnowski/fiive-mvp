-- ============================================================================
-- Migration: Indexes for optimizing global requests page performance
-- Date: 2025-12-06
-- Description: Creates composite indexes to optimize global requests queries,
--              particularly for connection_id IN (...) patterns and assigned/created_by filters
-- ============================================================================

-- ============================================================================
-- REQUESTS TABLE INDEXES FOR GLOBAL VIEW
-- ============================================================================

-- Composite index for global requests query pattern
-- Optimizes queries: WHERE connection_id IN (...) AND deleted_at IS NULL ORDER BY created_at DESC
-- Used by: getRequestsSnapshot (global requests page)
-- This index is specifically designed for the IN clause pattern used in global view
CREATE INDEX IF NOT EXISTS idx_requests_connection_deleted_created 
  ON public.requests(connection_id, deleted_at, created_at DESC) 
  WHERE deleted_at IS NULL;

-- Composite index for "assigned to me" filter in global view
-- Optimizes queries: WHERE connection_id IN (...) AND assignee_user_id = ? AND deleted_at IS NULL ORDER BY created_at DESC
-- Used by: getRequestsSnapshot with assignedToUserId filter
CREATE INDEX IF NOT EXISTS idx_requests_connection_assignee_created 
  ON public.requests(connection_id, assignee_user_id, created_at DESC) 
  WHERE deleted_at IS NULL AND assignee_user_id IS NOT NULL;

-- Composite index for "submitted by me" filter in global view
-- Optimizes queries: WHERE connection_id IN (...) AND created_by_user_id = ? AND deleted_at IS NULL ORDER BY created_at DESC
-- Used by: getRequestsSnapshot with createdByUserId filter
CREATE INDEX IF NOT EXISTS idx_requests_connection_created_by_created 
  ON public.requests(connection_id, created_by_user_id, created_at DESC) 
  WHERE deleted_at IS NULL;

-- ============================================================================
-- VERIFICATION NOTES
-- ============================================================================
-- Existing indexes that complement these new ones:
-- - idx_requests_connection_not_deleted (from 20251113_requests_tasks_search_indexes.sql)
-- - idx_requests_assignee (from 20251113_requests_tasks_search_indexes.sql)
-- - idx_requests_created_by (from 20251113_requests_tasks_search_indexes.sql)
-- - idx_requests_connection_status_created (from 20251113_requests_tasks_search_indexes.sql)
-- 
-- These new indexes will improve:
-- 1. Global requests queries with IN clause (faster connection_id IN (...) lookups)
-- 2. Assigned/Created By filters in global view (optimized for multi-connection queries)
-- 
-- Expected performance improvement: 20-30% reduction in query time for global requests page
-- 

