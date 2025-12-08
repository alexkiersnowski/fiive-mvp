import type { Request } from '../server'

export type RequestStatus = 'new' | 'in_review' | 'accepted' | 'closed' | 'canceled'

const STATUS_PRIORITY: Record<RequestStatus, number> = {
  new: 0,
  in_review: 1,
  accepted: 2,
  closed: 3,
  canceled: 4
}

const parseDate = (value?: string | null): number | null => {
  if (!value) return null
  const timestamp = Date.parse(value)
  return Number.isNaN(timestamp) ? null : timestamp
}

const getCreatedTimestamp = (request: Request): number | null => {
  return parseDate(request.createdAt)
}

/**
 * Compare requests by created_at (newest → oldest)
 */
export const compareRequestsByNewest = (a: Request, b: Request): number => {
  const aCreated = getCreatedTimestamp(a)
  const bCreated = getCreatedTimestamp(b)

  if (aCreated !== null && bCreated !== null && aCreated !== bCreated) {
    return bCreated - aCreated // newest first (descending)
  }

  if (aCreated !== null && bCreated === null) return -1
  if (aCreated === null && bCreated !== null) return 1

  // Fallback to ID for stable sort
  if (a.id < b.id) return -1
  if (a.id > b.id) return 1
  return 0
}

/**
 * Groups requests by status and sorts within each group
 * Status order: new, in_review, accepted, closed, canceled
 * Within each group, requests are sorted by created_at DESC (newest first)
 */
export const groupRequestsByStatus = (requests: Request[]): Record<RequestStatus, Request[]> => {
  const groups: Record<RequestStatus, Request[]> = {
    new: [],
    in_review: [],
    accepted: [],
    closed: [],
    canceled: []
  }

  // Group requests by status
  for (const request of requests) {
    groups[request.status].push(request)
  }

  // Sort requests within each group by created_at DESC (newest first)
  for (const status in groups) {
    groups[status as RequestStatus].sort(compareRequestsByNewest)
  }

  return groups
}

export type { Request }

