import type { Task } from './types'

export type TaskStatus = 'to_do' | 'in_progress' | 'on_hold' | 'done'

/**
 * Groups tasks by status, then by client (agency view) or agency (client view)
 * Returns nested structure: Record<TaskStatus, Record<groupId, Task[]>>
 * Also returns all unique groups (clients or agencies) across all tasks
 */
export function groupTasksByStatusAndClient(tasks: Task[], isAgency: boolean = true): {
  grouped: Record<TaskStatus, Record<string, Task[]>>
  allGroups: Map<string, { name: string; logoUrl?: string }>
} {
  const grouped: Record<TaskStatus, Record<string, Task[]>> = {
    in_progress: {},
    to_do: {},
    on_hold: {},
    done: {}
  }

  // Track all unique groups (clients for agency view, agencies for client view)
  const allGroups = new Map<string, { name: string; logoUrl?: string }>()

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
 */
export type FlattenedItem = 
  | { type: 'status-group'; status: TaskStatus; count: number }
  | { type: 'client-group'; status: TaskStatus; clientId: string; clientName?: string; clientLogoUrl?: string; agencyId?: string; agencyName?: string; agencyLogoUrl?: string; count: number }
  | { type: 'task'; task: Task }

/**
 * Flattens grouped tasks into a flat array for virtualization
 * Status order: In progress, To do, On hold, Done
 * Shows ALL groups (clients or agencies) in each status section, even if they have 0 tasks
 * 
 * Optimized: Sorted groups are computed efficiently and can be memoized
 * by the caller if needed (e.g., using useMemo with allGroups as dependency)
 */
export function flattenGroupedTasks(
  grouped: Record<TaskStatus, Record<string, Task[]>>,
  allGroups: Map<string, { name: string; logoUrl?: string }>,
  collapsedStatuses: Set<TaskStatus>,
  collapsedClients: Map<string, Set<string>>, // Map<status, Set<groupId>>
  isAgency: boolean = true
): FlattenedItem[] {
  const items: FlattenedItem[] = []
  const statusOrder: TaskStatus[] = ['in_progress', 'to_do', 'on_hold', 'done']

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
    const totalCount = Object.values(groupGroups).reduce((sum, tasks) => sum + tasks.length, 0)

    // Always add status group header
    items.push({ type: 'status-group', status, count: totalCount })

    // Only add group groups and tasks if status group is not collapsed
    if (!collapsedStatuses.has(status)) {
      // Get collapsed groups for this status
      const collapsedGroupsForStatus = collapsedClients.get(status) || new Set<string>()

      // Show ALL groups for this status (even if they have 0 tasks)
      for (const { groupId, groupName, groupLogoUrl } of sortedGroups) {
        const tasks = groupGroups[groupId] || []
        
        // Always add client group header (even if 0 tasks)
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
          count: tasks.length
        })

        // Add tasks if group is not collapsed
        if (!collapsedGroupsForStatus.has(groupId)) {
          for (const task of tasks) {
            items.push({ type: 'task', task })
          }
        }
      }
    }
  }

  return items
}

