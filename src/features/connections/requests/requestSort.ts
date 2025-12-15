import type { Request } from '../server'

export type RequestStatus = 'new' | 'in_review' | 'accepted' | 'closed' | 'canceled'

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
  
  // If it's a formatted date like "13 Dec 2025", try to parse it
  // Date.parse() should handle this format, but if it fails, return null
  const timestamp = Date.parse(value)
  if (Number.isNaN(timestamp)) {
    // Try parsing as a more explicit format
    // Format is typically "DD MMM YYYY" like "13 Dec 2025"
    const parts = value.trim().split(' ')
    if (parts.length === 3) {
      const [day, month, year] = parts
      // Try creating a date with explicit format
      const dateStr = `${month} ${day}, ${year}`
      const altTimestamp = Date.parse(dateStr)
      return Number.isNaN(altTimestamp) ? null : altTimestamp
    }
    return null
  }
  
  return timestamp
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
 * Sort requests by status ASC, then created_at DESC, then id DESC
 * This matches the database query ordering
 */
export const sortRequestsForDisplay = (requests: Request[]): Request[] => {
  const statusOrder: Record<RequestStatus, number> = {
    new: 0,
    in_review: 1,
    accepted: 2,
    closed: 3,
    canceled: 4
  }
  
  return [...requests].sort((a, b) => {
    // First sort by status
    const statusDiff = statusOrder[a.status] - statusOrder[b.status]
    if (statusDiff !== 0) return statusDiff
    
    // Then by created_at DESC (newest first)
    const aCreated = getCreatedTimestamp(a)
    const bCreated = getCreatedTimestamp(b)
    
    if (aCreated !== null && bCreated !== null && aCreated !== bCreated) {
      return bCreated - aCreated // newest first (descending)
    }
    
    if (aCreated !== null && bCreated === null) return -1
    if (aCreated === null && bCreated !== null) return 1
    
    // Finally by id DESC for stable sort
    if (a.id < b.id) return 1
    if (a.id > b.id) return -1
    return 0
  })
}

/**
 * Groups requests by status and sorts within each group
 * Status order: new, in_review, accepted, closed, canceled
 * Within each group, requests are sorted by created_at DESC (newest first)
 * 
 * Note: Input requests should already be sorted, but this function ensures
 * correct ordering within each group as a safeguard.
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

