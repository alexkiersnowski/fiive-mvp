import type { Request } from '../server'

// Draft type matching what optimisticTracker stores
// Use Pick to derive status/title/description from Request (can't drift)
// assignee_user_id/project_id aren't on Request type, so include separately
type RequestDraft = Partial<Pick<Request, 'status' | 'title' | 'description'>> & {
  assignee_user_id?: string | null
  project_id?: string | null
}

/**
 * Merge optimistic draft state into fetched request (only patchable fields)
 * Only merges fields that are actually patched in updateRequest()
 * Don't rebuild nested objects - set to null or preserve existing. Realtime will fill.
 */
export function mergeDraftIntoRequest(request: Request, draft: RequestDraft): Request {
  const merged = { ...request }
  
  // Only merge known patchable fields (don't override server timestamps, etc.)
  if (draft.status !== undefined) {
    merged.status = draft.status // Pick<Request, 'status'> already gives us Request['status']
  }
  
  if (draft.title !== undefined) {
    merged.title = draft.title
  }
  
  if (draft.description !== undefined) {
    merged.description = draft.description
  }
  
  // assignee_user_id → assignee object
  // If ID is null, set assignee to null
  // If ID changes, set assignee to null (realtime will fill the object)
  // If ID matches existing, preserve existing assignee object
  if (draft.assignee_user_id !== undefined) {
    if (draft.assignee_user_id === null) {
      merged.assignee = null
    } else if (merged.assignee?.id !== draft.assignee_user_id) {
      // ID changed - set to null, realtime will fill
      merged.assignee = null
    }
    // If ID matches existing, preserve assignee object (no change needed)
  }
  
  // project_id → project object
  // If ID is null, set project to null
  // If ID changes, set project to null (realtime will fill the object)
  // If ID matches existing, preserve existing project object
  if (draft.project_id !== undefined) {
    if (draft.project_id === null) {
      merged.project = null
    } else if (merged.project?.id !== draft.project_id) {
      // ID changed - set to null, realtime will fill
      merged.project = null
    }
    // If ID matches existing, preserve project object (no change needed)
  }
  
  return merged
}

