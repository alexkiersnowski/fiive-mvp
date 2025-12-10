import type { Task } from './types'

export type TaskStatus = 'to_do' | 'in_progress' | 'on_hold' | 'done'

/**
 * Groups tasks by status, then by client
 * Returns nested structure: Record<TaskStatus, Record<clientId, Task[]>>
 * Also returns all unique clients across all tasks
 */
export function groupTasksByStatusAndClient(tasks: Task[]): {
  grouped: Record<TaskStatus, Record<string, Task[]>>
  allClients: Map<string, { name: string; logoUrl?: string }>
} {
  const grouped: Record<TaskStatus, Record<string, Task[]>> = {
    in_progress: {},
    to_do: {},
    on_hold: {},
    done: {}
  }

  // Track all unique clients across all tasks
  const allClients = new Map<string, { name: string; logoUrl?: string }>()

  for (const task of tasks) {
    const status = task.status
    const clientId = task.client.id

    // Track client info
    if (!allClients.has(clientId)) {
      allClients.set(clientId, {
        name: task.client.name,
        logoUrl: task.client.logoUrl
      })
    }

    if (!grouped[status][clientId]) {
      grouped[status][clientId] = []
    }

    grouped[status][clientId].push(task)
  }

  // Sort tasks within each client group by created_at (newest first)
  for (const status of Object.keys(grouped) as TaskStatus[]) {
    for (const clientId of Object.keys(grouped[status])) {
      grouped[status][clientId].sort((a, b) => {
        const aTime = a.createdAtRaw ? new Date(a.createdAtRaw).getTime() : 0
        const bTime = b.createdAtRaw ? new Date(b.createdAtRaw).getTime() : 0
        return bTime - aTime // Descending (newest first)
      })
    }
  }

  return { grouped, allClients }
}

/**
 * Flattened item types for virtualization
 */
export type FlattenedItem = 
  | { type: 'status-group'; status: TaskStatus; count: number }
  | { type: 'client-group'; status: TaskStatus; clientId: string; clientName: string; clientLogoUrl?: string; count: number }
  | { type: 'task'; task: Task }

/**
 * Flattens grouped tasks into a flat array for virtualization
 * Status order: In progress, To do, On hold, Done
 * Shows ALL clients in each status section, even if they have 0 tasks
 * 
 * Optimized: Sorted clients are computed efficiently and can be memoized
 * by the caller if needed (e.g., using useMemo with allClients as dependency)
 */
export function flattenGroupedTasks(
  grouped: Record<TaskStatus, Record<string, Task[]>>,
  allClients: Map<string, { name: string; logoUrl?: string }>,
  collapsedStatuses: Set<TaskStatus>,
  collapsedClients: Map<string, Set<string>> // Map<status, Set<clientId>>
): FlattenedItem[] {
  const items: FlattenedItem[] = []
  const statusOrder: TaskStatus[] = ['in_progress', 'to_do', 'on_hold', 'done']

  // Convert allClients map to sorted array for consistent ordering
  // This is O(n log n) but only runs when allClients changes (memoized in component)
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
    const totalCount = Object.values(clientGroups).reduce((sum, tasks) => sum + tasks.length, 0)

    // Always add status group header
    items.push({ type: 'status-group', status, count: totalCount })

    // Only add client groups and tasks if status group is not collapsed
    if (!collapsedStatuses.has(status)) {
      // Get collapsed clients for this status
      const collapsedClientsForStatus = collapsedClients.get(status) || new Set<string>()

      // Show ALL clients for this status (even if they have 0 tasks)
      for (const { clientId, clientName, clientLogoUrl } of sortedClients) {
        const tasks = clientGroups[clientId] || []
        
        // Always add client group header (even if 0 tasks)
        items.push({
          type: 'client-group',
          status,
          clientId,
          clientName,
          clientLogoUrl,
          count: tasks.length
        })

        // Add tasks if client group is not collapsed
        if (!collapsedClientsForStatus.has(clientId)) {
          for (const task of tasks) {
            items.push({ type: 'task', task })
          }
        }
      }
    }
  }

  return items
}

