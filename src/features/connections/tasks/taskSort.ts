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

  // Group tasks by status
  for (const task of tasks) {
    groups[task.status].push(task)
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

  return groups
}

export type { Task }


