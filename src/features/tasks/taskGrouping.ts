import type { Task } from './types'

export type TaskStatus = 'to_do' | 'in_progress' | 'on_hold' | 'done'

/**
 * Groups tasks by status, then by client (agency view) or agency (client view)
 * Returns nested structure: Record<TaskStatus, Record<groupId, Task[]>>
 * Also returns all unique groups (clients or agencies) - initialized with allConnectionsMetadata
 * 
 * @param tasks - Array of tasks to group
 * @param allConnectionsMetadata - Map of ALL connection metadata (connectionId -> {name, logoUrl}) - RLS ENFORCED
 * @param isAgency - Whether this is agency view (true) or client view (false)
 */
export function groupTasksByStatusAndClient(
  tasks: Task[], 
  allConnectionsMetadata: Map<string, { name: string; logoUrl?: string }>,
  isAgency: boolean = true
): {
  grouped: Record<TaskStatus, Record<string, Task[]>>
  allGroups: Map<string, { name: string; logoUrl?: string }>
} {
  const grouped: Record<TaskStatus, Record<string, Task[]>> = {
    in_progress: {},
    to_do: {},
    on_hold: {},
    done: {}
  }

  // Initialize allGroups with ALL connections from metadata (ensures all groups appear even with 0 tasks)
  // This is server-validated and RLS-enforced - only contains connections user has access to
  const allGroups = new Map<string, { name: string; logoUrl?: string }>(allConnectionsMetadata)

  for (const task of tasks) {
    const status = task.status
    // For agency view: group by client_id (from connection), for client view: group by agency_id (from connection)
    // task.client.id is the connection's client_id
    // task.agency?.id is the connection's agency_id (should always be present for valid connections)
    const groupId = isAgency ? task.client.id : (task.agency?.id || 'unknown')
    const groupName = isAgency ? task.client.name : (task.agency?.name || 'Unknown')
    const groupLogoUrl = isAgency ? task.client.logoUrl : task.agency?.logoUrl

    // Skip tasks without required grouping info (shouldn't happen for valid connections)
    if (!groupId || groupId === 'unknown') {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('Task missing required grouping info:', { taskId: task.id, connectionId: task.connectionId, isAgency })
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

    grouped[status][groupId].push(task)
  }

  // Sort tasks within each group by created_at (newest first)
  for (const status of Object.keys(grouped) as TaskStatus[]) {
    for (const groupId of Object.keys(grouped[status])) {
      grouped[status][groupId].sort((a, b) => {
        const aTime = a.createdAtRaw ? new Date(a.createdAtRaw).getTime() : 0
        const bTime = b.createdAtRaw ? new Date(b.createdAtRaw).getTime() : 0
        return bTime - aTime // Descending (newest first)
      })
    }
  }

  return { grouped, allGroups }
}

/**
 * Flattened item types for virtualization
 * Status groups are NOT virtualized (structural containers)
 * Client blocks ARE virtualized (one row per client per status)
 * Tasks are nested inside client blocks (NOT virtualized)
 */
export type FlattenedItem = 
  | { type: 'status-group'; status: TaskStatus; count: number; loadedClientCount: number }
  | { type: 'client-block'; status: TaskStatus; clientId: string; clientName?: string; clientLogoUrl?: string; agencyId?: string; agencyName?: string; agencyLogoUrl?: string; tasks: Task[]; count: number }

/**
 * Returns grouped tasks organized by status, then by client blocks
 * Status groups are NOT virtualized (structural containers)
 * Client blocks ARE virtualized (one row per client per status)
 * Tasks are nested inside client blocks (NOT virtualized)
 * 
 * CRITICAL RENDERING RULE: Only render org IDs (groupIds) in fetchedConnectionIdsByStatus[status]
 * Server returns org IDs (groupIds), not connection IDs, so we can render directly
 * 
 * @param grouped - Grouped tasks by status and client
 * @param allGroups - Map of all groups (initialized from allConnectionsMetadata)
 * @param collapsedStatuses - Set of collapsed status groups (not used in return, but kept for API compatibility)
 * @param collapsedClients - Map of collapsed client groups per status (not used in return, but kept for API compatibility)
 * @param allConnectionsMetadata - Map of ALL connection metadata (for security invariant check) - RLS ENFORCED
 * @param fetchedConnectionIdsByStatus - Org IDs (groupIds) that have been paginated/fetched per status (CRITICAL: determines which clients to render)
 * @param isAgency - Whether this is agency view (true) or client view (false)
 */
export function flattenGroupedTasks(
  grouped: Record<TaskStatus, Record<string, Task[]>>,
  allGroups: Map<string, { name: string; logoUrl?: string }>,
  collapsedStatuses: Set<TaskStatus>,
  collapsedClients: Map<string, Set<string>>, // Map<status, Set<groupId>>
  allConnectionsMetadata: Map<string, { name: string; logoUrl?: string }>,
  fetchedConnectionIdsByStatus: Record<TaskStatus, string[]>, // NEW: Org IDs fetched per status
  isAgency: boolean = true
): FlattenedItem[] {
  const items: FlattenedItem[] = []
  const statusOrder: TaskStatus[] = ['in_progress', 'to_do', 'on_hold', 'done']

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
    const totalCount = Object.values(groupGroups).reduce((sum, tasks) => sum + tasks.length, 0)
    
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
      // Get tasks for this group (may be empty array)
      const tasks = groupGroups[groupId] || []
      
      // Add client block (VIRTUALIZED ROW) - contains nested tasks
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
        tasks: tasks, // Nested tasks - may be empty array
        count: tasks.length
      })
    }
  }

  return items
}

