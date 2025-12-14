import type { Task, TaskStatus } from '../server'

const parseDate = (value?: string | null): number | null => {
  if (!value) return null
  const timestamp = Date.parse(value)
  return Number.isNaN(timestamp) ? null : timestamp
}

const getCreatedTimestamp = (task: Task): number | null => {
  const fromRaw = parseDate(task.createdAtRaw)
  if (fromRaw !== null) return fromRaw
  return parseDate(task.createdAt)
}

export const sortTasksWithPinnedFirst = (tasks: Task[]): Task[] => {
  if (tasks.length <= 1) {
    return tasks.slice()
  }

  const pinned: Task[] = []
  const regular: Task[] = []

  for (const task of tasks) {
    if (task.isPinned) {
      pinned.push(task)
    } else {
      regular.push(task)
    }
  }

  if (pinned.length === 0) {
    return regular
  }

  // Regular tasks are already sorted by server (status, then created_at DESC)
  // Just prepend pinned tasks
  return [...pinned, ...regular]
}

/**
 * Groups tasks by status and sorts within each group by created_at DESC
 * Status order: in_progress, to_do, on_hold, done
 * Within each group, tasks are sorted by created_at DESC (newest first)
 */
export const groupTasksByStatus = (tasks: Task[]): Record<TaskStatus, Task[]> => {
  const groups: Record<TaskStatus, Task[]> = {
    in_progress: [],
    to_do: [],
    on_hold: [],
    done: []
  }

  // Debug logging for status grouping
  if (process.env.NODE_ENV !== 'production') {
    const statusCounts = tasks.reduce((acc, task) => {
      acc[task.status] = (acc[task.status] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    console.log('[groupTasksByStatus] Grouping tasks', {
      totalTasks: tasks.length,
      statusCounts,
      taskStatuses: tasks.map(t => ({ id: t.id, status: t.status }))
    })
  }

  // Group tasks by status
  for (const task of tasks) {
    const status = task.status
    if (!groups[status]) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[groupTasksByStatus] Unknown status:', status, 'for task:', task.id)
      }
      // Fallback: treat unknown status as 'to_do'
      groups['to_do'].push(task)
    } else {
      groups[status].push(task)
    }
  }

  // Sort tasks within each group by created_at DESC (newest first)
  for (const status in groups) {
    groups[status as TaskStatus].sort((a, b) => {
      const aCreated = getCreatedTimestamp(a)
      const bCreated = getCreatedTimestamp(b)
      
      if (aCreated !== null && bCreated !== null) {
        return bCreated - aCreated // Descending (newest first)
      }
      if (aCreated !== null && bCreated === null) return -1
      if (aCreated === null && bCreated !== null) return 1
      return 0
    })
  }

  if (process.env.NODE_ENV !== 'production') {
    console.log('[groupTasksByStatus] Grouped result', {
      in_progress: groups.in_progress.length,
      to_do: groups.to_do.length,
      on_hold: groups.on_hold.length,
      done: groups.done.length
    })
  }

  return groups
}

export type { Task }


