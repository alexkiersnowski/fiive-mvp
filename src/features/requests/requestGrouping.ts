import type { Request } from './types'

export type RequestStatus = 'new' | 'in_review' | 'accepted' | 'closed' | 'canceled'

/**
 * Groups requests by status, then by client
 * Returns nested structure: Record<RequestStatus, Record<clientId, Request[]>>
 * Also returns all unique clients across all requests
 */
export function groupRequestsByStatusAndClient(requests: Request[]): {
  grouped: Record<RequestStatus, Record<string, Request[]>>
  allClients: Map<string, { name: string; logoUrl?: string }>
} {
  const grouped: Record<RequestStatus, Record<string, Request[]>> = {
    new: {},
    in_review: {},
    accepted: {},
    closed: {},
    canceled: {}
  }

  // Track all unique clients across all requests
  const allClients = new Map<string, { name: string; logoUrl?: string }>()

  for (const request of requests) {
    const status = request.status
    const clientId = request.client.id

    // Track client info
    if (!allClients.has(clientId)) {
      allClients.set(clientId, {
        name: request.client.name,
        logoUrl: request.client.logoUrl
      })
    }

    if (!grouped[status][clientId]) {
      grouped[status][clientId] = []
    }

    grouped[status][clientId].push(request)
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

  return { grouped, allClients }
}

/**
 * Flattened item types for virtualization
 */
export type FlattenedItem = 
  | { type: 'status-group'; status: RequestStatus; count: number }
  | { type: 'client-group'; status: RequestStatus; clientId: string; clientName: string; clientLogoUrl?: string; count: number }
  | { type: 'request'; request: Request }

/**
 * Flattens grouped requests into a flat array for virtualization
 * Status order: New, In Review, Accepted, Closed, Canceled
 * Shows ALL clients in each status section, even if they have 0 requests
 */
export function flattenGroupedRequests(
  grouped: Record<RequestStatus, Record<string, Request[]>>,
  allClients: Map<string, { name: string; logoUrl?: string }>,
  collapsedStatuses: Set<RequestStatus>,
  collapsedClients: Map<string, Set<string>> // Map<status, Set<clientId>>
): FlattenedItem[] {
  const items: FlattenedItem[] = []
  const statusOrder: RequestStatus[] = ['new', 'in_review', 'accepted', 'closed', 'canceled']

  // Convert allClients map to sorted array for consistent ordering
  const sortedClients = Array.from(allClients.entries())
    .map(([clientId, clientInfo]) => ({
      clientId,
      clientName: clientInfo.name,
      clientLogoUrl: clientInfo.logoUrl
    }))
    .sort((a, b) => {
      // Sort alphabetically by client name (case-insensitive)
      return a.clientName.localeCompare(b.clientName, undefined, { sensitivity: 'base' })
    })

  for (const status of statusOrder) {
    const clientGroups = grouped[status]
    const totalCount = Object.values(clientGroups).reduce((sum, requests) => sum + requests.length, 0)

    // Always add status group header
    items.push({ type: 'status-group', status, count: totalCount })

    // Only add client groups and requests if status group is not collapsed
    if (!collapsedStatuses.has(status)) {
      // Get collapsed clients for this status
      const collapsedClientsForStatus = collapsedClients.get(status) || new Set<string>()

      // Show ALL clients for this status (even if they have 0 requests)
      for (const { clientId, clientName, clientLogoUrl } of sortedClients) {
        const requests = clientGroups[clientId] || []
        
        // Always add client group header (even if 0 requests)
        items.push({
          type: 'client-group',
          status,
          clientId,
          clientName,
          clientLogoUrl,
          count: requests.length
        })

        // Add requests if client group is not collapsed
        if (!collapsedClientsForStatus.has(clientId)) {
          for (const request of requests) {
            items.push({ type: 'request', request })
          }
        }
      }
    }
  }

  return items
}

