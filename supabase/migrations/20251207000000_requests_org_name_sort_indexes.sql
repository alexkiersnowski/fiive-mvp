-- ============================================================================
-- Migration: Indexes for optimizing organization name sorting in requests
-- Date: 2025-12-07
-- Description: Creates indexes to optimize sorting requests by organization 
--              name through connections. These indexes support database-level
--              sorting by client/agency organization names.
-- ============================================================================

-- ============================================================================
-- CONNECTIONS TABLE INDEXES FOR ORG NAME SORTING
-- ============================================================================

-- Index for sorting requests by client organization name (agency view)
-- Supports: requests JOIN connections JOIN organizations ORDER BY organizations.name
-- WHERE connections.client_id = organizations.id
-- This index helps the JOIN operation when sorting by client name
CREATE INDEX IF NOT EXISTS idx_connections_client_id_for_sort 
  ON public.connections(client_id, id) 
  WHERE connection_status != 'disconnected';

-- Index for sorting requests by agency organization name (client view)
-- Supports: requests JOIN connections JOIN organizations ORDER BY organizations.name  
-- WHERE connections.agency_id = organizations.id
-- This index helps the JOIN operation when sorting by agency name
CREATE INDEX IF NOT EXISTS idx_connections_agency_id_for_sort 
  ON public.connections(agency_id, id) 
  WHERE connection_status != 'disconnected';

-- ============================================================================
-- VERIFICATION NOTES
-- ============================================================================
-- Existing indexes that complement these new ones:
-- - idx_organizations_name_pattern (from 20251112_clients_search_indexes.sql)
--   - Supports ORDER BY organizations.name efficiently
-- - idx_requests_connection_deleted_created (from 20251206163334_global_requests_performance.sql)
--   - Supports filtering requests by connection_id
-- 
-- Query pattern these indexes optimize:
-- SELECT requests.*, connections.*, organizations.name
-- FROM requests
-- JOIN connections ON requests.connection_id = connections.id
-- JOIN organizations ON connections.client_id = organizations.id (or agency_id)
-- WHERE requests.connection_id IN (...) 
--   AND requests.deleted_at IS NULL
-- ORDER BY organizations.name ASC/DESC, requests.created_at DESC
-- LIMIT 50 OFFSET ?
--
-- Expected performance improvement:
-- - Index scans instead of full-table scans on connections table
-- - Faster JOIN operations when sorting by organization name
-- - Enables efficient database-level sorting with pagination

