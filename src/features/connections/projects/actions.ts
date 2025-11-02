'use server'

import { getActiveContext } from '@/lib/mode/getActiveContext'
import { isDev } from '../constants'

/**
 * PLACEHOLDER PROJECT ACTIONS - MOCK IMPLEMENTATION
 * 
 * These functions simulate async behavior but do NOT touch the database yet.
 * When the projects table is created in Supabase, replace these with real implementations
 * that match the pattern from requests/actions.ts
 */

/**
 * Create a new project (MOCK)
 */
export async function createProject(
  connectionId: string,
  title: string,
  description: string = '',
  type: string | null = 'general',
  assigneeUserId: string | null = null
) {
  const context = await getActiveContext();
  
  if (!context?.user?.id || !context?.organization?.id) {
    throw new Error('User not authenticated');
  }
  
  if (isDev()) {
    console.log('[Projects] createProject called (MOCK):', { 
      connectionId, 
      title, 
      description, 
      type, 
      assigneeUserId,
      createdByUserId: context.user.id,
      createdByOrgId: context.organization.id
    });
  }
  
  // Simulate async delay
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Return mock data
  const mockProject = {
    id: `mock-project-${Date.now()}`,
    connection_id: connectionId,
    title,
    description,
    type,
    status: 'planned',
    assignee_user_id: assigneeUserId,
    created_by_user_id: context.user.id,
    created_by_org_id: context.organization.id,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  
  if (isDev()) {
    console.log('[Projects] Mock project created:', mockProject);
  }
  
  return mockProject;
}

/**
 * Update the assignee of a project (MOCK)
 */
export async function updateProjectAssignee(projectId: string, assigneeUserId: string | null) {
  if (isDev()) {
    console.log('[Projects] updateProjectAssignee called (MOCK):', { projectId, assigneeUserId });
  }
  
  // Simulate async delay
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Return mock data
  const mockProject = {
    id: projectId,
    assignee_user_id: assigneeUserId,
    updated_at: new Date().toISOString()
  };
  
  return mockProject;
}

/**
 * Update the status of a project (MOCK)
 */
export async function updateProjectStatus(
  projectId: string, 
  status: 'planned' | 'active' | 'on_hold' | 'completed' | 'canceled'
) {
  if (isDev()) {
    console.log('[Projects] updateProjectStatus called (MOCK):', { projectId, status });
  }
  
  // Simulate async delay
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Return mock data
  const mockProject = {
    id: projectId,
    status: status,
    updated_at: new Date().toISOString()
  };
  
  return mockProject;
}

/**
 * Update the title of a project (MOCK)
 */
export async function updateProjectTitle(projectId: string, title: string) {
  if (isDev()) {
    console.log('[Projects] updateProjectTitle called (MOCK):', { projectId, title });
  }
  
  // Simulate async delay
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Return mock data
  const mockProject = {
    id: projectId,
    title: title,
    updated_at: new Date().toISOString()
  };
  
  return mockProject;
}

/**
 * Update the description of a project (MOCK)
 */
export async function updateProjectDescription(projectId: string, description: string) {
  if (isDev()) {
    console.log('[Projects] updateProjectDescription called (MOCK):', { projectId, description });
  }
  
  // Simulate async delay
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Return mock data
  const mockProject = {
    id: projectId,
    description: description,
    updated_at: new Date().toISOString()
  };
  
  return mockProject;
}

/**
 * Fetch projects for a connection (server action wrapper for client components)
 */
export async function fetchProjectsForConnection(
  connectionId: string,
  options?: { limit?: number; offset?: number; searchQuery?: string; assignedToUserId?: string; createdByUserId?: string }
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
 * Soft delete a project (MOCK)
 */
export async function deleteProject(projectId: string) {
  const context = await getActiveContext();
  
  if (!context?.user?.id) {
    throw new Error('User not authenticated');
  }
  
  if (isDev()) {
    console.log('[Projects] deleteProject called (MOCK):', { 
      projectId, 
      deletedByUserId: context.user.id,
      currentOrgId: context.organization.id
    });
  }
  
  // Simulate async delay
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Return mock data
  const mockProject = {
    id: projectId,
    deleted_at: new Date().toISOString(),
    deleted_by_user_id: context.user.id,
    updated_at: new Date().toISOString()
  };
  
  return mockProject;
}

