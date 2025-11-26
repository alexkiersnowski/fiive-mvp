-- ============================================================================
-- Migration: Add cached project name to requests for fast search
-- Date: 2025-11-04
-- Description: Denormalizes project.name into requests.project_name_cached
--              to enable fast project name searching without JOINs
-- ============================================================================

-- Step 1: Add the cached column
ALTER TABLE public.requests 
ADD COLUMN IF NOT EXISTS project_name_cached text;

-- Step 2: Backfill existing data
UPDATE public.requests r 
SET project_name_cached = p.name 
FROM public.projects p 
WHERE r.project_id = p.id 
  AND (r.project_name_cached IS DISTINCT FROM p.name OR r.project_name_cached IS NULL);

-- Step 3: Create function to sync project name changes to requests
CREATE OR REPLACE FUNCTION public.fn_sync_project_name_to_requests()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- When a project name changes, update all requests linked to it
  UPDATE public.requests
  SET project_name_cached = NEW.name
  WHERE project_id = NEW.id
    AND deleted_at IS NULL;
  
  RETURN NEW;
END;
$$;

-- Step 4: Create trigger for project renames
DROP TRIGGER IF EXISTS trg_project_name_update ON public.projects;
CREATE TRIGGER trg_project_name_update
  AFTER UPDATE OF name ON public.projects
  FOR EACH ROW
  WHEN (OLD.name IS DISTINCT FROM NEW.name)
  EXECUTE FUNCTION public.fn_sync_project_name_to_requests();

-- Step 5: Create function to populate cached name on request insert/update
CREATE OR REPLACE FUNCTION public.fn_set_request_project_name()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- If project_id is set, populate the cached name
  IF NEW.project_id IS NOT NULL THEN
    SELECT name INTO NEW.project_name_cached
    FROM public.projects
    WHERE id = NEW.project_id
      AND deleted_at IS NULL;
  ELSE
    -- If no project, clear the cached name
    NEW.project_name_cached := NULL;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Step 6: Create trigger for request insert/update
DROP TRIGGER IF EXISTS trg_requests_project_cache ON public.requests;
CREATE TRIGGER trg_requests_project_cache
  BEFORE INSERT OR UPDATE OF project_id ON public.requests
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_set_request_project_name();

-- Step 7: Ensure pg_trgm extension is enabled for trigram index
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Step 8: Create trigram index for fast fuzzy search
CREATE INDEX IF NOT EXISTS requests_project_name_trgm_idx 
ON public.requests 
USING gin (lower(project_name_cached) gin_trgm_ops)
WHERE deleted_at IS NULL;

-- Step 9: Add comment for documentation
COMMENT ON COLUMN public.requests.project_name_cached IS 
'Denormalized project name for fast search. Automatically synced via triggers.';
















