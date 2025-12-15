-- ============================================================================
-- Migration: Remove obsolete RPC functions after accordion refactor
-- Date: 2025-12-16
-- Description: Drops RPC functions that are no longer needed after refactoring
--              RequestsTable to use accordion structure with fetch-on-expand.
--              These functions supported the old flat pagination approach.
-- ============================================================================

-- Drop obsolete RPC functions that are no longer needed after accordion refactor
DROP FUNCTION IF EXISTS get_requests_flat_ordered(uuid[], text, int, int, uuid[], uuid, uuid, text);
DROP FUNCTION IF EXISTS get_requests_flat_all_statuses(uuid[], int, int, uuid, uuid, text);
DROP FUNCTION IF EXISTS get_requests_skeleton(uuid[], uuid, uuid);
DROP FUNCTION IF EXISTS get_requests_sorted_by_org_name(uuid[], text, int, int, text, uuid, uuid);

COMMENT ON FUNCTION get_requests_for_client_status(uuid[], uuid, text, uuid, uuid, text)
IS 'Replaces get_requests_flat_ordered and get_requests_flat_all_statuses. Used for accordion fetch-on-expand pattern.';
