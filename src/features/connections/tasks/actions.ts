'use server'

import { getActiveContext } from '@/lib/mode/getActiveContext'
import { createClient } from '@/lib/supabase/server'
import type { TaskSortMode } from './taskSort'

const isDev = () => process.env.NODE_ENV !== 'production';

type TaskStatus = 'to_do' | 'in_progress' | 'on_hold' | 'done'

/**
 * Create a new task
 * MOCK DATA: Returns mock task data until tasks table is created in Supabase
 */
export async function createTask(
  connectionId: string,
  title: string,
  description: string = '',
  projectId: string | null = null,
  assigneeUserId: string | null = null
) {
  const context = await getActiveContext();
  
  if (!context?.user?.id || !context?.organization?.id) {
    throw new Error('User not authenticated');
  }

  const supabase = await createClient();
  const now = new Date().toISOString();

  // Determine client_visible based on assignee
  // If assigned to a client member, MUST be true (cannot be false - paradoxical)
  // If no assignee or assigned to agency member, defaults to false (for security)
  let clientVisible = false;
  
  if (assigneeUserId) {
    // Fetch connection to get client_id
    const { data: connection } = await supabase
      .from('connections')
      .select('client_id')
      .eq('id', connectionId)
      .single();
    
    if (connection) {
      // Check if assignee is a member of the client organization
      const { data: clientMembership } = await supabase
        .from('memberships')
        .select('id')
        .eq('user_id', assigneeUserId)
        .eq('org_id', connection.client_id)
        .single();
      
      // If assignee is a client member, task MUST be visible to client
      if (clientMembership) {
        clientVisible = true;
      }
    }
  }

  const { data, error } = await supabase
    .from('tasks')
    .insert({
      connection_id: connectionId,
      title,
      description,
      project_id: projectId,
      assignee_user_id: assigneeUserId,
      status: 'to_do',
      client_visible: clientVisible,
      created_by_user_id: context.user.id,
      created_at: now,
      updated_at: now
    })
    .select('id')
    .single();

  if (error) {
    if (isDev()) {
      console.error('Failed to create task:', error);
    }
    throw new Error('Failed to create task');
  }

  return data;
}

interface ConvertRequestToTaskPayload {
  connectionId: string
  title: string
  description: string
  status: TaskStatus
  projectId: string | null
  assigneeUserId: string | null
  dueDateRaw: string | null
  clientVisible: boolean
}

export async function convertRequestToTask(
  requestId: string,
  payload: ConvertRequestToTaskPayload
) {
  const context = await getActiveContext()

  if (!context?.user?.id || !context?.organization?.id) {
    throw new Error('User not authenticated')
  }

  const supabase = await createClient()
  const now = new Date().toISOString()

  const insertPayload = {
    connection_id: payload.connectionId,
    title: payload.title,
    description: payload.description ?? '',
    status: payload.status,
    project_id: payload.projectId,
    assignee_user_id: payload.assigneeUserId,
    due_date: payload.dueDateRaw,
    client_visible: payload.clientVisible,
    created_by_user_id: context.user.id,
    created_at: now,
    updated_at: now,
    source_request_id: requestId,
  }

  const { data, error } = await supabase
    .from('tasks')
    .insert(insertPayload)
    .select('id')
    .single()

  if (error) {
    if (isDev()) {
      console.error('Failed to convert request to task:', error)
    }
    throw new Error('Failed to convert request to task')
  }

  return {
    taskId: data.id,
  }
}

/**
 * Update the assignee of a task
 * MOCK DATA: Returns mock task data until tasks table is created in Supabase
 */
export async function updateTaskAssignee(taskId: string, assigneeUserId: string | null) {
  const supabase = await createClient();

  let shouldSetClientVisible = false;

  if (assigneeUserId) {
    const { data: taskInfo, error: taskError } = await supabase
      .from('tasks')
      .select('connection_id')
      .eq('id', taskId)
      .is('deleted_at', null)
      .single();

    if (taskError) {
      if (isDev()) {
        console.error('Failed to fetch task before updating assignee:', taskError);
      }
      throw new Error('Failed to update task assignee');
    }

    const connectionId = taskInfo?.connection_id;

    if (connectionId) {
      const { data: connectionData, error: connectionError } = await supabase
        .from('connections')
        .select('client_id')
        .eq('id', connectionId)
        .single();

      if (connectionError) {
        if (isDev()) {
          console.error('Failed to fetch connection while updating assignee:', connectionError);
        }
        throw new Error('Failed to update task assignee');
      }

      const clientOrgId = connectionData?.client_id;

      if (clientOrgId) {
        const { data: membershipData, error: membershipError } = await supabase
          .from('memberships')
          .select('id')
          .eq('user_id', assigneeUserId)
          .eq('org_id', clientOrgId)
          .limit(1);

        if (membershipError) {
          if (isDev()) {
            console.error('Failed to check assignee membership while updating task:', membershipError);
          }
          throw new Error('Failed to update task assignee');
        }

        shouldSetClientVisible = Boolean(membershipData && membershipData.length > 0);
      }
    }
  }

  const updates: Record<string, unknown> = {
    assignee_user_id: assigneeUserId,
    updated_at: new Date().toISOString()
  };

  if (shouldSetClientVisible) {
    updates.client_visible = true;
  }

  const { data, error } = await supabase
    .from('tasks')
    .update(updates)
    .eq('id', taskId)
    .is('deleted_at', null)
    .select('id, assignee_user_id, client_visible')
    .single();

  if (error) {
    if (isDev()) {
      console.error('Failed to update task assignee:', error);
    }
    throw new Error('Failed to update task assignee');
  }

  return data;
}

/**
 * Update the status of a task
 * MOCK DATA: Returns mock task data until tasks table is created in Supabase
 */
export async function updateTaskStatus(
  taskId: string, 
  status: 'to_do' | 'in_progress' | 'on_hold' | 'done'
) {
  const supabase = await createClient();
  const now = new Date().toISOString();
  
  // First, get the current status to determine if we're changing to/from 'done'
  const { data: currentTask, error: fetchError } = await supabase
    .from('tasks')
    .select('status')
    .eq('id', taskId)
    .is('deleted_at', null)
    .single();

  if (fetchError) {
    if (isDev()) {
      console.error('Failed to fetch current task status:', fetchError);
    }
    throw new Error('Failed to update task status');
  }

  const updates: Record<string, unknown> = {
    status,
    updated_at: now
  };

  // Set completed_at when status changes to 'done'
  if (status === 'done') {
    updates.completed_at = now;
  } 
  // Clear completed_at when status changes away from 'done'
  else if (currentTask?.status === 'done') {
    updates.completed_at = null;
  }

  const { data, error } = await supabase
    .from('tasks')
    .update(updates)
    .eq('id', taskId)
    .is('deleted_at', null)
    .select('id, status, updated_at, completed_at')
    .single();

  if (error) {
    if (isDev()) {
      console.error('Failed to update task status:', error);
    }
    throw new Error('Failed to update task status');
  }

  return data;
}

/**
 * Update the title of a task
 * MOCK DATA: Returns mock task data until tasks table is created in Supabase
 */
export async function updateTaskTitle(taskId: string, title: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('tasks')
    .update({
      title,
      updated_at: new Date().toISOString()
    })
    .eq('id', taskId)
    .is('deleted_at', null)
    .select('id, title')
    .single();

  if (error) {
    if (isDev()) {
      console.error('Failed to update task title:', error);
    }
    throw new Error('Failed to update task title');
  }

  return data;
}

/**
 * Update the description of a task
 * MOCK DATA: Returns mock task data until tasks table is created in Supabase
 */
export async function updateTaskDescription(taskId: string, description: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('tasks')
    .update({
      description,
      updated_at: new Date().toISOString()
    })
    .eq('id', taskId)
    .is('deleted_at', null)
    .select('id, description')
    .single();

  if (error) {
    if (isDev()) {
      console.error('Failed to update task description:', error);
    }
    throw new Error('Failed to update task description');
  }

  return data;
}

/**
 * Update the type (project) of a task
 * MOCK DATA: Returns mock task data until tasks table is created in Supabase
 */
export async function updateTaskProject(taskId: string, projectId: string | null) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('tasks')
    .update({
      project_id: projectId,
      updated_at: new Date().toISOString()
    })
    .eq('id', taskId)
    .is('deleted_at', null)
    .select('id, project_id')
    .single();

  if (error) {
    if (isDev()) {
      console.error('Failed to update task project:', error);
    }
    throw new Error('Failed to update task project');
  }

  return data;
}

/**
 * Update the due date of a task
 * MOCK DATA: Returns mock task data until tasks table is created in Supabase
 */
export async function updateTaskDueDate(taskId: string, dueDate: string | null) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('tasks')
    .update({
      due_date: dueDate,
      updated_at: new Date().toISOString()
    })
    .eq('id', taskId)
    .is('deleted_at', null)
    .select('id, due_date')
    .single();

  if (error) {
    if (isDev()) {
      console.error('Failed to update task due date:', error);
    }
    throw new Error('Failed to update task due date');
  }

  return data;
}

/**
 * Update the client visibility of a task
 * MOCK DATA: Returns mock task data until tasks table is created in Supabase
 */
export async function updateTaskClientVisible(taskId: string, clientVisible: boolean) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('tasks')
    .update({
      client_visible: clientVisible,
      updated_at: new Date().toISOString()
    })
    .eq('id', taskId)
    .is('deleted_at', null)
    .select('id, client_visible')
    .single();

  if (error) {
    if (isDev()) {
      console.error('Failed to update client visibility:', error);
    }
    throw new Error('Failed to update client visibility');
  }

  return data;
}

/**
 * Fetch tasks for a connection (server action for client components)
 */
export async function fetchTasksForConnection(
  connectionId: string,
  options?: { limit?: number; offset?: number; searchQuery?: string; assignedToUserId?: string; assignedToUserIds?: string[]; createdByUserId?: string; sortMode?: TaskSortMode }
) {
  // Import the server function dynamically to avoid circular dependencies
  const { getTasksForConnection } = await import('../server')
  return await getTasksForConnection(connectionId, options)
}

/**
 * Fetch a single task by id (server action wrapper for client components)
 */
export async function fetchTaskById(
  connectionId: string,
  taskId: string
) {
  const { getTaskById } = await import('../server')
  return await getTaskById(taskId, connectionId)
}

/**
 * Fetch comments for a task (server action wrapper for client components)
 */
export async function fetchCommentsForTask(taskId: string) {
  const { getCommentsForTask } = await import('../server')
  return await getCommentsForTask(taskId)
}

export async function fetchCommentsForTasks(taskIds: string[]) {
  const { getCommentsForTasks } = await import('../server')
  return await getCommentsForTasks(taskIds)
}

/**
 * Fetch projects for a connection (server action for client components)
 * Uses lightweight getProjectOptionsForConnection instead of full project fetch
 */
export async function fetchProjectsForConnection(connectionId: string) {
  const { getProjectOptionsForConnection } = await import('../server')
  return await getProjectOptionsForConnection(connectionId)
}

export async function fetchMembersForConnection(connectionId: string) {
  const { getConnectionMembers } = await import('../server')
  return await getConnectionMembers(connectionId)
}

/**
 * Create a comment on a task
 * MOCK DATA: Returns mock comment data until task_comments table is created in Supabase
 */
export async function createComment(
  taskId: string,
  text: string,
  createdByUserId?: string
) {
  const context = await getActiveContext();
  
  if (!context?.user?.id || !context?.organization?.id) {
    throw new Error('User not authenticated');
  }

  const effectiveUserId = createdByUserId ?? context.user.id;

  if (createdByUserId && createdByUserId !== context.user.id) {
    if (isDev()) {
      console.error('createComment user mismatch', {
        providedUserId: createdByUserId,
        contextUserId: context.user.id,
      });
    }
    throw new Error('User mismatch while creating comment');
  }

  const supabase = await createClient();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('task_comments')
    .insert({
      task_id: taskId,
      body: text,
      created_by_user_id: effectiveUserId,
      created_at: now,
      updated_at: now
    })
    .select('id, task_id, body, created_at, created_by_user_id')
    .single();

  if (error) {
    if (isDev()) {
      console.error('Failed to create task comment:', error);
    }
    throw new Error('Failed to create task comment');
  }

  return data;
}

/**
 * Delete a comment
 * MOCK DATA: Returns mock success until task_comments table is created in Supabase
 */
export async function deleteComment(commentId: string) {
  const context = await getActiveContext();
  
  if (!context?.user?.id) {
    throw new Error('User not authenticated');
  }

  const supabase = await createClient();
  const now = new Date().toISOString();

  const { error } = await supabase
    .from('task_comments')
    .update({
      deleted_at: now,
      updated_at: now
    })
    .eq('id', commentId)
    .eq('created_by_user_id', context.user.id);

  if (error) {
    if (isDev()) {
      console.error('Failed to delete task comment:', error);
    }
    throw new Error('Failed to delete task comment');
  }

  return { success: true };
}

/**
 * Delete a task
 * MOCK DATA: Returns mock task data until tasks table is created in Supabase
 */
export async function deleteTask(taskId: string) {
  const context = await getActiveContext();
  
  if (!context?.user?.id) {
    throw new Error('User not authenticated');
  }

  const supabase = await createClient();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('tasks')
    .update({
      deleted_at: now,
      deleted_by_user_id: context.user.id,
      updated_at: now
    })
    .eq('id', taskId)
    .select('id, deleted_at, deleted_by_user_id')
    .single();

  if (error) {
    if (isDev()) {
      console.error('Failed to delete task:', error);
    }
    // Include error details in dev mode for debugging
    const errorMessage = isDev() 
      ? `Failed to delete task: ${error.message || JSON.stringify(error)}`
      : 'Failed to delete task';
    throw new Error(errorMessage);
  }

  return data;
}

