'use server'

import { getTasksSnapshot, getTaskByIdGlobal, searchTasksGlobal as searchTasksGlobalServer, getTasksSnapshotForStatus, getTasksCounts, getTasksForClientStatus, searchClientsWithTasks, getAssignedTasksByClient } from './server';
import { getCommentsForTask } from '@/features/connections/server';
import type { EnhancedModeContext } from '@/lib/mode/getActiveContext';
import type { TasksSnapshot, TasksPaginationOptions, SearchResults } from './types';
import type { TaskStatus } from './taskGrouping';

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
 * Search tasks across all connections using full-text search
 * Uses search-based pagination (offset-based) instead of connection-based pagination
 */
export async function searchTasksGlobal(
  context: EnhancedModeContext,
  options: TasksPaginationOptions = {}
): Promise<TasksSnapshot> {
  return await searchTasksGlobalServer(context, options);
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

/**
 * Fetch more tasks for a specific status (status-first pagination)
 */
export async function fetchMoreTasksForStatus(
  context: EnhancedModeContext,
  options: TasksPaginationOptions & { status: TaskStatus }
): Promise<TasksSnapshot> {
  return await getTasksSnapshotForStatus(context, options.status, options);
}

/**
 * Get tasks counts (minimal metadata for accurate header counts)
 * Returns status counts and client counts without fetching task rows
 */
export async function fetchTasksCounts(
  context: EnhancedModeContext,
  options: { assignedToUserId?: string; assignedToUserIds?: string[] } = {}
): Promise<{
  statusCounts: Record<string, number>;
  clientCounts: Record<string, number>;
}> {
  return await getTasksCounts(context, options);
}

/**
 * Get tasks for a specific client organization in a specific status
 * Used for accordion fetch-on-expand pattern
 * Returns all tasks for the client (no pagination needed)
 */
export async function fetchTasksForClientStatus(
  context: EnhancedModeContext,
  clientOrgId: string,
  status: 'to_do' | 'in_progress' | 'on_hold' | 'done',
  options: { assignedToUserId?: string; assignedToUserIds?: string[] } = {}
) {
  return await getTasksForClientStatus(context, clientOrgId, status, options);
}

/**
 * Search clients with their tasks pre-loaded (server-side search mode)
 * Returns clients matching search text with all their tasks as atomic data
 * Used for fast, flicker-free search results
 */
export async function searchClientsWithTasksAction(
  context: EnhancedModeContext,
  searchText: string,
  options?: {
    statusFilter?: ('to_do' | 'in_progress' | 'on_hold' | 'done')[];
    assignedToUserId?: string;
    assignedToUserIds?: string[];
  }
): Promise<SearchResults> {
  return await searchClientsWithTasks(context, searchText, options);
}

/**
 * Get all tasks assigned to a user, grouped by client (assigned filter mode)
 * Returns clients with their assigned tasks pre-loaded as atomic data
 * Used for fast, flicker-free assigned filter results
 */
export async function fetchAssignedTasksByClient(
  context: EnhancedModeContext,
  options?: {
    statusFilter?: ('to_do' | 'in_progress' | 'on_hold' | 'done')[];
  }
): Promise<SearchResults> {
  return await getAssignedTasksByClient(context, options);
}

