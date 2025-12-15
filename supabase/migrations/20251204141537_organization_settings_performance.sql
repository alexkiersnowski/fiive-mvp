-- ============================================================================
-- Migration: Indexes for optimizing organization settings pages
-- Date: 2025-12-04
-- Description: Creates indexes to optimize queries in organization settings
--              pages, particularly for connection checks and verification queries
-- ============================================================================

-- ============================================================================
-- CONNECTIONS TABLE INDEXES
-- ============================================================================

-- Index for client_id lookups (used in hasRealConnections for client orgs)
-- This is critical for performance when checking if client organizations have connections
CREATE INDEX IF NOT EXISTS idx_connections_client_id 
  ON public.connections(client_id);

-- Composite index for client_id + connection_status lookups
-- Optimizes the hasRealConnections query pattern: 
-- WHERE client_id = ? AND connection_status IN ('invited', 'connected', 'disconnected')
CREATE INDEX IF NOT EXISTS idx_connections_client_status 
  ON public.connections(client_id, connection_status)
  WHERE connection_status IN ('invited', 'connected', 'disconnected');

-- ============================================================================
-- ORGANIZATIONS TABLE INDEXES
-- ============================================================================

-- Composite index for id + owner_id lookups
-- Optimizes verifyOrganizationOwnership queries that check both id and owner_id
-- This pattern is used frequently in organization settings actions
CREATE INDEX IF NOT EXISTS idx_organizations_id_owner 
  ON public.organizations(id, owner_id);

-- ============================================================================
-- MEMBERSHIP_INVITATIONS TABLE INDEXES
-- ============================================================================

-- Composite index for org_id + status + expires_at lookups
-- Optimizes countOrganizationInvitations query:
-- WHERE org_id = ? AND status = 'pending' AND expires_at > ?
-- This is used frequently in member limit checks
CREATE INDEX IF NOT EXISTS idx_membership_invitations_org_status_expires 
  ON public.membership_invitations(org_id, status, expires_at)
  WHERE status = 'pending';

-- ============================================================================
-- VERIFICATION NOTES
-- ============================================================================
-- Existing indexes that complement these new ones:
-- - idx_connections_agency_id (from 20251112_clients_search_indexes.sql)
-- - idx_memberships_org_id (from 20251204102138_members_search_performance.sql)
-- - idx_memberships_user_id (from 20251203102753_auth_performance_indexes.sql)
-- - idx_organizations_owner_id (from 20251203102753_auth_performance_indexes.sql)
-- 
-- These new indexes will dramatically improve:
-- 1. Connection checks for client organizations (hasRealConnections)
-- 2. Organization ownership verification queries (verifyOrganizationOwnership)
-- 3. Invitation counting queries (countOrganizationInvitations)

