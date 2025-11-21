'use server'

import { getRequestsSnapshot, getRequestByIdGlobal } from './server';
import { getCommentsForRequest } from '@/features/connections/server';
import type { EnhancedModeContext } from '@/lib/mode/getActiveContext';
import type { RequestsSnapshot, RequestsPaginationOptions } from './types';

/**
 * Fetch requests snapshot (client action wrapper)
 */
export async function fetchRequestsSnapshot(
  context: EnhancedModeContext,
  options: RequestsPaginationOptions = {}
): Promise<RequestsSnapshot> {
  return await getRequestsSnapshot(context, options);
}

/**
 * Fetch more requests (for pagination)
 */
export async function fetchMoreRequests(
  context: EnhancedModeContext,
  options: RequestsPaginationOptions
): Promise<RequestsSnapshot> {
  return await getRequestsSnapshot(context, options);
}

/**
 * Refresh requests data (for after mutations)
 */
export async function refreshRequestsData(
  context: EnhancedModeContext,
  options: RequestsPaginationOptions = {}
): Promise<RequestsSnapshot> {
  return await getRequestsSnapshot(context, options);
}

/**
 * Fetch a single request by ID (global view)
 */
export async function fetchRequestByIdGlobal(
  requestId: string,
  context: EnhancedModeContext,
  connectionId?: string,
  skipCache?: boolean
) {
  if (skipCache) {
    // Import the uncached version directly for immediate fetches after insert
    const { getRequestByIdGlobalUncached } = await import('./server');
    return await getRequestByIdGlobalUncached(requestId, context, connectionId);
  }
  return await getRequestByIdGlobal(requestId, context, connectionId);
}

/**
 * Fetch comments for a request (global view)
 */
export async function fetchCommentsForRequestGlobal(requestId: string) {
  return await getCommentsForRequest(requestId);
}

