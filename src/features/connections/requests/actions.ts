'use server'

import { createClient } from '@/lib/supabase/server'
import { getActiveContext } from '@/lib/mode/getActiveContext'

const isDev = () => process.env.NODE_ENV !== 'production';

/**
 * Create a new request
 */
export async function createRequest(
  connectionId: string,
  title: string,
  description: string = '',
  projectId: string | null = null,
  assigneeUserId: string | null = null
) {
  const supabase = await createClient();
  const context = await getActiveContext();
  
  if (!context?.user?.id || !context?.organization?.id) {
    throw new Error('User not authenticated');
  }
  
  if (isDev()) {
    console.log('createRequest called with:', { 
      connectionId, 
      title, 
      description, 
      projectId, 
      assigneeUserId,
      createdByUserId: context.user.id,
      createdByOrgId: context.organization.id
    });
  }
  
  const { data, error } = await supabase
    .from('requests')
    .insert({
      connection_id: connectionId,
      title: title,
      description: description,
      project_id: projectId,
      status: 'new',
      assignee_user_id: assigneeUserId,
      created_by_user_id: context.user.id,
      created_by_org_id: context.organization.id
    })
    .select()
    .single();
  
  if (error) {
    if (isDev()) {
      console.error('Error creating request:', error);
    }
    throw new Error(`Failed to create request: ${error.message}`);
  }
  
  if (isDev()) {
    console.log('Request created successfully:', data);
  }
  return data;
}

/**
 * Update the assignee of a request
 */
export async function updateRequestAssignee(requestId: string, assigneeUserId: string | null) {
  const supabase = await createClient();
  
  if (isDev()) {
    console.log('updateRequestAssignee called with:', { requestId, assigneeUserId });
  }
  
  const { data, error } = await supabase
    .from('requests')
    .update({ 
      assignee_user_id: assigneeUserId,
      updated_at: new Date().toISOString()
    })
    .eq('id', requestId)
    .select()
    .single();
  
  if (error) {
    if (isDev()) {
      console.error('Error updating request assignee:', error);
    }
    throw new Error(`Failed to update assignee: ${error.message}`);
  }
  
  if (isDev()) {
    console.log('Request assignee updated successfully:', data);
  }
  return data;
}

/**
 * Update the status of a request
 */
export async function updateRequestStatus(
  requestId: string, 
  status: 'new' | 'in_review' | 'accepted' | 'canceled'
) {
  const supabase = await createClient();
  
  if (isDev()) {
    console.log('updateRequestStatus called with:', { requestId, status });
  }
  
  const { data, error } = await supabase
    .from('requests')
    .update({ 
      status: status,
      updated_at: new Date().toISOString()
    })
    .eq('id', requestId)
    .select()
    .single();
  
  if (error) {
    if (isDev()) {
      console.error('Error updating request status:', error);
    }
    throw new Error(`Failed to update status: ${error.message}`);
  }
  
  if (isDev()) {
    console.log('Request status updated successfully:', data);
  }
  return data;
}

/**
 * Update the title of a request
 */
export async function updateRequestTitle(requestId: string, title: string) {
  const supabase = await createClient();
  
  if (isDev()) {
    console.log('updateRequestTitle called with:', { requestId, title });
  }
  
  const { data, error } = await supabase
    .from('requests')
    .update({ 
      title: title,
      updated_at: new Date().toISOString()
    })
    .eq('id', requestId)
    .select()
    .single();
  
  if (error) {
    if (isDev()) {
      console.error('Error updating request title:', error);
    }
    throw new Error(`Failed to update title: ${error.message}`);
  }
  
  if (isDev()) {
    console.log('Request title updated successfully:', data);
  }
  return data;
}

/**
 * Update the description of a request
 */
export async function updateRequestDescription(requestId: string, description: string) {
  const supabase = await createClient();
  
  if (isDev()) {
    console.log('updateRequestDescription called with:', { requestId, description });
  }
  
  const { data, error } = await supabase
    .from('requests')
    .update({ 
      description: description,
      updated_at: new Date().toISOString()
    })
    .eq('id', requestId)
    .select()
    .single();
  
  if (error) {
    if (isDev()) {
      console.error('Error updating request description:', error);
    }
    throw new Error(`Failed to update description: ${error.message}`);
  }
  
  if (isDev()) {
    console.log('Request description updated successfully:', data);
  }
  return data;
}

/**
 * Update the type (project) of a request
 */
export async function updateRequestProject(requestId: string, projectId: string | null) {
  const supabase = await createClient();
  
  if (isDev()) {
    console.log('updateRequestProject called with:', { requestId, projectId });
  }
  
  const { data, error } = await supabase
    .from('requests')
    .update({ 
      project_id: projectId,
      updated_at: new Date().toISOString()
    })
    .eq('id', requestId)
    .select()
    .single();
  
  if (error) {
    if (isDev()) {
      console.error('Error updating request project:', error);
    }
    throw new Error(`Failed to update project: ${error.message}`);
  }
  
  if (isDev()) {
    console.log('Request project updated successfully:', data);
  }
  return data;
}

/**
 * Fetch requests for a connection (server action for client components)
 */
export async function fetchRequestsForConnection(
  connectionId: string,
  options?: { limit?: number; offset?: number; searchQuery?: string; assignedToUserId?: string; createdByUserId?: string }
) {
  // Import the server function dynamically to avoid circular dependencies
  const { getRequestsForConnection } = await import('../server')
  return await getRequestsForConnection(connectionId, options)
}

/**
 * Fetch a single request by id (server action wrapper for client components)
 */
export async function fetchRequestById(
  connectionId: string,
  requestId: string
) {
  const { getRequestById } = await import('../server')
  return await getRequestById(requestId, connectionId)
}

/**
 * Fetch comments for a request (server action wrapper for client components)
 */
export async function fetchCommentsForRequest(requestId: string) {
  const { getCommentsForRequest } = await import('../server')
  return await getCommentsForRequest(requestId)
}

export async function fetchCommentsForRequests(requestIds: string[]) {
  const { getCommentsForRequests } = await import('../server')
  return await getCommentsForRequests(requestIds)
}

/**
 * Fetch projects for a connection (server action for client components)
 */
export async function fetchProjectsForConnection(connectionId: string) {
  const { getProjectsForConnection } = await import('../server')
  const result = await getProjectsForConnection(connectionId, { limit: 2000, offset: 0 })
  // Return just the projects array with id and title
  return result.projects.map(p => ({ id: p.id, name: p.title }))
}

/**
 * Soft delete a request
 */
export async function createComment(
  requestId: string,
  text: string
) {
  const supabase = await createClient();
  const context = await getActiveContext();
  
  if (!context?.user?.id || !context?.organization?.id) {
    throw new Error('User not authenticated');
  }
  
  if (isDev()) {
    console.log('createComment called with:', { 
      requestId, 
      text,
      createdByUserId: context.user.id
    });
  }
  
  const { data, error } = await supabase
    .from('request_comments')
    .insert({
      request_id: requestId,
      body: text,
      created_by_user_id: context.user.id
    })
    .select()
    .single();
  
  if (error) {
    if (isDev()) {
      console.error('Error creating comment:', error);
    }
    throw new Error(`Failed to create comment: ${error.message}`);
  }
  
  if (isDev()) {
    console.log('Comment created successfully:', data);
  }
  
  return {
    id: data.id,
    requestId: data.request_id,
    text: data.body,
    createdByUserId: data.created_by_user_id,
    createdAt: data.created_at
  };
}

/**
 * Delete a comment
 */
export async function deleteComment(commentId: string) {
  const supabase = await createClient();
  const context = await getActiveContext();
  
  if (!context?.user?.id) {
    throw new Error('User not authenticated');
  }
  
  if (isDev()) {
    console.log('deleteComment called with:', { commentId });
  }
  
  const now = new Date().toISOString();
  
  const { data, error } = await supabase
    .from('request_comments')
    .update({ 
      deleted_at: now,
      updated_at: now
    })
    .eq('id', commentId)
    .eq('created_by_user_id', context.user.id) // Only allow deleting own comments
    .select()
    .single();
  
  if (error) {
    if (isDev()) {
      console.error('Error deleting comment:', error);
    }
    throw new Error(`Failed to delete comment: ${error.message}`);
  }
  
  if (isDev()) {
    console.log('Comment deleted successfully:', data);
  }
  
  return { success: true, data };
}

export async function deleteRequest(requestId: string) {
  const supabase = await createClient();
  const context = await getActiveContext();
  
  if (!context?.user?.id) {
    throw new Error('User not authenticated');
  }
  
  if (isDev()) {
    console.log('deleteRequest called with:', { 
      requestId, 
      deletedByUserId: context.user.id,
      currentOrgId: context.organization.id,
      userEmail: context.user.email
    });
  }
  
  // First, fetch the request to see who created it
  const { data: existingRequest, error: fetchError } = await supabase
    .from('requests')
    .select('id, title, created_by_org_id, created_by_user_id')
    .eq('id', requestId)
    .single();
  
  if (fetchError) {
    if (isDev()) {
      console.error('Error fetching request before delete:', fetchError);
    }
    throw new Error(`Failed to fetch request: ${fetchError.message}`);
  }
  
  if (isDev()) {
    console.log('Existing request:', existingRequest);
    console.log('Attempting to delete request created by org:', existingRequest?.created_by_org_id);
    console.log('Current user org:', context.organization.id);
    console.log('Match?', existingRequest?.created_by_org_id === context.organization.id);
  }
  
  const { data, error } = await supabase
    .from('requests')
    .update({ 
      deleted_at: new Date().toISOString(),
      deleted_by_user_id: context.user.id
    })
    .eq('id', requestId)
    .select()
    .single();
  
  if (error) {
    if (isDev()) {
      console.error('Error deleting request:', error);
    }
    throw new Error(`Failed to delete request: ${error.message}`);
  }
  
  if (isDev()) {
    console.log('Request deleted successfully:', data);
  }
  return data;
}
