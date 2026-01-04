// Types imported but not directly used - kept for type references in comments
// import type { Task, Request } from '../server'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'

// Module-level singletons
type PendingCreate = {
  promise: Promise<string>
  realId?: string
  status: 'pending' | 'resolved' | 'rejected'
  ttlTimeout?: ReturnType<typeof setTimeout>
}

// Task draft type (using database field names for patch updates)
export type TaskDraft = Partial<{
  status?: 'to_do' | 'in_progress' | 'on_hold' | 'done'
  assignee_user_id?: string | null
  title?: string
  description?: string
  project_id?: string | null
  due_date?: string | null
  client_visible?: boolean
}>

// Task-specific maps
const pendingCreate = new Map<string, PendingCreate>()
const draft = new Map<string, TaskDraft>()
const flushScheduled = new Set<string>()
const dirty = new Set<string>()
const flushErrorShown = new Set<string>() // Track which tempIds have shown error toast

// Request draft type (using database field names for patch updates)
type RequestDraft = Partial<{
  status?: 'new' | 'in_review' | 'accepted' | 'canceled' | 'closed'
  assignee_user_id?: string | null
  title?: string
  description?: string
  project_id?: string | null
}>

// Request-specific maps
const requestPendingCreate = new Map<string, PendingCreate>()
const requestDraft = new Map<string, RequestDraft>()
const requestFlushScheduled = new Set<string>()
const requestDirty = new Set<string>()
const requestFlushErrorShown = new Set<string>()

export function registerPendingCreate(tempId: string, promiseRealId: Promise<string>) {
  // TTL fail-safe: cleanup after 2 minutes if not finalized (prevents leaks)
  // The leak we're protecting against is "promise resolves but finalize() never called"
  // So we keep TTL alive even after resolve - only finalize() or rejection clears it
  const ttlTimeout = setTimeout(() => {
    // cleanup() already checks and clears timeout safely, so call unconditionally
    cleanup(tempId)
  }, 120000) // 2 minutes
  
  const record: PendingCreate = {
    promise: promiseRealId,
    status: 'pending',
    ttlTimeout
  }
  
  pendingCreate.set(tempId, record)
  
  // Handle resolution
  promiseRealId
    .then(realId => {
      // DO NOT clear timeout on resolve - TTL protects against missing finalize()
      const existing = pendingCreate.get(tempId)
      if (existing) {
        existing.realId = realId
        existing.status = 'resolved'
      }
    })
    .catch(() => {
      // On rejection, cleanup all structures (cleanup() handles timeout clearing)
      cleanup(tempId)
    })
}

export function registerRealIdMapping(tempId: string, realId: string) {
  const existing = pendingCreate.get(tempId)
  if (existing) {
    existing.realId = realId
    existing.status = 'resolved'
  } else {
    // Real-time arrived before promise - create resolved record without TTL
    // No TTL needed here because we already have realId (no leak risk)
    // TTL is only needed when waiting for promise to resolve
    pendingCreate.set(tempId, {
      promise: Promise.resolve(realId),
      realId,
      status: 'resolved'
      // No ttlTimeout - not needed when realId already available
    })
  }
}

export function updateLatestDraft(tempId: string, patch: TaskDraft) {
  // Pure function: only updates draft state and marks dirty
  // Handlers must explicitly call scheduleFlush() after calling this
  const existing = draft.get(tempId) || {}
  draft.set(tempId, { ...existing, ...patch })
  dirty.add(tempId)
}

/**
 * Wait for a row to become visible in the database (retry logic for flush)
 * Only retries on "row not found" errors, not permission/RLS errors
 */
async function waitForRowVisible(
  table: 'tasks' | 'requests' | 'projects',
  id: string,
  selectFields: string,
  maxRetries: number = 5,
  baseDelay: number = 50
): Promise<void> {
  const supabase = createClient()
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const { data, error } = await supabase
      .from(table)
      .select(selectFields)
      .eq('id', id)
      .is('deleted_at', null)
      .single()
    
    // Success - row is visible
    if (!error && data) {
      return
    }
    
    // Check if this is a "row not found" error (the only error we retry on)
    const isNotFoundError = error && (
      error.code === 'PGRST116' ||
      error.message?.includes('No rows returned') ||
      error.message?.includes('multiple (or no) rows returned')
    )
    
    // Don't retry on permission/RLS errors - these are real failures
    if (error && !isNotFoundError) {
      throw error
    }
    
    // If not the last attempt, wait before retrying
    if (attempt < maxRetries - 1) {
      const delay = baseDelay * (attempt + 1) // Linear backoff: 50ms, 100ms, 150ms, 200ms, 250ms
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  
  // Final attempt failed - throw error
  throw new Error(`Row ${id} not visible in ${table} after ${maxRetries} retries`)
}

export function scheduleFlush(
  tempId: string,
  updaterFn: (realId: string, draft: TaskDraft) => Promise<void>
) {
  // Mark as scheduled (prevents multiple concurrent flushes)
  if (flushScheduled.has(tempId)) {
    return // Already scheduled, will pick up latest draft when it runs
  }
  
  flushScheduled.add(tempId)
  
  // Fire-and-forget microtask (debounced)
  queueMicrotask(async () => {
    try {
      // Wait for realId (from promise or mapping)
      const record = pendingCreate.get(tempId)
      if (!record) {
        // No pending create - tempId was already finalized or never registered
        // Clear draft/dirty as safeguard (prevents stuck dirty flags if finalize() didn't run)
        draft.delete(tempId)
        dirty.delete(tempId)
        // Finally will unschedule
        return
      }
      
      let realId: string
      if (record.realId) {
        realId = record.realId
      } else {
        realId = await record.promise
      }
      
      // Check if there are edits to flush
      if (!dirty.has(tempId)) {
        // No edits - return (keep pendingCreate for later edits, finally will unschedule)
        return
      }
      
      const latestDraft = draft.get(tempId)
      if (!latestDraft || Object.keys(latestDraft).length === 0) {
        // No draft - return (finally will unschedule)
        return
      }
      
      // Wait for row to be visible before updating (retry on "not found" errors)
      await waitForRowVisible('tasks', realId, 'connection_id, status')
      
      // Send patch update
      await updaterFn(realId, latestDraft)
      
      // On success: clear draft/dirty only (keep pendingCreate until finalized)
      draft.delete(tempId)
      dirty.delete(tempId)
    } catch (error) {
      // Never throw - handle internally
      if (process.env.NODE_ENV !== 'production') {
        console.error('[OptimisticTracker] Flush failed:', error)
      }
      
      // On error: keep draft/dirty so next edit triggers retry
      // Don't clear - transient failures shouldn't silently drop user's changes
      // Retry behavior: next edit (updateLatestDraft + scheduleFlush) will retry automatically
      
      // Show error toast only once per tempId
      if (!flushErrorShown.has(tempId)) {
        flushErrorShown.add(tempId)
        toast.error('Couldn\'t save changes. Try editing again.')
      }
    } finally {
      // Always clear flushScheduled so later edits can schedule again
      flushScheduled.delete(tempId)
    }
  })
}

function cleanup(tempId: string) {
  // Hard cleanup - called on create rejection or TTL timeout
  // TTL timeout means "we lost finalize()" (not "create failed")
  // Safely clears timeout if present (handles both cases)
  const record = pendingCreate.get(tempId)
  if (record?.ttlTimeout) {
    clearTimeout(record.ttlTimeout)
  }
  pendingCreate.delete(tempId)
  draft.delete(tempId)
  flushScheduled.delete(tempId)
  dirty.delete(tempId)
  flushErrorShown.delete(tempId)
}

export function finalize(tempId: string) {
  // Called from parent after:
  // 1. temp→real replacement in store completes
  // 2. modal ID swap completes (if modal was open)
  // Clear pendingCreate (no longer needed)
  const record = pendingCreate.get(tempId)
  if (record?.ttlTimeout) {
    clearTimeout(record.ttlTimeout)
  }
  pendingCreate.delete(tempId)
  // Also clear any leftover draft/dirty/flushScheduled/flushErrorShown (safety)
  draft.delete(tempId)
  dirty.delete(tempId)
  flushScheduled.delete(tempId)
  flushErrorShown.delete(tempId)
}

export function isOptimisticId(id: string): boolean {
  return id.startsWith('temp-')
}

/**
 * Get latest draft state for a tempId (for merging during temp→real replacement)
 * Returns undefined if no draft exists
 */
export function getLatestDraft(tempId: string): TaskDraft | undefined {
  return draft.get(tempId)
}

// ============================================================================
// Request-specific functions (mirroring task functions)
// ============================================================================

export function registerRequestPendingCreate(tempId: string, promiseRealId: Promise<string>) {
  // TTL fail-safe: cleanup after 2 minutes if not finalized (prevents leaks)
  const ttlTimeout = setTimeout(() => {
    cleanupRequest(tempId)
  }, 120000) // 2 minutes
  
  const record: PendingCreate = {
    promise: promiseRealId,
    status: 'pending',
    ttlTimeout
  }
  
  requestPendingCreate.set(tempId, record)
  
  // Handle resolution
  promiseRealId
    .then(realId => {
      const existing = requestPendingCreate.get(tempId)
      if (existing) {
        existing.realId = realId
        existing.status = 'resolved'
      }
    })
    .catch(() => {
      cleanupRequest(tempId)
    })
}

export function registerRequestRealIdMapping(tempId: string, realId: string) {
  const existing = requestPendingCreate.get(tempId)
  if (existing) {
    existing.realId = realId
    existing.status = 'resolved'
  } else {
    requestPendingCreate.set(tempId, {
      promise: Promise.resolve(realId),
      realId,
      status: 'resolved'
    })
  }
}

export function updateRequestLatestDraft(tempId: string, patch: RequestDraft) {
  // Pure function: only updates draft state and marks dirty
  // Handlers must explicitly call scheduleRequestFlush() after calling this
  const existing = requestDraft.get(tempId) || {}
  requestDraft.set(tempId, { ...existing, ...patch })
  requestDirty.add(tempId)
}

export function scheduleRequestFlush(
  tempId: string,
  updaterFn: (realId: string, draft: RequestDraft) => Promise<void>
) {
  // Mark as scheduled (prevents multiple concurrent flushes)
  if (requestFlushScheduled.has(tempId)) {
    return // Already scheduled, will pick up latest draft when it runs
  }
  
  requestFlushScheduled.add(tempId)
  
  // Fire-and-forget microtask (debounced)
  queueMicrotask(async () => {
    try {
      // Wait for realId (from promise or mapping)
      const record = requestPendingCreate.get(tempId)
      if (!record) {
        // No pending create - tempId was already finalized or never registered
        requestDraft.delete(tempId)
        requestDirty.delete(tempId)
        return
      }
      
      let realId: string
      if (record.realId) {
        realId = record.realId
      } else {
        realId = await record.promise
      }
      
      // Defensive check: ensure realId is not a tempId
      if (realId.startsWith('temp-')) {
        if (process.env.NODE_ENV !== 'production') {
          console.error('[scheduleRequestFlush] realId is still tempId:', { tempId, realId, record })
        }
        return
      }
      
      // Check if there are edits to flush
      if (!requestDirty.has(tempId)) {
        return
      }
      
      const latestDraft = requestDraft.get(tempId)
      if (!latestDraft || Object.keys(latestDraft).length === 0) {
        return
      }
      
      // Wait for row to be visible before updating (retry on "not found" errors)
      await waitForRowVisible('requests', realId, 'connection_id')
      
      // Send patch update
      await updaterFn(realId, latestDraft)
      
      // On success: clear draft/dirty only (keep pendingCreate until finalized)
      requestDraft.delete(tempId)
      requestDirty.delete(tempId)
    } catch (error) {
      // Never throw - handle internally
      if (process.env.NODE_ENV !== 'production') {
        console.error('[OptimisticTracker] Request flush failed:', error)
      }
      
      // On error: keep draft/dirty so next edit triggers retry
      if (!requestFlushErrorShown.has(tempId)) {
        requestFlushErrorShown.add(tempId)
        toast.error('Couldn\'t save changes. Try editing again.')
      }
    } finally {
      // Always clear flushScheduled so later edits can schedule again
      requestFlushScheduled.delete(tempId)
    }
  })
}

function cleanupRequest(tempId: string) {
  // Hard cleanup - called on create rejection or TTL timeout
  const record = requestPendingCreate.get(tempId)
  if (record?.ttlTimeout) {
    clearTimeout(record.ttlTimeout)
  }
  requestPendingCreate.delete(tempId)
  requestDraft.delete(tempId)
  requestFlushScheduled.delete(tempId)
  requestDirty.delete(tempId)
  requestFlushErrorShown.delete(tempId)
}

export function finalizeRequest(tempId: string) {
  // Called from parent after:
  // 1. temp→real replacement in store completes
  // 2. modal ID swap completes (if modal was open)
  const record = requestPendingCreate.get(tempId)
  if (record?.ttlTimeout) {
    clearTimeout(record.ttlTimeout)
  }
  requestPendingCreate.delete(tempId)
  // Also clear any leftover draft/dirty/flushScheduled/flushErrorShown (safety)
  requestDraft.delete(tempId)
  requestDirty.delete(tempId)
  requestFlushScheduled.delete(tempId)
  requestFlushErrorShown.delete(tempId)
}

/**
 * Get latest draft state for a request tempId (for merging during temp→real replacement)
 * Returns undefined if no draft exists
 */
export function getRequestLatestDraft(tempId: string): RequestDraft | undefined {
  return requestDraft.get(tempId)
}

// ============================================================================
// Project-specific functions (mirroring request functions)
// ============================================================================

// Project draft type (using Project type field names: title, not name)
type ProjectDraft = Partial<{
  status?: 'planned' | 'active' | 'on_hold' | 'completed' | 'canceled'
  title?: string  // Project type uses 'title', maps to 'name' in DB
  description?: string
  start_date?: string | null
  end_date?: string | null
}>

// Project-specific maps
const projectPendingCreate = new Map<string, PendingCreate>()
const projectDraft = new Map<string, ProjectDraft>()
const projectFlushScheduled = new Set<string>()
const projectDirty = new Set<string>()
const projectFlushErrorShown = new Set<string>()

export function registerProjectPendingCreate(tempId: string, promiseRealId: Promise<string>) {
  // TTL fail-safe: cleanup after 2 minutes if not finalized (prevents leaks)
  const ttlTimeout = setTimeout(() => {
    cleanupProject(tempId)
  }, 120000) // 2 minutes
  
  const record: PendingCreate = {
    promise: promiseRealId,
    status: 'pending',
    ttlTimeout
  }
  
  projectPendingCreate.set(tempId, record)
  
  // Handle resolution
  promiseRealId
    .then(realId => {
      const existing = projectPendingCreate.get(tempId)
      if (existing) {
        existing.realId = realId
        existing.status = 'resolved'
      }
    })
    .catch(() => {
      cleanupProject(tempId)
    })
}

export function registerProjectRealIdMapping(tempId: string, realId: string) {
  const existing = projectPendingCreate.get(tempId)
  if (existing) {
    existing.realId = realId
    existing.status = 'resolved'
  } else {
    projectPendingCreate.set(tempId, {
      promise: Promise.resolve(realId),
      realId,
      status: 'resolved'
    })
  }
}

export function updateProjectLatestDraft(tempId: string, patch: ProjectDraft) {
  // Pure function: only updates draft state and marks dirty
  // Handlers must explicitly call scheduleProjectFlush() after calling this
  const existing = projectDraft.get(tempId) || {}
  projectDraft.set(tempId, { ...existing, ...patch })
  projectDirty.add(tempId)
}

export function scheduleProjectFlush(
  tempId: string,
  updaterFn: (realId: string, draft: ProjectDraft) => Promise<void>
) {
  // Mark as scheduled (prevents multiple concurrent flushes)
  if (projectFlushScheduled.has(tempId)) {
    return // Already scheduled, will pick up latest draft when it runs
  }
  
  projectFlushScheduled.add(tempId)
  
  // Fire-and-forget microtask (debounced)
  queueMicrotask(async () => {
    try {
      // Wait for realId (from promise or mapping)
      const record = projectPendingCreate.get(tempId)
      if (!record) {
        // No pending create - tempId was already finalized or never registered
        projectDraft.delete(tempId)
        projectDirty.delete(tempId)
        return
      }
      
      let realId: string
      if (record.realId) {
        realId = record.realId
      } else {
        realId = await record.promise
      }
      
      // Defensive check: ensure realId is not a tempId
      if (realId.startsWith('temp-')) {
        if (process.env.NODE_ENV !== 'production') {
          console.error('[scheduleProjectFlush] realId is still tempId:', { tempId, realId, record })
        }
        return
      }
      
      // Check if there are edits to flush
      if (!projectDirty.has(tempId)) {
        return
      }
      
      const latestDraft = projectDraft.get(tempId)
      if (!latestDraft || Object.keys(latestDraft).length === 0) {
        return
      }
      
      // Wait for row to be visible before updating (retry on "not found" errors)
      await waitForRowVisible('projects', realId, 'connection_id')
      
      // Send patch update (updaterFn handles calling per-field actions)
      await updaterFn(realId, latestDraft)
      
      // On success: clear draft/dirty only (keep pendingCreate until finalized)
      projectDraft.delete(tempId)
      projectDirty.delete(tempId)
    } catch (error) {
      // Never throw - handle internally
      if (process.env.NODE_ENV !== 'production') {
        console.error('[OptimisticTracker] Project flush failed:', error)
      }
      
      // On error: keep draft/dirty so next edit triggers retry
      if (!projectFlushErrorShown.has(tempId)) {
        projectFlushErrorShown.add(tempId)
        toast.error('Couldn\'t save changes. Try editing again.')
      }
    } finally {
      // Always clear flushScheduled so later edits can schedule again
      projectFlushScheduled.delete(tempId)
    }
  })
}

function cleanupProject(tempId: string) {
  // Hard cleanup - called on create rejection or TTL timeout
  const record = projectPendingCreate.get(tempId)
  if (record?.ttlTimeout) {
    clearTimeout(record.ttlTimeout)
  }
  projectPendingCreate.delete(tempId)
  projectDraft.delete(tempId)
  projectFlushScheduled.delete(tempId)
  projectDirty.delete(tempId)
  projectFlushErrorShown.delete(tempId)
}

export function finalizeProject(tempId: string) {
  // Called from parent after:
  // 1. temp→real replacement in store completes
  // 2. modal ID swap completes (if modal was open)
  const record = projectPendingCreate.get(tempId)
  if (record?.ttlTimeout) {
    clearTimeout(record.ttlTimeout)
  }
  projectPendingCreate.delete(tempId)
  // Also clear any leftover draft/dirty/flushScheduled/flushErrorShown (safety)
  projectDraft.delete(tempId)
  projectDirty.delete(tempId)
  projectFlushScheduled.delete(tempId)
  projectFlushErrorShown.delete(tempId)
}

/**
 * Get latest draft state for a project tempId (for merging during temp→real replacement)
 * Returns undefined if no draft exists
 */
export function getProjectLatestDraft(tempId: string): ProjectDraft | undefined {
  return projectDraft.get(tempId)
}

