-- ============================================================================
-- Migration: Indexes for optimizing members and invitations search
-- Date: 2025-11-19
-- Description: Creates indexes to optimize server-side search and filtering
--              for members (profiles) and membership_invitations tables
-- ============================================================================

-- Ensure pg_trgm extension is enabled for trigram indexes
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================================
-- PROFILES TABLE INDEXES (for member name and email search)
-- ============================================================================

-- Trigram index for email search (for fast email search in members)
CREATE INDEX IF NOT EXISTS idx_profiles_email_trgm 
  ON public.profiles USING gin (lower(email) gin_trgm_ops) 
  WHERE deleted_at IS NULL AND email IS NOT NULL;

-- ============================================================================
-- MEMBERSHIP_INVITATIONS TABLE INDEXES
-- ============================================================================

-- Trigram index for invited_email search (for fast email search in invitations)
CREATE INDEX IF NOT EXISTS idx_membership_invitations_invited_email_trgm 
  ON public.membership_invitations USING gin (lower(invited_email) gin_trgm_ops) 
  WHERE status = 'pending';

-- Composite index for fast org_id + status filtering
CREATE INDEX IF NOT EXISTS idx_membership_invitations_org_status 
  ON public.membership_invitations(org_id, status, created_at DESC) 
  WHERE status = 'pending';

-- Index for org_id lookups (used in filtering)
CREATE INDEX IF NOT EXISTS idx_membership_invitations_org_id 
  ON public.membership_invitations(org_id, created_at DESC) 
  WHERE status = 'pending';

