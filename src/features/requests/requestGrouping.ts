import type { Request } from './types'

export type RequestStatus = 'new' | 'in_review' | 'accepted' | 'closed' | 'canceled'

/**
 * Groups requests by status, then by client (agency view) or agency (client view)
 * Returns nested structure: Record<RequestStatus, Record<groupId, Request[]>>
 * Also returns all unique groups (clients or agencies) - initialized with allConnectionsMetadata
 * 
 * @param requests - Array of requests to group
 * @param allConnectionsMetadata - Map of ALL connection metadata (connectionId -> {name, logoUrl}) - RLS ENFORCED
 * @param isAgency - Whether this is agency view (true) or client view (false)
 */
export function groupRequestsByStatusAndClient(
  requests: Request[], 
  allConnectionsMetadata: Map<string, { name: string; logoUrl?: string }>,
  isAgency: boolean = true
): {
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

  // Initialize allGroups with ALL connections from metadata (ensures all groups appear even with 0 requests)
  // This is server-validated and RLS-enforced - only contains connections user has access to
  const allGroups = new Map<string, { name: string; logoUrl?: string }>(allConnectionsMetadata)

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
    if (!value || value.trim() === '') return null
    
    // Handle PostgreSQL timestamp format: "2025-12-13 17:46:27.934347+00"
    // This format uses a space instead of 'T' and may have timezone offset
    if (value.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/)) {
      // Convert PostgreSQL format to ISO format for parsing
      // Replace space with 'T' and ensure timezone is handled
      const isoFormat = value.replace(' ', 'T')
      const timestamp = Date.parse(isoFormat)
      return Number.isNaN(timestamp) ? null : timestamp
    }
    
    // If it's an ISO timestamp (contains 'T' or ends with 'Z'), parse directly
    if (value.includes('T') || value.includes('Z')) {
      const timestamp = Date.parse(value)
      return Number.isNaN(timestamp) ? null : timestamp
    }
    
    // If it's a formatted date like "13 Dec 2025" or "Dec 13, 2025", try to parse it
    const timestamp = Date.parse(value)
    if (Number.isNaN(timestamp)) {
      // Try parsing as a more explicit format
      // Format might be "DD MMM YYYY" like "13 Dec 2025" or "MMM DD, YYYY" like "Dec 13, 2025"
      const parts = value.trim().split(/[\s,]+/)
      if (parts.length === 3) {
        const [part1, part2, part3] = parts
        // Try both formats: "MMM DD, YYYY" and "DD MMM YYYY"
        const dateStr1 = `${part1} ${part2}, ${part3}` // "Dec 13, 2025"
        const dateStr2 = `${part2} ${part1}, ${part3}` // "13 Dec, 2025" (less common)
        const altTimestamp1 = Date.parse(dateStr1)
        const altTimestamp2 = Date.parse(dateStr2)
        if (!Number.isNaN(altTimestamp1)) return altTimestamp1
        if (!Number.isNaN(altTimestamp2)) return altTimestamp2
      }
      return null
    }
    
    return timestamp
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
 * Status groups are NOT virtualized (structural containers)
 * Client blocks ARE virtualized (one row per client per status)
 * Requests are nested inside client blocks (NOT virtualized)
 */
export type FlattenedItem = 
  | { type: 'status-group'; status: RequestStatus; count: number; loadedClientCount: number }
  | { type: 'client-block'; status: RequestStatus; clientId: string; clientName?: string; clientLogoUrl?: string; agencyId?: string; agencyName?: string; agencyLogoUrl?: string; requests: Request[]; count: number }

/**
 * Returns grouped requests organized by status, then by client blocks
 * Status groups are NOT virtualized (structural containers)
 * Client blocks ARE virtualized (one row per client per status)
 * Requests are nested inside client blocks (NOT virtualized)
 * 
 * CRITICAL RENDERING RULE: Only render connections in fetchedConnectionIdsByStatus[status]
 * Never derive rendered clients from allConnectionsMetadata or request presence alone
 * 
 * @param grouped - Grouped requests by status and client
 * @param allGroups - Map of all groups (initialized from allConnectionsMetadata)
 * @param collapsedStatuses - Set of collapsed status groups (not used in return, but kept for API compatibility)
 * @param collapsedClients - Map of collapsed client groups per status (not used in return, but kept for API compatibility)
 * @param allConnectionsMetadata - Map of ALL connection metadata (for security invariant check) - RLS ENFORCED
 * @param fetchedConnectionIdsByStatus - Connections that have been paginated/fetched per status (CRITICAL: determines which clients to render)
 * @param isAgency - Whether this is agency view (true) or client view (false)
 */
export function flattenGroupedRequests(
  grouped: Record<RequestStatus, Record<string, Request[]>>,
  allGroups: Map<string, { name: string; logoUrl?: string }>,
  collapsedStatuses: Set<RequestStatus>,
  collapsedClients: Map<string, Set<string>>, // Map<status, Set<groupId>>
  allConnectionsMetadata: Map<string, { name: string; logoUrl?: string }>,
  fetchedConnectionIdsByStatus: Record<RequestStatus, string[]>, // NEW: Connections fetched per status
  isAgency: boolean = true
): FlattenedItem[] {
  const items: FlattenedItem[] = []
  const statusOrder: RequestStatus[] = ['new', 'in_review', 'accepted', 'closed', 'canceled']

  // Convert allGroups map to sorted array for consistent ordering
  // This is O(n log n) but only runs when allGroups changes (memoized in component)
  // CRITICAL: Handle case where allGroups might be empty or invalid
  const sortedGroups = (allGroups && allGroups.size > 0)
    ? Array.from(allGroups.entries())
        .map(([groupId, groupInfo]) => ({
          groupId,
          groupName: groupInfo?.name || groupId,
          groupLogoUrl: groupInfo?.logoUrl
        }))
        .sort((a, b) => {
          // Sort alphabetically by group name (case-insensitive)
          return a.groupName.localeCompare(b.groupName, undefined, { sensitivity: 'base' })
        })
    : []

  for (const status of statusOrder) {
    const groupGroups = grouped[status]
    const totalCount = Object.values(groupGroups).reduce((sum, requests) => sum + requests.length, 0)
    
    // Always add status group header (NOT virtualized - structural container)
    // Note: loadedClientCount is no longer used - status header shows totalClientCount instead
    items.push({ 
      type: 'status-group', 
      status, 
      count: totalCount,
      loadedClientCount: 0 // Deprecated - use totalClientCount prop instead
    })

    // CRITICAL RENDERING RULE: Only render org IDs (groupIds) in fetchedConnectionIdsByStatus[status]
    // Server returns org IDs (groupIds), not connection IDs, so we can render directly
    // CRITICAL: Deduplicate to prevent duplicate keys (same org ID can appear multiple times if pagination overlaps)
    const fetchedOrgIds = Array.from(new Set(fetchedConnectionIdsByStatus[status] || []))
    
    // For each fetched org ID, render the client block
    // Note: fetchedOrgIds are org IDs (groupIds), which is what we group by
    const groupsToRender = fetchedOrgIds
      .filter(orgId => {
        // Only render if org ID exists in metadata (security check)
        return allConnectionsMetadata.has(orgId)
      })
      .map(orgId => {
        // Get group info from metadata or allGroups
        const groupInfo = allGroups.get(orgId) || allConnectionsMetadata.get(orgId)
        return {
          groupId: orgId,
          groupName: groupInfo?.name || orgId,
          groupLogoUrl: groupInfo?.logoUrl
        }
      })
      .sort((a, b) => a.groupName.localeCompare(b.groupName, undefined, { sensitivity: 'base' }))
    
    for (const { groupId, groupName, groupLogoUrl } of groupsToRender) {
      // Get requests for this group (may be empty array)
      const requests = groupGroups[groupId] || []
      
      // Add client block (VIRTUALIZED ROW) - contains nested requests
      // For agency view: groupId is clientId, use client info
      // For client view: groupId is agencyId, use agency info
      items.push({
        type: 'client-block',
        status,
        clientId: groupId,
        clientName: isAgency ? groupName : undefined,
        clientLogoUrl: isAgency ? groupLogoUrl : undefined,
        agencyId: !isAgency ? groupId : undefined,
        agencyName: !isAgency ? groupName : undefined,
        agencyLogoUrl: !isAgency ? groupLogoUrl : undefined,
        requests: requests, // Nested requests - may be empty array
        count: requests.length
      })
    }
  }

  return items
}

/**
 * Groups a flat ordered list of requests by detecting connection_id boundaries.
 * This is used for flat pagination where the backend returns a single ordered stream
 * and the frontend inserts client block headers when connection_id changes.
 * 
 * @param requests - Flat ordered list of requests (already sorted by status, display_name, created_at DESC)
 * @param allConnectionsMetadata - Map of ALL connection metadata (connectionId -> {name, logoUrl}) - RLS ENFORCED
 * @param isAgency - Whether this is agency view (true) or client view (false)
 * @param status - The status these requests belong to (all requests should have this status)
 */
export function flattenGroupedRequestsFromFlatList(
  requests: Request[],
  allConnectionsMetadata: Map<string, { name: string; logoUrl?: string }>,
  isAgency: boolean = true,
  status: RequestStatus
): FlattenedItem[] {
  const items: FlattenedItem[] = []
  
  if (requests.length === 0) {
    return items
  }

  // Group requests by connection_id (detect boundaries)
  const requestsByConnection = new Map<string, Request[]>()
  for (const request of requests) {
    const connectionId = request.connectionId
    if (!requestsByConnection.has(connectionId)) {
      requestsByConnection.set(connectionId, [])
    }
    requestsByConnection.get(connectionId)!.push(request)
  }

  // Determine groupId (org ID) for each connection
  // For agency view: groupId is client.id
  // For client view: groupId is agency.id
  const connectionToGroupId = new Map<string, string>()
  for (const request of requests) {
    const connectionId = request.connectionId
    if (!connectionToGroupId.has(connectionId)) {
      const groupId = isAgency ? request.client.id : (request.agency?.id || 'unknown')
      connectionToGroupId.set(connectionId, groupId)
    }
  }

  // Sort connections by their group name (display name) to maintain order
  // This matches the backend sort order (LOWER(display_org.name) ASC)
  const sortedConnections = Array.from(requestsByConnection.keys())
    .map(connectionId => {
      const groupId = connectionToGroupId.get(connectionId) || 'unknown'
      const groupInfo = allConnectionsMetadata.get(groupId)
      const groupName = isAgency 
        ? requests.find(r => r.connectionId === connectionId)?.client.name || groupInfo?.name || 'Unknown'
        : requests.find(r => r.connectionId === connectionId)?.agency?.name || groupInfo?.name || 'Unknown'
      return {
        connectionId,
        groupId,
        groupName: groupName.toLowerCase(), // For case-insensitive sorting
        requests: requestsByConnection.get(connectionId) || []
      }
    })
    .sort((a, b) => a.groupName.localeCompare(b.groupName, undefined, { sensitivity: 'base' }))

  // Build flattened items: status header + client blocks
  // Note: Status header is added by the parent component, so we only add client blocks here
  for (const { connectionId, groupId, requests: connectionRequests } of sortedConnections) {
    const request = connectionRequests[0] // Use first request to get display info
    const groupInfo = allConnectionsMetadata.get(groupId)
    
    items.push({
      type: 'client-block',
      status,
      clientId: isAgency ? groupId : undefined,
      clientName: isAgency ? (request.client.name || groupInfo?.name) : undefined,
      clientLogoUrl: isAgency ? (request.client.logoUrl || groupInfo?.logoUrl) : undefined,
      agencyId: !isAgency ? groupId : undefined,
      agencyName: !isAgency ? (request.agency?.name || groupInfo?.name) : undefined,
      agencyLogoUrl: !isAgency ? (request.agency?.logoUrl || groupInfo?.logoUrl) : undefined,
      requests: connectionRequests, // Requests for this connection
      count: connectionRequests.length
    })
  }

  return items
}

