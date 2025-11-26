-- ============================================================================
-- Migration: Create RPC to delete draft client organizations
-- Date: 2025-11-11
-- Description: Provides a secure, transactional helper for agencies to hard delete
--              draft client organizations and all related data. Only works for
--              draft clients that have never been invited/claimed.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.delete_draft_client(
  p_client_id uuid,
  p_agency_id uuid,
  p_user_id uuid  -- For permission check
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_draft boolean;
  v_connection_id uuid;
  v_request_ids uuid[];
  v_task_ids uuid[];
BEGIN
  -- Step 1: Verify the client org exists, is a draft, and belongs to the agency
  SELECT o.is_draft, c.id INTO v_is_draft, v_connection_id
  FROM public.organizations o
  INNER JOIN public.connections c ON c.client_id = o.id
  WHERE o.id = p_client_id
    AND c.agency_id = p_agency_id
    AND o.is_draft = true;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Draft client not found or does not belong to this agency';
  END IF;
  
  IF v_is_draft IS NOT TRUE THEN
    RAISE EXCEPTION 'Cannot hard delete non-draft client. Use soft delete instead.';
  END IF;
  
  -- Step 2: Verify user has permission (is member/owner of agency)
  IF NOT EXISTS (
    SELECT 1
    FROM public.memberships m
    WHERE m.org_id = p_agency_id
      AND m.user_id = p_user_id
  ) AND NOT EXISTS (
    SELECT 1
    FROM public.organizations o
    WHERE o.id = p_agency_id
      AND o.owner_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'User does not have permission to delete this draft client';
  END IF;
  
  -- Step 3: Hard delete related data (cascade order)
  -- First, get all request and task IDs for this connection to delete their comments
  
  -- Collect request IDs
  SELECT ARRAY_AGG(id) INTO v_request_ids
  FROM public.requests
  WHERE connection_id = v_connection_id;
  
  -- Collect task IDs
  SELECT ARRAY_AGG(id) INTO v_task_ids
  FROM public.tasks
  WHERE connection_id = v_connection_id;
  
  -- Delete comments on requests (must be done before deleting requests)
  IF v_request_ids IS NOT NULL AND array_length(v_request_ids, 1) > 0 THEN
    DELETE FROM public.request_comments WHERE request_id = ANY(v_request_ids);
  END IF;
  
  -- Delete comments on tasks (must be done before deleting tasks)
  IF v_task_ids IS NOT NULL AND array_length(v_task_ids, 1) > 0 THEN
    DELETE FROM public.task_comments WHERE task_id = ANY(v_task_ids);
  END IF;
  
  -- Delete connection resources (linked directly to connection)
  DELETE FROM public.connection_resources WHERE connection_id = v_connection_id;
  
  -- Delete tasks associated with this connection
  DELETE FROM public.tasks WHERE connection_id = v_connection_id;
  
  -- Delete requests associated with this connection
  DELETE FROM public.requests WHERE connection_id = v_connection_id;
  
  -- Delete projects associated with this connection
  DELETE FROM public.projects WHERE connection_id = v_connection_id;
  
  -- Step 4: Delete connection
  DELETE FROM public.connections
  WHERE id = v_connection_id;
  
  -- Step 5: Delete draft organization
  DELETE FROM public.organizations
  WHERE id = p_client_id
    AND is_draft = true;
  
END;
$$;

COMMENT ON FUNCTION public.delete_draft_client(uuid, uuid, uuid)
IS 'Hard deletes a draft client organization and all related data (connection, tasks, requests, projects, request_comments, task_comments, connection_resources). Only works for draft clients (is_draft = true) that belong to the specified agency. Requires user to be a member or owner of the agency.';

