-- ============================================================================
-- Migration: Index for optimizing profiles first_name ordering
-- Date: 2025-12-06
-- Description: Creates index to optimize ORDER BY profiles(first_name) queries
--              used in getAgencyMembersForConnection
-- ============================================================================

-- Index for profiles first_name ordering (used in memberships join queries)
-- Optimizes queries: ORDER BY profiles(first_name) WHERE deleted_at IS NULL
-- Used by: getAgencyMembersForConnection, getClientMembersForConnection
CREATE INDEX IF NOT EXISTS idx_profiles_first_name_asc 
  ON public.profiles(first_name ASC) 
  WHERE deleted_at IS NULL;

-- ============================================================================
-- VERIFICATION NOTES
-- ============================================================================
-- This index complements existing indexes:
-- - idx_profiles_first_name_trgm (from 20251113_requests_tasks_search_indexes.sql) - for search
-- - idx_profiles_name_search (from 20251112_clients_search_indexes.sql) - for search
-- 
-- This new index specifically optimizes ORDER BY queries which are different
-- from search queries and benefit from a simple B-tree index on first_name.
-- 
-- Expected performance improvement: 50-100ms reduction in query time for 
-- connections with 20+ members when fetching agency/client members.

