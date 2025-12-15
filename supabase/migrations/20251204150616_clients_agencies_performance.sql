-- ============================================================================
-- Migration: Indexes for optimizing clients and agencies pages performance
-- Date: 2025-12-04
-- Description: Creates composite index to optimize agencies page queries,
--              particularly for client_id + created_at DESC lookups
-- ============================================================================

-- ============================================================================
-- CONNECTIONS TABLE INDEXES
-- ============================================================================

-- Composite index for client_id + created_at DESC lookups
-- Optimizes queries: WHERE client_id = ? ORDER BY created_at DESC
-- Used by: getAgenciesSnapshot (agencies page)
-- This complements the existing idx_connections_agency_created_desc for clients page
CREATE INDEX IF NOT EXISTS idx_connections_client_created_desc 
  ON public.connections(client_id, created_at DESC);

-- ============================================================================
-- VERIFICATION NOTES
-- ============================================================================
-- Existing indexes that complement this new one:
-- - idx_connections_agency_created_desc (from 20251112_clients_search_indexes.sql)
-- - idx_connections_client_id (from 20251204141537_organization_settings_performance.sql)
-- - idx_connections_client_status (from 20251204141537_organization_settings_performance.sql)
-- 
-- This new index will improve:
-- 1. Agencies page queries (faster sorting by created_at DESC)
-- 2. Pagination performance for agencies page
-- 
-- Expected performance improvement: 20-30% reduction in query time for agencies page

