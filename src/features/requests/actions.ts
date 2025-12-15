'use server'

import { getRequestsSnapshot, getRequestByIdGlobal, searchRequestsGlobal as searchRequestsGlobalServer, getRequestsSnapshotForStatus, getRequestsFlat, getRequestsCounts, getRequestsForClientStatus, searchClientsWithRequests as searchClientsWithRequestsServer, getAssignedRequestsByClient as getAssignedRequestsByClientServer } from './server';
import { getCommentsForRequest } from '@/features/connections/server';
import type { EnhancedModeContext } from '@/lib/mode/getActiveContext';
import type { RequestsSnapshot, RequestsPaginationOptions, Request, SearchResults } from './types';
import type { RequestStatus } from './requestGrouping';

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
 * Search requests across all connections using full-text search
 * Uses search-based pagination (offset-based) instead of connection-based pagination
 */
export async function searchRequestsGlobal(
  context: EnhancedModeContext,
  options: RequestsPaginationOptions = {}
): Promise<RequestsSnapshot> {
  return await searchRequestsGlobalServer(context, options);
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

/**
 * Fetch more requests for a specific status (status-first pagination)
 * @deprecated No longer used after accordion refactor
 */
export async function fetchMoreRequestsForStatus(
  context: EnhancedModeContext,
  options: RequestsPaginationOptions & { status: RequestStatus }
): Promise<RequestsSnapshot> {
  return await getRequestsSnapshotForStatus(context, options.status, options);
}

/**
 * Fetch requests flat (single pagination axis - MVP)
 * @deprecated No longer used after accordion refactor. Use fetchRequestsForClientStatus instead.
 */
export async function fetchRequestsFlat(
  context: EnhancedModeContext,
  options: RequestsPaginationOptions
): Promise<RequestsSnapshot> {
  return await getRequestsFlat(context, options);
}

/**
 * Fetch requests counts (minimal metadata for accurate header counts)
 * Returns status counts and client counts without fetching request rows
 */
export async function fetchRequestsCounts(
  context: EnhancedModeContext,
  options: { assignedToUserId?: string; createdByUserId?: string } = {}
) {
  return await getRequestsCounts(context, options);
}

/**
 * Fetch requests for a specific client organization in a specific status
 * Used for accordion fetch-on-expand pattern
 */
export async function fetchRequestsForClientStatus(
  context: EnhancedModeContext,
  clientOrgId: string,
  status: RequestStatus,
  options: { assignedToUserId?: string; createdByUserId?: string } = {}
): Promise<Request[]> {
  return await getRequestsForClientStatus(context, clientOrgId, status, options);
}

/**
 * Search clients with their requests pre-loaded (server-side search mode)
 * Returns clients matching search text with all their requests as atomic data
 * Used for fast, flicker-free search results
 */
export async function searchClientsWithRequests(
  context: EnhancedModeContext,
  searchText: string,
  options?: {
    statusFilter?: RequestStatus[];
    assignedToUserId?: string;
    createdByUserId?: string;
  }
): Promise<SearchResults> {
  return await searchClientsWithRequestsServer(context, searchText, options);
}

/**
 * Get all requests assigned to the current user, grouped by client (assigned filter mode)
 * Returns clients with their assigned requests pre-loaded as atomic data
 * Used for fast, flicker-free assigned filter results
 */
export async function fetchAssignedRequestsByClient(
  context: EnhancedModeContext,
  options?: {
    statusFilter?: RequestStatus[];
  }
): Promise<SearchResults> {
  return await getAssignedRequestsByClientServer(context, options);
}

