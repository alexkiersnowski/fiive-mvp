-- ============================================================================
-- Migration: Full-text search indexes for global search across all connections
-- Date: 2025-12-10
-- Description: Adds tsvector columns and GIN indexes for PostgreSQL full-text search
--              on tasks and requests tables. Enables global search across all
--              connections with relevance ranking.
-- ============================================================================

-- ============================================================================
-- TASKS TABLE: Full-Text Search Setup
-- ============================================================================

-- Add generated tsvector column for full-text search
-- Combines task title with organization name (client name for agencies, agency name for clients)
ALTER TABLE public.tasks
ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Create function to update task search_vector
-- Includes task title and organization names from the connection (both client and agency)
CREATE OR REPLACE FUNCTION public.update_task_search_vector()
RETURNS TRIGGER AS $$
DECLARE
  org_names TEXT := '';
BEGIN
  -- Fetch both client and agency organization names
  SELECT COALESCE(
    string_agg(DISTINCT o.name, ' '), 
    ''
  ) INTO org_names
  FROM public.connections c
  LEFT JOIN public.organizations o ON (
    o.id = c.client_id OR o.id = c.agency_id
  )
  WHERE c.id = NEW.connection_id
  AND o.name IS NOT NULL;
  
  -- Update search_vector with task title (weight A) and organization names (weight B)
  NEW.search_vector := 
    setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', org_names), 'B');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update search_vector on insert/update
DROP TRIGGER IF EXISTS tasks_search_vector_update ON public.tasks;
CREATE TRIGGER tasks_search_vector_update
  BEFORE INSERT OR UPDATE OF title, connection_id ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_task_search_vector();

-- Create GIN index on search_vector for fast full-text search
CREATE INDEX IF NOT EXISTS idx_tasks_search_vector_gin
  ON public.tasks USING gin(search_vector)
  WHERE deleted_at IS NULL;

-- ============================================================================
-- REQUESTS TABLE: Full-Text Search Setup
-- ============================================================================

-- Add generated tsvector column for full-text search
-- Combines request title with organization name (client name for agencies, agency name for clients)
ALTER TABLE public.requests
ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Create function to update request search_vector
-- Includes request title and organization names from the connection (both client and agency)
CREATE OR REPLACE FUNCTION public.update_request_search_vector()
RETURNS TRIGGER AS $$
DECLARE
  org_names TEXT := '';
BEGIN
  -- Fetch both client and agency organization names
  SELECT COALESCE(
    string_agg(DISTINCT o.name, ' '), 
    ''
  ) INTO org_names
  FROM public.connections c
  LEFT JOIN public.organizations o ON (
    o.id = c.client_id OR o.id = c.agency_id
  )
  WHERE c.id = NEW.connection_id
  AND o.name IS NOT NULL;
  
  -- Update search_vector with request title (weight A) and organization names (weight B)
  NEW.search_vector := 
    setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', org_names), 'B');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update search_vector on insert/update
DROP TRIGGER IF EXISTS requests_search_vector_update ON public.requests;
CREATE TRIGGER requests_search_vector_update
  BEFORE INSERT OR UPDATE OF title, connection_id ON public.requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_request_search_vector();

-- Create GIN index on search_vector for fast full-text search
CREATE INDEX IF NOT EXISTS idx_requests_search_vector_gin
  ON public.requests USING gin(search_vector)
  WHERE deleted_at IS NULL;

-- ============================================================================
-- INITIAL POPULATION: Update search_vector for existing rows
-- ============================================================================

-- Update all existing tasks
UPDATE public.tasks t
SET search_vector = 
  setweight(to_tsvector('english', COALESCE(t.title, '')), 'A') ||
  setweight(
    to_tsvector('english', 
      COALESCE((
        SELECT string_agg(DISTINCT o.name, ' ')
        FROM public.connections c
        LEFT JOIN public.organizations o ON (
          o.id = c.client_id OR o.id = c.agency_id
        )
        WHERE c.id = t.connection_id
        AND o.name IS NOT NULL
      ), '')
    ), 
    'B'
  )
WHERE t.deleted_at IS NULL;

-- Update all existing requests
UPDATE public.requests r
SET search_vector = 
  setweight(to_tsvector('english', COALESCE(r.title, '')), 'A') ||
  setweight(
    to_tsvector('english', 
      COALESCE((
        SELECT string_agg(DISTINCT o.name, ' ')
        FROM public.connections c
        LEFT JOIN public.organizations o ON (
          o.id = c.client_id OR o.id = c.agency_id
        )
        WHERE c.id = r.connection_id
        AND o.name IS NOT NULL
      ), '')
    ), 
    'B'
  )
WHERE r.deleted_at IS NULL;

-- ============================================================================
-- TRIGGER: Update search_vector when organization names change
-- ============================================================================

-- Function to update tasks search_vector when organization name changes
-- Recalculates search_vector for all affected tasks using the same logic as the insert/update trigger
CREATE OR REPLACE FUNCTION public.update_tasks_on_org_name_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Update all tasks connected to this organization
  -- Recalculate search_vector using the same logic as the trigger
  UPDATE public.tasks t
  SET search_vector = 
    setweight(to_tsvector('english', COALESCE(t.title, '')), 'A') ||
    setweight(
      to_tsvector('english', 
        COALESCE((
          SELECT string_agg(DISTINCT o.name, ' ')
          FROM public.connections c
          LEFT JOIN public.organizations o ON (
            o.id = c.client_id OR o.id = c.agency_id
          )
          WHERE c.id = t.connection_id
          AND o.name IS NOT NULL
        ), '')
      ), 
      'B'
    )
  WHERE t.connection_id IN (
    SELECT id FROM public.connections 
    WHERE client_id = NEW.id OR agency_id = NEW.id
  )
  AND t.deleted_at IS NULL;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger on organizations table to update tasks when org name changes
DROP TRIGGER IF EXISTS organizations_update_tasks_search ON public.organizations;
CREATE TRIGGER organizations_update_tasks_search
  AFTER UPDATE OF name ON public.organizations
  FOR EACH ROW
  WHEN (OLD.name IS DISTINCT FROM NEW.name)
  EXECUTE FUNCTION public.update_tasks_on_org_name_change();

-- Function to update requests search_vector when organization name changes
-- Recalculates search_vector for all affected requests using the same logic as the insert/update trigger
CREATE OR REPLACE FUNCTION public.update_requests_on_org_name_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Update all requests connected to this organization
  -- Recalculate search_vector using the same logic as the trigger
  UPDATE public.requests r
  SET search_vector = 
    setweight(to_tsvector('english', COALESCE(r.title, '')), 'A') ||
    setweight(
      to_tsvector('english', 
        COALESCE((
          SELECT string_agg(DISTINCT o.name, ' ')
          FROM public.connections c
          LEFT JOIN public.organizations o ON (
            o.id = c.client_id OR o.id = c.agency_id
          )
          WHERE c.id = r.connection_id
          AND o.name IS NOT NULL
        ), '')
      ), 
      'B'
    )
  WHERE r.connection_id IN (
    SELECT id FROM public.connections 
    WHERE client_id = NEW.id OR agency_id = NEW.id
  )
  AND r.deleted_at IS NULL;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger on organizations table to update requests when org name changes
DROP TRIGGER IF EXISTS organizations_update_requests_search ON public.organizations;
CREATE TRIGGER organizations_update_requests_search
  AFTER UPDATE OF name ON public.organizations
  FOR EACH ROW
  WHEN (OLD.name IS DISTINCT FROM NEW.name)
  EXECUTE FUNCTION public.update_requests_on_org_name_change();

