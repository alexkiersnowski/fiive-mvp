import type { Request } from './types'

export type RequestStatus = 'new' | 'in_review' | 'accepted' | 'closed' | 'canceled'

/**
 * Groups requests by status, then by client (agency view) or agency (client view)
 * Returns nested structure: Record<RequestStatus, Record<groupId, Request[]>>
 * Also returns all unique groups (clients or agencies) across all requests
 */
export function groupRequestsByStatusAndClient(requests: Request[], isAgency: boolean = true): {
  grouped: Record<RequestStatus, Record<string, Request[]>>
  allGroups: Map<string, { name: string; logoUrl?: string }>
} {
  const grouped: Record<RequestStatus, Record<string, Request[]>> = {
    new: {},
    in_review: {},
    accepted: {},
    closed: {},
    canceled: {}
  }

  // Track all unique groups (clients for agency view, agencies for client view)
  const allGroups = new Map<string, { name: string; logoUrl?: string }>()

  for (const request of requests) {
    const status = request.status
    // For agency view: group by client_id (from connection), for client view: group by agency_id (from connection)
    // request.client.id is the connection's client_id
    // request.agency?.id is the connection's agency_id (should always be present for valid connections)
    const groupId = isAgency ? request.client.id : (request.agency?.id || 'unknown')
    const groupName = isAgency ? request.client.name : (request.agency?.name || 'Unknown')
    const groupLogoUrl = isAgency ? request.client.logoUrl : request.agency?.logoUrl

    // Skip requests without required grouping info (shouldn't happen for valid connections)
    if (!groupId || groupId === 'unknown') {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('Request missing required grouping info:', { requestId: request.id, connectionId: request.connectionId, isAgency })
      }
      continue
    }

    // Track group info
    if (!allGroups.has(groupId)) {
      allGroups.set(groupId, {
        name: groupName,
        logoUrl: groupLogoUrl
      })
    }

    if (!grouped[status][groupId]) {
      grouped[status][groupId] = []
    }

    grouped[status][groupId].push(request)
  }

  // Sort requests within each client group by created_at (newest first)
  // Parse createdAt string to timestamp for comparison
  const parseDate = (value?: string | null): number | null => {
    if (!value) return null
    const timestamp = Date.parse(value)
    return Number.isNaN(timestamp) ? null : timestamp
  }

  for (const status of Object.keys(grouped) as RequestStatus[]) {
    for (const clientId of Object.keys(grouped[status])) {
      grouped[status][clientId].sort((a, b) => {
        const aCreated = parseDate(a.createdAt)
        const bCreated = parseDate(b.createdAt)

        if (aCreated !== null && bCreated !== null && aCreated !== bCreated) {
          return bCreated - aCreated // newest first (descending)
        }

        if (aCreated !== null && bCreated === null) return -1
        if (aCreated === null && bCreated !== null) return 1

        // Fallback to ID for stable sort
        if (a.id < b.id) return -1
        if (a.id > b.id) return 1
        return 0
      })
    }
  }

  return { grouped, allGroups }
}

/**
 * Flattened item types for virtualization
 */
export type FlattenedItem = 
  | { type: 'status-group'; status: RequestStatus; count: number }
  | { type: 'client-group'; status: RequestStatus; clientId: string; clientName?: string; clientLogoUrl?: string; agencyId?: string; agencyName?: string; agencyLogoUrl?: string; count: number }
  | { type: 'request'; request: Request }

/**
 * Flattens grouped requests into a flat array for virtualization
 * Status order: New, In Review, Accepted, Closed, Canceled
 * Shows ALL groups (clients or agencies) in each status section, even if they have 0 requests
 * 
 * Optimized: Sorted groups are computed efficiently and can be memoized
 * by the caller if needed (e.g., using useMemo with allGroups as dependency)
 */
export function flattenGroupedRequests(
  grouped: Record<RequestStatus, Record<string, Request[]>>,
  allGroups: Map<string, { name: string; logoUrl?: string }>,
  collapsedStatuses: Set<RequestStatus>,
  collapsedClients: Map<string, Set<string>>, // Map<status, Set<groupId>>
  isAgency: boolean = true
): FlattenedItem[] {
  const items: FlattenedItem[] = []
  const statusOrder: RequestStatus[] = ['new', 'in_review', 'accepted', 'closed', 'canceled']

  // Convert allGroups map to sorted array for consistent ordering
  // This is O(n log n) but only runs when allGroups changes (memoized in component)
  const sortedGroups = Array.from(allGroups.entries())
    .map(([groupId, groupInfo]) => ({
      groupId,
      groupName: groupInfo.name,
      groupLogoUrl: groupInfo.logoUrl
    }))
    .sort((a, b) => {
      // Sort alphabetically by group name (case-insensitive)
      return a.groupName.localeCompare(b.groupName, undefined, { sensitivity: 'base' })
    })

  for (const status of statusOrder) {
    const groupGroups = grouped[status]
    const totalCount = Object.values(groupGroups).reduce((sum, requests) => sum + requests.length, 0)

    // Always add status group header
    items.push({ type: 'status-group', status, count: totalCount })

    // Only add group groups and requests if status group is not collapsed
    if (!collapsedStatuses.has(status)) {
      // Get collapsed groups for this status
      const collapsedGroupsForStatus = collapsedClients.get(status) || new Set<string>()

      // Show ALL groups for this status (even if they have 0 requests)
      for (const { groupId, groupName, groupLogoUrl } of sortedGroups) {
        const requests = groupGroups[groupId] || []
        
        // Always add client group header (even if 0 requests)
        // For agency view: groupId is clientId, use client info
        // For client view: groupId is agencyId, use agency info
        items.push({
          type: 'client-group',
          status,
          clientId: groupId,
          clientName: isAgency ? groupName : undefined,
          clientLogoUrl: isAgency ? groupLogoUrl : undefined,
          agencyId: !isAgency ? groupId : undefined,
          agencyName: !isAgency ? groupName : undefined,
          agencyLogoUrl: !isAgency ? groupLogoUrl : undefined,
          count: requests.length
        })

        // Add requests if group is not collapsed
        if (!collapsedGroupsForStatus.has(groupId)) {
          for (const request of requests) {
            items.push({ type: 'request', request })
          }
        }
      }
    }
  }

  return items
}

