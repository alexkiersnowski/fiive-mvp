-- ============================================================================
-- Migration: Indexes for optimizing auth flow queries
-- Date: 2025-12-03
-- Description: Creates indexes to optimize frequently queried columns in
--              auth callback and onboarding flows
-- ============================================================================

-- ============================================================================
-- MEMBERSHIPS TABLE INDEXES
-- ============================================================================

-- Index for user_id lookups (used in auth callback and onboarding pages)
-- This is critical for performance as it's queried on every auth callback
CREATE INDEX IF NOT EXISTS idx_memberships_user_id 
  ON public.memberships(user_id);

-- ============================================================================
-- ORGANIZATIONS TABLE INDEXES
-- ============================================================================

-- Partial index for owner_id lookups (only non-draft organizations)
-- Used extensively in onboarding pages to check if user already owns an org
-- Partial index is more efficient since we only care about non-draft orgs
CREATE INDEX IF NOT EXISTS idx_organizations_owner_id 
  ON public.organizations(owner_id) 
  WHERE is_draft = false;

