'use server'

import { createClient } from '@/lib/supabase/server'
import { getActiveContext } from '@/lib/mode/getActiveContext'

/**
 * Create a new request
 */
export async function createRequest(
  connectionId: string,
  title: string,
  description: string = '',
  type: string | null = 'general',
  assigneeUserId: string | null = null
) {
  const supabase = await createClient();
  const context = await getActiveContext();
  
  if (!context?.user?.id || !context?.organization?.id) {
    throw new Error('User not authenticated');
  }
  
  console.log('createRequest called with:', { 
    connectionId, 
    title, 
    description, 
    type, 
    assigneeUserId,
    createdByUserId: context.user.id,
    createdByOrgId: context.organization.id
  });
  
  const { data, error } = await supabase
    .from('requests')
    .insert({
      connection_id: connectionId,
      title: title,
      description: description,
      type: type,
      status: 'new',
      assignee_user_id: assigneeUserId,
      created_by_user_id: context.user.id,
      created_by_org_id: context.organization.id
    })
    .select()
    .single();
  
  if (error) {
    console.error('Error creating request:', error);
    throw new Error(`Failed to create request: ${error.message}`);
  }
  
  console.log('Request created successfully:', data);
  return data;
}

/**
 * Update the assignee of a request
 */
export async function updateRequestAssignee(requestId: string, assigneeUserId: string | null) {
  const supabase = await createClient();
  
  console.log('updateRequestAssignee called with:', { requestId, assigneeUserId });
  
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
    console.error('Error updating request assignee:', error);
    throw new Error(`Failed to update assignee: ${error.message}`);
  }
  
  console.log('Request assignee updated successfully:', data);
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
  
  console.log('updateRequestStatus called with:', { requestId, status });
  
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
    console.error('Error updating request status:', error);
    throw new Error(`Failed to update status: ${error.message}`);
  }
  
  console.log('Request status updated successfully:', data);
  return data;
}

/**
 * Update the title of a request
 */
export async function updateRequestTitle(requestId: string, title: string) {
  const supabase = await createClient();
  
  console.log('updateRequestTitle called with:', { requestId, title });
  
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
    console.error('Error updating request title:', error);
    throw new Error(`Failed to update title: ${error.message}`);
  }
  
  console.log('Request title updated successfully:', data);
  return data;
}

/**
 * Update the description of a request
 */
export async function updateRequestDescription(requestId: string, description: string) {
  const supabase = await createClient();
  
  console.log('updateRequestDescription called with:', { requestId, description });
  
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
    console.error('Error updating request description:', error);
    throw new Error(`Failed to update description: ${error.message}`);
  }
  
  console.log('Request description updated successfully:', data);
  return data;
}

/**
 * Fetch requests for a connection (server action for client components)
 */
export async function fetchRequestsForConnection(connectionId: string) {
  // Import the server function dynamically to avoid circular dependencies
  const { getRequestsForConnection } = await import('../server')
  return await getRequestsForConnection(connectionId)
}

/**
 * Soft delete a request
 */
export async function deleteRequest(requestId: string) {
  const supabase = await createClient();
  const context = await getActiveContext();
  
  if (!context?.user?.id) {
    throw new Error('User not authenticated');
  }
  
  console.log('deleteRequest called with:', { 
    requestId, 
    deletedByUserId: context.user.id,
    currentOrgId: context.organization.id,
    userEmail: context.user.email
  });
  
  // First, fetch the request to see who created it
  const { data: existingRequest, error: fetchError } = await supabase
    .from('requests')
    .select('id, title, created_by_org_id, created_by_user_id')
    .eq('id', requestId)
    .single();
  
  if (fetchError) {
    console.error('Error fetching request before delete:', fetchError);
    throw new Error(`Failed to fetch request: ${fetchError.message}`);
  }
  
  console.log('Existing request:', existingRequest);
  console.log('Attempting to delete request created by org:', existingRequest?.created_by_org_id);
  console.log('Current user org:', context.organization.id);
  console.log('Match?', existingRequest?.created_by_org_id === context.organization.id);
  
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
    console.error('Error deleting request:', error);
    throw new Error(`Failed to delete request: ${error.message}`);
  }
  
  console.log('Request deleted successfully:', data);
  return data;
}
