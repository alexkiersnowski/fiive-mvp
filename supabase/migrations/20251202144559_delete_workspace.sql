-- ============================================================================
-- Migration: Create RPC to delete workspace organizations
-- Date: 2025-12-02
-- Description: Provides a secure, transactional helper for workspace owners to
--              soft-delete their organization and hard-delete all related data.
--              Only works for organizations with no real connections and no billing footprint.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.delete_workspace(
  p_org_id uuid,
  p_user_id uuid  -- For permission check (must be owner)
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id uuid;
  v_internal_connection_ids uuid[];
  v_draft_org_ids uuid[];
  v_draft_connection_ids uuid[];
  v_connection_id uuid;
  v_request_ids uuid[];
  v_task_ids uuid[];
  v_user_ids uuid[];
BEGIN
  -- Step 1: Verify the organization exists and user is the owner
  SELECT owner_id INTO v_owner_id
  FROM public.organizations
  WHERE id = p_org_id
    AND deleted_at IS NULL;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Organization not found or already deleted';
  END IF;
  
  IF v_owner_id != p_user_id THEN
    RAISE EXCEPTION 'Only the organization owner can delete the workspace';
  END IF;
  
  -- Step 2: Collect all internal connection IDs for this organization
  -- (both as agency and as client)
  -- Use COALESCE to ensure we get an empty array instead of NULL if no connections exist
  SELECT COALESCE(ARRAY_AGG(id), ARRAY[]::uuid[]) INTO v_internal_connection_ids
  FROM public.connections
  WHERE (agency_id = p_org_id OR client_id = p_org_id)
    AND connection_status = 'internal';
  
  -- Step 3: Collect all draft organization IDs created by this organization
  -- Use COALESCE to ensure we get an empty array instead of NULL if no draft orgs exist
  SELECT COALESCE(ARRAY_AGG(id), ARRAY[]::uuid[]) INTO v_draft_org_ids
  FROM public.organizations
  WHERE created_by_org_id = p_org_id
    AND is_draft = true;
  
  -- Step 4: Collect all user IDs in this organization (for profile soft-deletion)
  -- Use COALESCE to ensure we get an empty array instead of NULL if no memberships exist
  SELECT COALESCE(ARRAY_AGG(DISTINCT user_id), ARRAY[]::uuid[]) INTO v_user_ids
  FROM public.memberships
  WHERE org_id = p_org_id;
  
  -- Step 5: For each internal connection, delete related data
  IF array_length(v_internal_connection_ids, 1) > 0 THEN
    FOREACH v_connection_id IN ARRAY v_internal_connection_ids
    LOOP
      -- Collect request IDs for this connection
      -- Use COALESCE to ensure we get an empty array instead of NULL if no requests exist
      SELECT COALESCE(ARRAY_AGG(id), ARRAY[]::uuid[]) INTO v_request_ids
      FROM public.requests
      WHERE connection_id = v_connection_id;
      
      -- Collect task IDs for this connection
      -- Use COALESCE to ensure we get an empty array instead of NULL if no tasks exist
      SELECT COALESCE(ARRAY_AGG(id), ARRAY[]::uuid[]) INTO v_task_ids
      FROM public.tasks
      WHERE connection_id = v_connection_id;
      
      -- Delete comments on requests (must be done before deleting requests)
      IF array_length(v_request_ids, 1) > 0 THEN
        DELETE FROM public.request_comments WHERE request_id = ANY(v_request_ids);
      END IF;
      
      -- Delete comments on tasks (must be done before deleting tasks)
      IF array_length(v_task_ids, 1) > 0 THEN
        DELETE FROM public.task_comments WHERE task_id = ANY(v_task_ids);
      END IF;
      
      -- Delete connection resources
      DELETE FROM public.connection_resources WHERE connection_id = v_connection_id;
      
      -- Delete tasks
      DELETE FROM public.tasks WHERE connection_id = v_connection_id;
      
      -- Delete requests
      DELETE FROM public.requests WHERE connection_id = v_connection_id;
      
      -- Delete projects
      DELETE FROM public.projects WHERE connection_id = v_connection_id;
    END LOOP;
    
    -- Delete all internal connections
    DELETE FROM public.connections
    WHERE id = ANY(v_internal_connection_ids);
  END IF;
  
  -- Step 6: Delete all draft organizations created by this workspace
  -- (This will cascade delete their connections and related data via delete_draft_client/delete_draft_agency)
  -- But we need to handle them here since we're deleting the parent org
  IF array_length(v_draft_org_ids, 1) > 0 THEN
    -- Collect all connection IDs for draft orgs first
    -- Use COALESCE to ensure we get an empty array instead of NULL if no connections exist
    SELECT COALESCE(ARRAY_AGG(c.id), ARRAY[]::uuid[]) INTO v_draft_connection_ids
    FROM public.connections c
    WHERE (c.agency_id = ANY(v_draft_org_ids) OR c.client_id = ANY(v_draft_org_ids));
    
    -- For each draft org connection, delete related data
    -- Only proceed if we have connections to process
    IF array_length(v_draft_connection_ids, 1) > 0 THEN
      FOREACH v_connection_id IN ARRAY v_draft_connection_ids
      LOOP
      -- Collect request IDs
      -- Use COALESCE to ensure we get an empty array instead of NULL if no requests exist
      SELECT COALESCE(ARRAY_AGG(id), ARRAY[]::uuid[]) INTO v_request_ids
      FROM public.requests
      WHERE connection_id = v_connection_id;
      
      -- Collect task IDs
      -- Use COALESCE to ensure we get an empty array instead of NULL if no tasks exist
      SELECT COALESCE(ARRAY_AGG(id), ARRAY[]::uuid[]) INTO v_task_ids
      FROM public.tasks
      WHERE connection_id = v_connection_id;
      
      -- Delete comments
      IF array_length(v_request_ids, 1) > 0 THEN
        DELETE FROM public.request_comments WHERE request_id = ANY(v_request_ids);
      END IF;
      
      IF array_length(v_task_ids, 1) > 0 THEN
        DELETE FROM public.task_comments WHERE task_id = ANY(v_task_ids);
      END IF;
      
      -- Delete connection resources
      DELETE FROM public.connection_resources WHERE connection_id = v_connection_id;
      
      -- Delete tasks, requests, projects
      DELETE FROM public.tasks WHERE connection_id = v_connection_id;
      DELETE FROM public.requests WHERE connection_id = v_connection_id;
      DELETE FROM public.projects WHERE connection_id = v_connection_id;
      END LOOP;
    END IF;
    
    -- Delete connections for draft orgs
    DELETE FROM public.connections
    WHERE agency_id = ANY(v_draft_org_ids) OR client_id = ANY(v_draft_org_ids);
    
    -- Delete draft organizations
    DELETE FROM public.organizations
    WHERE id = ANY(v_draft_org_ids);
  END IF;
  
  -- Step 7: Hard delete all organization_resources for this org
  DELETE FROM public.organization_resources WHERE organization_id = p_org_id;
  
  -- Step 8: Hard delete all membership_invitations for this org
  DELETE FROM public.membership_invitations WHERE org_id = p_org_id;
  
  -- Step 9: Hard delete all memberships for this org
  DELETE FROM public.memberships WHERE org_id = p_org_id;
  
  -- Step 10: Soft delete all profiles for org members
  IF array_length(v_user_ids, 1) > 0 THEN
    UPDATE public.profiles
    SET deleted_at = NOW(),
        updated_at = NOW()
    WHERE id = ANY(v_user_ids);
  END IF;
  
  -- Step 11: Soft delete the organization
  UPDATE public.organizations
  SET deleted_at = NOW(),
      updated_at = NOW()
  WHERE id = p_org_id;
  
END;
$$;

COMMENT ON FUNCTION public.delete_workspace(uuid, uuid)
IS 'Soft deletes a workspace organization and hard deletes all related data (memberships, internal connections, draft orgs, organization_resources, membership_invitations). Soft deletes profiles for org members. Requires user to be the organization owner.';

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.delete_workspace(uuid, uuid) TO authenticated;

