'use server'

import { getTasksSnapshot, getTaskByIdGlobal } from './server';
import { getCommentsForTask } from '@/features/connections/server';
import type { EnhancedModeContext } from '@/lib/mode/getActiveContext';
import type { TasksSnapshot, TasksPaginationOptions } from './types';

/**
 * Fetch tasks snapshot (client action wrapper)
 */
export async function fetchTasksSnapshot(
  context: EnhancedModeContext,
  options: TasksPaginationOptions = {}
): Promise<TasksSnapshot> {
  return await getTasksSnapshot(context, options);
}

/**
 * Fetch more tasks (for pagination)
 */
export async function fetchMoreTasks(
  context: EnhancedModeContext,
  options: TasksPaginationOptions
): Promise<TasksSnapshot> {
  return await getTasksSnapshot(context, options);
}

/**
 * Refresh tasks data (for after mutations)
 */
export async function refreshTasksData(
  context: EnhancedModeContext,
  options: TasksPaginationOptions = {}
): Promise<TasksSnapshot> {
  return await getTasksSnapshot(context, options);
}

/**
 * Fetch a single task by ID (global view)
 * @param connectionId - Optional connection ID. If provided, filters directly by connection_id (faster, more reliable)
 * @param skipCache - If true, bypasses React cache (useful for immediate post-insert fetches)
 */
export async function fetchTaskByIdGlobal(
  taskId: string,
  context: EnhancedModeContext,
  connectionId?: string,
  skipCache?: boolean
) {
  if (skipCache) {
    // Import the uncached version directly for immediate fetches after insert
    const { getTaskByIdGlobalUncached } = await import('./server');
    return await getTaskByIdGlobalUncached(taskId, context, connectionId);
  }
  return await getTaskByIdGlobal(taskId, context, connectionId);
}

/**
 * Fetch comments for a task (global view)
 */
export async function fetchCommentsForTaskGlobal(taskId: string) {
  return await getCommentsForTask(taskId);
}

