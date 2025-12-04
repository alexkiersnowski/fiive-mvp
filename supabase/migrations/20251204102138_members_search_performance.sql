-- ============================================================================
-- Migration: Indexes for optimizing members search performance
-- Date: 2025-12-04
-- Description: Creates indexes to optimize search queries for organization members
--              Critical for fixing >5 second search delays
-- ============================================================================

-- ============================================================================
-- MEMBERSHIPS TABLE INDEXES
-- ============================================================================

-- Index for org_id filtering (CRITICAL - used in first query of search)
-- This is the missing index causing >5 second delays
CREATE INDEX IF NOT EXISTS idx_memberships_org_id 
  ON public.memberships(org_id);

-- Composite index for org_id + user_id lookups (optimizes final join query)
-- Used when filtering memberships by org_id and then joining with user_id
CREATE INDEX IF NOT EXISTS idx_memberships_org_user 
  ON public.memberships(org_id, user_id);

-- ============================================================================
-- VERIFICATION NOTES
-- ============================================================================
-- Existing indexes that should already be in place:
-- - idx_memberships_user_id (from 20251203102753_auth_performance_indexes.sql)
-- - idx_profiles_email_trgm (from 20251119120000_members_search_indexes.sql)
-- 
-- These new indexes will dramatically improve:
-- 1. Initial query filtering memberships by org_id (line 861-864 in actions.ts)
-- 2. Final query joining memberships with profiles (line 948-986 in actions.ts)

