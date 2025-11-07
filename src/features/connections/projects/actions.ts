'use server'

import { createClient } from '@/lib/supabase/server'
import { getActiveContext } from '@/lib/mode/getActiveContext'
import { isDev } from '../constants'
import { parse, format } from 'date-fns'

const normalizeDateInput = (value?: string | null): string | null => {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null

  const tryPattern = (pattern: string) => {
    try {
      const parsed = parse(trimmed, pattern, new Date())
      if (isNaN(parsed.getTime())) return null
      return format(parsed, 'yyyy-MM-dd')
    } catch {
      return null
    }
  }

  return (
    tryPattern('yyyy-MM-dd') ??
    tryPattern('d MMM yyyy') ??
    (() => {
      try {
        const parsed = new Date(trimmed)
        return isNaN(parsed.getTime()) ? null : format(parsed, 'yyyy-MM-dd')
      } catch {
        return null
      }
    })()
  )
}

/**
 * Create a new project
 */
export async function createProject(
  connectionId: string,
  title: string,
  description: string = '',
  type: string | null = null,
  assigneeUserId: string | null = null,
  startDate?: string | null,
  endDate?: string | null
) {
  const supabase = await createClient();
  const context = await getActiveContext();
  
  if (!context?.user?.id || !context?.organization?.id) {
    throw new Error('User not authenticated');
  }
  
  if (isDev()) {
    console.log('createProject called with:', { 
      connectionId, 
      title, 
      description, 
      type, 
      assigneeUserId,
      startDate,
      endDate,
      createdByUserId: context.user.id,
      createdByOrgId: context.organization.id
    });
  }
  
  const start_date = normalizeDateInput(startDate);
  const end_date = normalizeDateInput(endDate);
  
  // Build insert object with required fields
  // created_at and updated_at are handled by DB defaults (now())
  const insertData: {
    connection_id: string;
    name: string;
    description: string;
    status: string;
    start_date?: string | null;
    end_date?: string | null;
    created_by_user_id: string;
    [key: string]: any; // Allow for optional fields that may not exist yet
  } = {
    connection_id: connectionId,
    name: title,
    description: description,
    status: 'planned',
    start_date: start_date,
    end_date: end_date,
    created_by_user_id: context.user.id
  };
  
  // Note: assignee_user_id and created_by_org_id columns do not exist in schema
  
  const { data, error } = await supabase
    .from('projects')
    .insert(insertData)
    .select()
    .single();
  
  if (error) {
    if (isDev()) {
      console.error('Error creating project:', error);
    }
    throw new Error(`Failed to create project: ${error.message}`);
  }
  
  if (isDev()) {
    console.log('Project created successfully:', data);
  }
  return data;
}

/**
 * Update the assignee of a project
 * Note: assignee_user_id column does not exist in schema, so this is a no-op
 * Kept for API compatibility but will not perform any database operation
 */
export async function updateProjectAssignee(projectId: string, assigneeUserId: string | null) {
  if (isDev()) {
    console.log('updateProjectAssignee called (no-op): assignee_user_id column does not exist in schema', { projectId, assigneeUserId });
  }
  // Return a mock response since the column doesn't exist
  // This maintains API compatibility while avoiding database errors
  return { id: projectId };
}

/**
 * Update the status of a project
 */
export async function updateProjectStatus(
  projectId: string, 
  status: 'planned' | 'active' | 'on_hold' | 'completed' | 'canceled'
) {
  const supabase = await createClient();
  
  if (isDev()) {
    console.log('updateProjectStatus called with:', { projectId, status });
  }
  
  const { data, error } = await supabase
    .from('projects')
    .update({ 
      status: status,
      updated_at: new Date().toISOString()
    })
    .eq('id', projectId)
    .select()
    .single();
  
  if (error) {
    if (isDev()) {
      console.error('Error updating project status:', error);
    }
    throw new Error(`Failed to update status: ${error.message}`);
  }
  
  if (isDev()) {
    console.log('Project status updated successfully:', data);
  }
  return data;
}

/**
 * Update the title of a project (updates name column)
 */
export async function updateProjectTitle(projectId: string, title: string) {
  const supabase = await createClient();
  
  if (isDev()) {
    console.log('updateProjectTitle called with:', { projectId, title });
  }
  
  const { data, error } = await supabase
    .from('projects')
    .update({ 
      name: title,
      updated_at: new Date().toISOString()
    })
    .eq('id', projectId)
    .select()
    .single();
  
  if (error) {
    if (isDev()) {
      console.error('Error updating project title:', error);
    }
    throw new Error(`Failed to update title: ${error.message}`);
  }
  
  if (isDev()) {
    console.log('Project title updated successfully:', data);
  }
  return data;
}

/**
 * Update the description of a project
 */
export async function updateProjectDescription(projectId: string, description: string) {
  const supabase = await createClient();
  
  if (isDev()) {
    console.log('updateProjectDescription called with:', { projectId, description });
  }
  
  const { data, error } = await supabase
    .from('projects')
    .update({ 
      description: description,
      updated_at: new Date().toISOString()
    })
    .eq('id', projectId)
    .select()
    .single();
  
  if (error) {
    if (isDev()) {
      console.error('Error updating project description:', error);
    }
    throw new Error(`Failed to update description: ${error.message}`);
  }
  
  if (isDev()) {
    console.log('Project description updated successfully:', data);
  }
  return data;
}

/**
 * Update the start date of a project
 */
export async function updateProjectStartDate(projectId: string, startDate: string | null) {
  const supabase = await createClient();
  
  if (isDev()) {
    console.log('updateProjectStartDate called with:', { projectId, startDate });
  }
  
  // Convert date string to date format if provided, otherwise set to null
  const start_date = normalizeDateInput(startDate);
  
  const { data, error } = await supabase
    .from('projects')
    .update({ 
      start_date: start_date,
      updated_at: new Date().toISOString()
    })
    .eq('id', projectId)
    .select()
    .single();
  
  if (error) {
    if (isDev()) {
      console.error('Error updating project start date:', error);
    }
    throw new Error(`Failed to update start date: ${error.message}`);
  }
  
  if (isDev()) {
    console.log('Project start date updated successfully:', data);
  }
  return data;
}

/**
 * Update the end date of a project
 */
export async function updateProjectEndDate(projectId: string, endDate: string | null) {
  const supabase = await createClient();
  
  if (isDev()) {
    console.log('updateProjectEndDate called with:', { projectId, endDate });
  }
  
  // Convert date string to date format if provided, otherwise set to null
  const end_date = normalizeDateInput(endDate);
  
  const { data, error } = await supabase
    .from('projects')
    .update({ 
      end_date: end_date,
      updated_at: new Date().toISOString()
    })
    .eq('id', projectId)
    .select()
    .single();
  
  if (error) {
    if (isDev()) {
      console.error('Error updating project end date:', error);
    }
    throw new Error(`Failed to update end date: ${error.message}`);
  }
  
  if (isDev()) {
    console.log('Project end date updated successfully:', data);
  }
  return data;
}

/**
 * Fetch projects for a connection (server action wrapper for client components)
 */
export async function fetchProjectsForConnection(
  connectionId: string,
  options?: { limit?: number; offset?: number; searchQuery?: string; assignedToUserId?: string; createdByUserId?: string; sort?: string }
) {
  // Import the server function dynamically to avoid circular dependencies
  const { getProjectsForConnection } = await import('../server')
  return await getProjectsForConnection(connectionId, options)
}

/**
 * Fetch a single project by id (server action wrapper for client components)
 */
export async function fetchProjectById(
  connectionId: string,
  projectId: string
) {
  const { getProjectById } = await import('../server')
  return await getProjectById(projectId, connectionId)
}

/**
 * Fetch comments for a project (server action wrapper for client components)
 */
export async function fetchCommentsForProject(projectId: string) {
  const { getCommentsForProject } = await import('../server')
  return await getCommentsForProject(projectId)
}

export async function fetchCommentsForProjects(projectIds: string[]) {
  const { getCommentsForProjects } = await import('../server')
  return await getCommentsForProjects(projectIds)
}

/**
 * Create a comment (MOCK)
 */
export async function createComment(
  projectId: string,
  text: string
) {
  const context = await getActiveContext();
  
  if (!context?.user?.id || !context?.organization?.id) {
    throw new Error('User not authenticated');
  }
  
  if (isDev()) {
    console.log('[Projects] createComment called (MOCK):', { 
      projectId, 
      text,
      createdByUserId: context.user.id
    });
  }
  
  // Simulate async delay
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Return mock data
  const mockComment = {
    id: `mock-comment-${Date.now()}`,
    project_id: projectId,
    body: text,
    created_by_user_id: context.user.id,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  
  return {
    id: mockComment.id,
    projectId: mockComment.project_id,
    text: mockComment.body,
    createdByUserId: mockComment.created_by_user_id,
    createdAt: mockComment.created_at
  };
}

/**
 * Delete a comment (MOCK)
 */
export async function deleteComment(commentId: string) {
  const context = await getActiveContext();
  
  if (!context?.user?.id) {
    throw new Error('User not authenticated');
  }
  
  if (isDev()) {
    console.log('[Projects] deleteComment called (MOCK):', { commentId });
  }
  
  // Simulate async delay
  await new Promise(resolve => setTimeout(resolve, 100));
  
  return { success: true, data: { id: commentId } };
}

/**
 * Soft delete a project
 */
export async function deleteProject(projectId: string) {
  const supabase = await createClient();
  const context = await getActiveContext();
  
  if (!context?.user?.id) {
    throw new Error('User not authenticated');
  }
  
  if (isDev()) {
    console.log('deleteProject called with:', { 
      projectId, 
      deletedByUserId: context.user.id,
      currentOrgId: context.organization.id
    });
  }
  
  // Soft delete: UPDATE deleted_at and deleted_by_user_id
  const now = new Date().toISOString();
  const updateData = {
    deleted_at: now,
    deleted_by_user_id: context.user.id, // Always set to the active user who initiated the delete
    updated_at: now
  };
  
  const { data, error } = await supabase
    .from('projects')
    .update(updateData)
    .eq('id', projectId)
    .select()
    .single();
  
  if (error) {
    if (isDev()) {
      console.error('Error deleting project:', error);
    }
    throw new Error(`Failed to delete project: ${error.message}`);
  }
  
  if (isDev()) {
    console.log('Project deleted successfully:', data);
  }
  return data;
}

