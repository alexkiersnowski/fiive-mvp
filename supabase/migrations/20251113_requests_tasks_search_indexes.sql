-- ============================================================================
-- Migration: Indexes for optimizing requests, tasks, and projects search, filter, and pagination
-- Date: 2025-11-13
-- Description: Creates indexes to optimize server-side search and filtering
--              for requests, tasks, and projects tables
-- ============================================================================

-- Ensure pg_trgm extension is enabled for trigram indexes
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================================
-- REQUESTS TABLE INDEXES
-- ============================================================================

-- Base filter index: connection_id + deleted_at (most common filter combination)
CREATE INDEX IF NOT EXISTS idx_requests_connection_not_deleted 
  ON public.requests(connection_id, created_at DESC) 
  WHERE deleted_at IS NULL;

-- Filter by assignee (for "assigned to me" toggle)
CREATE INDEX IF NOT EXISTS idx_requests_assignee 
  ON public.requests(connection_id, assignee_user_id, created_at DESC) 
  WHERE deleted_at IS NULL AND assignee_user_id IS NOT NULL;

-- Filter by created_by (for "submitted by me" toggle)
CREATE INDEX IF NOT EXISTS idx_requests_created_by 
  ON public.requests(connection_id, created_by_user_id, created_at DESC) 
  WHERE deleted_at IS NULL;

-- Status filter (for status-based searches)
CREATE INDEX IF NOT EXISTS idx_requests_status 
  ON public.requests(connection_id, status, created_at DESC) 
  WHERE deleted_at IS NULL;

-- Trigram index for title search (ILIKE pattern matching)
CREATE INDEX IF NOT EXISTS idx_requests_title_trgm 
  ON public.requests USING gin (lower(title) gin_trgm_ops) 
  WHERE deleted_at IS NULL;

-- Trigram index for project_name_cached search (already exists but ensuring it's there)
CREATE INDEX IF NOT EXISTS requests_project_name_trgm_idx 
  ON public.requests USING gin (lower(project_name_cached) gin_trgm_ops) 
  WHERE deleted_at IS NULL;

-- Index for assignee_user_id lookups (used in profile name searches)
CREATE INDEX IF NOT EXISTS idx_requests_assignee_user_id 
  ON public.requests(assignee_user_id) 
  WHERE deleted_at IS NULL AND assignee_user_id IS NOT NULL;

-- Index for created_by_user_id lookups (used in profile name searches)
CREATE INDEX IF NOT EXISTS idx_requests_created_by_user_id 
  ON public.requests(created_by_user_id) 
  WHERE deleted_at IS NULL;

-- Composite index for common filter + sort combination
CREATE INDEX IF NOT EXISTS idx_requests_connection_status_created 
  ON public.requests(connection_id, status, created_at DESC) 
  WHERE deleted_at IS NULL;

-- ============================================================================
-- TASKS TABLE INDEXES
-- ============================================================================

-- Base filter index: connection_id + deleted_at (most common filter combination)
CREATE INDEX IF NOT EXISTS idx_tasks_connection_not_deleted 
  ON public.tasks(connection_id, created_at DESC, id DESC) 
  WHERE deleted_at IS NULL;

-- Filter by assignee (for "assigned to me" toggle)
CREATE INDEX IF NOT EXISTS idx_tasks_assignee 
  ON public.tasks(connection_id, assignee_user_id, created_at DESC, id DESC) 
  WHERE deleted_at IS NULL AND assignee_user_id IS NOT NULL;

-- Filter by created_by (for "created by me" filter if needed)
CREATE INDEX IF NOT EXISTS idx_tasks_created_by 
  ON public.tasks(connection_id, created_by_user_id, created_at DESC, id DESC) 
  WHERE deleted_at IS NULL;

-- Status filter (for status-based searches)
CREATE INDEX IF NOT EXISTS idx_tasks_status 
  ON public.tasks(connection_id, status, created_at DESC, id DESC) 
  WHERE deleted_at IS NULL;

-- Trigram index for title search (ILIKE pattern matching)
CREATE INDEX IF NOT EXISTS idx_tasks_title_trgm 
  ON public.tasks USING gin (lower(title) gin_trgm_ops) 
  WHERE deleted_at IS NULL;

-- Trigram index for description search (ILIKE pattern matching)
CREATE INDEX IF NOT EXISTS idx_tasks_description_trgm 
  ON public.tasks USING gin (lower(description) gin_trgm_ops) 
  WHERE deleted_at IS NULL AND description IS NOT NULL;

-- Index for project_id lookups (used in project name searches)
CREATE INDEX IF NOT EXISTS idx_tasks_project_id 
  ON public.tasks(connection_id, project_id, created_at DESC) 
  WHERE deleted_at IS NULL AND project_id IS NOT NULL;

-- Index for assignee_user_id lookups (used in profile name searches)
CREATE INDEX IF NOT EXISTS idx_tasks_assignee_user_id 
  ON public.tasks(assignee_user_id) 
  WHERE deleted_at IS NULL AND assignee_user_id IS NOT NULL;

-- Composite index for common filter + sort combination
CREATE INDEX IF NOT EXISTS idx_tasks_connection_status_created 
  ON public.tasks(connection_id, status, created_at DESC, id DESC) 
  WHERE deleted_at IS NULL;

-- ============================================================================
-- PROFILES TABLE INDEXES (for assignee/submitted_by name searches)
-- ============================================================================

-- Trigram index for first_name search (if not already exists)
CREATE INDEX IF NOT EXISTS idx_profiles_first_name_trgm 
  ON public.profiles USING gin (lower(first_name) gin_trgm_ops) 
  WHERE deleted_at IS NULL;

-- Trigram index for last_name search (if not already exists)
CREATE INDEX IF NOT EXISTS idx_profiles_last_name_trgm 
  ON public.profiles USING gin (lower(last_name) gin_trgm_ops) 
  WHERE deleted_at IS NULL;

-- Composite trigram index for full name search (first_name + last_name)
-- This helps with multi-word searches like "John Smith"
CREATE INDEX IF NOT EXISTS idx_profiles_name_trgm 
  ON public.profiles USING gin ((lower(coalesce(first_name, '') || ' ' || coalesce(last_name, ''))) gin_trgm_ops) 
  WHERE deleted_at IS NULL;

-- ============================================================================
-- PROJECTS TABLE INDEXES
-- ============================================================================

-- Base filter index: connection_id + deleted_at (most common filter combination)
-- Includes created_at DESC for default "newest_first" sort
CREATE INDEX IF NOT EXISTS idx_projects_connection_not_deleted 
  ON public.projects(connection_id, created_at DESC) 
  WHERE deleted_at IS NULL;

-- Status filter (for status-based searches: planned, active, on_hold, completed, canceled)
CREATE INDEX IF NOT EXISTS idx_projects_status 
  ON public.projects(connection_id, status, created_at DESC) 
  WHERE deleted_at IS NULL;

-- Name sort index (ASC) for "project_asc" sort option
CREATE INDEX IF NOT EXISTS idx_projects_name_asc 
  ON public.projects(connection_id, name ASC, created_at DESC) 
  WHERE deleted_at IS NULL;

-- Name sort index (DESC) for "project_desc" sort option
CREATE INDEX IF NOT EXISTS idx_projects_name_desc 
  ON public.projects(connection_id, name DESC, created_at DESC) 
  WHERE deleted_at IS NULL;

-- End date sort index for "end_date_asc" sort option (soonest first)
-- Includes created_at DESC as secondary sort for nulls
CREATE INDEX IF NOT EXISTS idx_projects_end_date_asc 
  ON public.projects(connection_id, end_date ASC NULLS LAST, created_at DESC) 
  WHERE deleted_at IS NULL;

-- Trigram index for project name search (ILIKE pattern matching)
-- This enables fast text search on project names
CREATE INDEX IF NOT EXISTS idx_projects_name_trgm 
  ON public.projects USING gin (lower(name) gin_trgm_ops) 
  WHERE deleted_at IS NULL;

-- Index for connection_id + name search (used in tasks project search)
CREATE INDEX IF NOT EXISTS idx_projects_connection_name 
  ON public.projects(connection_id, name) 
  WHERE deleted_at IS NULL;

-- Composite index for common filter + sort combination (status + created_at)
CREATE INDEX IF NOT EXISTS idx_projects_connection_status_created 
  ON public.projects(connection_id, status, created_at DESC) 
  WHERE deleted_at IS NULL;

