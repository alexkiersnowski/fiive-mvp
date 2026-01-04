import type { Project } from '../server'
import { formatProjectDate } from '../formatters'

// Draft type matching what optimisticTracker stores
// Project type uses 'title' (not 'name'), so draft uses 'title'
type ProjectDraft = Partial<{
  status?: 'planned' | 'active' | 'on_hold' | 'completed' | 'canceled'
  title?: string  // Project type uses 'title', maps to 'name' in DB
  description?: string
  start_date?: string | null  // ISO date string (YYYY-MM-DD)
  end_date?: string | null   // ISO date string (YYYY-MM-DD)
}>

/**
 * Merge optimistic draft state into fetched project (only patchable fields)
 * Only merges fields that are actually patchable
 * Don't rebuild nested objects - set to null or preserve existing. Realtime will fill.
 */
export function mergeDraftIntoProject(project: Project, draft: ProjectDraft): Project {
  const merged = { ...project }
  
  // Only merge known patchable fields (don't override server timestamps, etc.)
  if (draft.status !== undefined) {
    merged.status = draft.status
  }
  
  if (draft.title !== undefined) {
    merged.title = draft.title
  }
  
  if (draft.description !== undefined) {
    merged.description = draft.description
  }
  
  // start_date → startDate (format ISO string to display format)
  if (draft.start_date !== undefined) {
    merged.startDate = formatProjectDate(draft.start_date)
  }
  
  // end_date → endDate (format ISO string to display format)
  if (draft.end_date !== undefined) {
    merged.endDate = formatProjectDate(draft.end_date)
  }
  
  // NOTE: NO assignee merging - field doesn't exist in DB
  
  return merged
}

