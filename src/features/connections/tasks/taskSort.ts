import type { Task, TaskStatus } from '../server'

export type TaskSortMode = 'newest' | 'status'

const STATUS_PRIORITY: Record<TaskStatus, number> = {
  in_progress: 0,
  to_do: 1,
  on_hold: 2,
  done: 3
}

const MAX_PRIORITY = Number.MAX_SAFE_INTEGER

const parseDate = (value?: string | null): number | null => {
  if (!value) return null
  const timestamp = Date.parse(value)
  return Number.isNaN(timestamp) ? null : timestamp
}

const getDueTimestamp = (task: Task): number | null => {
  const fromRaw = parseDate(task.dueDateRaw)
  if (fromRaw !== null) return fromRaw
  return parseDate(task.dueDate)
}

const getCreatedTimestamp = (task: Task): number | null => {
  const fromRaw = parseDate(task.createdAtRaw)
  if (fromRaw !== null) return fromRaw
  return parseDate(task.createdAt)
}

const getCompletedTimestamp = (task: Task): number | null => {
  const fromRaw = parseDate(task.completedAtRaw)
  if (fromRaw !== null) return fromRaw
  return parseDate(task.completedAt)
}

const getStatusPriority = (status: TaskStatus): number => {
  return STATUS_PRIORITY[status] ?? MAX_PRIORITY
}

const comparePinned = (a: Task, b: Task): number => {
  const aPinned = Boolean(a.isPinned)
  const bPinned = Boolean(b.isPinned)
  if (aPinned && !bPinned) return -1
  if (!aPinned && bPinned) return 1
  return 0
}

export const compareTasksByStatus = (a: Task, b: Task): number => {
  const pinnedDiff = comparePinned(a, b)
  if (pinnedDiff !== 0) return pinnedDiff

  // Separate Done tasks from non-Done tasks
  const aIsDone = a.status === 'done'
  const bIsDone = b.status === 'done'
  
  // If one is Done and one isn't, Done always goes last
  if (aIsDone && !bIsDone) return 1
  if (!aIsDone && bIsDone) return -1
  
  // If both are Done, sort by completed_at (newest → oldest)
  if (aIsDone && bIsDone) {
    const aCompleted = getCompletedTimestamp(a)
    const bCompleted = getCompletedTimestamp(b)
    
    if (aCompleted !== null && bCompleted !== null) {
      return bCompleted - aCompleted // newest first (descending)
    }
    if (aCompleted !== null && bCompleted === null) return -1
    if (aCompleted === null && bCompleted !== null) return 1
    // Both null - fallback to created_at (newest → oldest)
    const aCreated = getCreatedTimestamp(a)
    const bCreated = getCreatedTimestamp(b)
    if (aCreated !== null && bCreated !== null) {
      return bCreated - aCreated
    }
    return 0
  }

  // Both are non-Done: use status priority
  const statusDiff = getStatusPriority(a.status) - getStatusPriority(b.status)
  if (statusDiff !== 0) return statusDiff

  const aDue = getDueTimestamp(a)
  const bDue = getDueTimestamp(b)

  if (aDue !== null && bDue !== null && aDue !== bDue) {
    return aDue - bDue
  }

  if (aDue !== null && bDue === null) return -1
  if (aDue === null && bDue !== null) return 1

  return compareTasksByNewest(a, b)
}

export const compareTasksByNewest = (a: Task, b: Task): number => {
  const pinnedDiff = comparePinned(a, b)
  if (pinnedDiff !== 0) return pinnedDiff

  // Separate Done tasks from non-Done tasks
  const aIsDone = a.status === 'done'
  const bIsDone = b.status === 'done'
  
  // If one is Done and one isn't, Done always goes last
  if (aIsDone && !bIsDone) return 1
  if (!aIsDone && bIsDone) return -1
  
  // If both are Done, sort by completed_at (newest → oldest)
  if (aIsDone && bIsDone) {
    const aCompleted = getCompletedTimestamp(a)
    const bCompleted = getCompletedTimestamp(b)
    
    if (aCompleted !== null && bCompleted !== null) {
      return bCompleted - aCompleted // newest first (descending)
    }
    if (aCompleted !== null && bCompleted === null) return -1
    if (aCompleted === null && bCompleted !== null) return 1
    // Both null - fallback to created_at (newest → oldest)
    const aCreated = getCreatedTimestamp(a)
    const bCreated = getCreatedTimestamp(b)
    if (aCreated !== null && bCreated !== null) {
      return bCreated - aCreated
    }
    return 0
  }

  // Both are non-Done: sort by created_at (newest → oldest)
  const aCreated = getCreatedTimestamp(a)
  const bCreated = getCreatedTimestamp(b)

  if (aCreated !== null && bCreated !== null && aCreated !== bCreated) {
    return bCreated - aCreated
  }

  if (aCreated !== null && bCreated === null) return -1
  if (aCreated === null && bCreated !== null) return 1

  const statusDiff = getStatusPriority(a.status) - getStatusPriority(b.status)
  if (statusDiff !== 0) return statusDiff

  const aDue = getDueTimestamp(a)
  const bDue = getDueTimestamp(b)

  if (aDue !== null && bDue !== null && aDue !== bDue) {
    return aDue - bDue
  }

  if (aDue !== null && bDue === null) return -1
  if (aDue === null && bDue !== null) return 1

  if (a.id < b.id) return -1
  if (a.id > b.id) return 1
  return 0
}

export const getTaskComparator = (mode: TaskSortMode) => {
  return mode === 'status' ? compareTasksByStatus : compareTasksByNewest
}

export const sortTasks = (tasks: Task[], mode: TaskSortMode = 'status'): Task[] => {
  return [...tasks].sort(getTaskComparator(mode))
}

export const sortTasksWithPinnedFirst = (tasks: Task[], mode: TaskSortMode = 'status'): Task[] => {
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
    return sortTasks(regular, mode)
  }

  const sortedRegular = sortTasks(regular, mode)
  return [...pinned, ...sortedRegular]
}

/**
 * Groups tasks by status and sorts within each group
 * Status order: in_progress, to_do, on_hold, done
 * Within each group, tasks are sorted by the provided mode (default: created_at DESC)
 */
export const groupTasksByStatus = (tasks: Task[], mode: TaskSortMode = 'status'): Record<TaskStatus, Task[]> => {
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

  // Sort tasks within each group
  // For status mode, use compareTasksByNewest within each group (created_at DESC)
  // For newest mode, use compareTasksByNewest
  const comparator = mode === 'status' ? compareTasksByNewest : getTaskComparator(mode)
  
  for (const status in groups) {
    groups[status as TaskStatus].sort(comparator)
  }

  return groups
}

export type { Task }


